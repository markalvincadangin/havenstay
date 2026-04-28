<?php
 
 namespace App\Services\Operations;
 
 use App\Services\Concerns\ManagesWorkflows;
 use App\Models\Billing;
 use App\Models\BillingLineItem;
 use App\Models\Contract;
 use App\Models\Meter;
 use App\Models\MeterReading;
 use App\Models\User;
 use App\Enums\BillingStatus;
 use App\Enums\LineItemType;
 use App\Enums\ContractStatus;
 use App\Support\Financials;
 use Illuminate\Database\Eloquent\Builder;
 use Illuminate\Support\Arr;
 use Illuminate\Support\Facades\DB;
 use Illuminate\Support\Carbon;
 use Illuminate\Validation\ValidationException;
 
 /**
  * BillingService
  * 
  * Manages the generation of monthly billing cycles, itemization of charges 
  * (rent, utilities), and authoritative status reconciliation.
  * Optimized for HavenStay Forensic v5.0.
  */
 class BillingService
 {
     use ManagesWorkflows;
 
     /**
      * Generate a new billing cycle record.
      * 
      * Forensic Rules:
      * - Loads verified Meter Readings associated with the Room.
      * - Rounding Differential: Leftovers from division are applied to the oldest active contract.
      * 
      * @param User $actor The staff member generating the bill.
      * @param array $data Input details (contract_id, periods, line_items, readings).
      * @return Billing
      * @throws ValidationException
      */
     public static function create(User $actor, array $data): Billing
     {
         self::validateCreateInput($data);
 
         $contract = Contract::with(['bedSpace.room'])->findOrFail((int)$data['contract_id']);
         $baseRent = $contract->monthly_rate_override ?? $contract->monthly_rate;
 
         return self::runWriteWorkflow(
             actorId: $actor->user_id,
             action: 'GENERATE_BILLING',
             payload: [
                 'contract_id' => $data['contract_id'],
                 'billing_period' => ($data['billing_period_from'] ?? 'N/A') . ' to ' . ($data['billing_period_to'] ?? 'N/A'),
                 'base_rent_fact' => $baseRent,
                 'reading_ids' => Arr::get($data, 'reading_ids', []),
             ],
             operation: function () use ($data, $contract, $baseRent): Billing {
                 $billing = Billing::create([
                     'contract_id' => (int) $data['contract_id'],
                     'billing_period_from' => $data['billing_period_from'],
                     'billing_period_to' => $data['billing_period_to'],
                     'due_date' => $data['due_date'],
                     'status' => BillingStatus::UNPAID,
                     'idempotency_key' => $data['idempotency_key'] ?? null,
                 ]);
 
                 // 1. Process Base Rent
                 BillingLineItem::create([
                     'billing_id' => $billing->billing_id,
                     'item_type' => LineItemType::BASE_RENT,
                     'item_description' => 'Monthly Base Rent',
                     'amount' => $baseRent,
                 ]);
 
                 // 2. Process Manual Line Items
                 if (!empty($data['line_items'])) {
                     foreach ($data['line_items'] as $item) {
                         BillingLineItem::create([
                             'billing_id' => $billing->billing_id,
                             'item_type' => $item['item_type'] ?? LineItemType::ADJUSTMENT,
                             'item_description' => $item['description'],
                             'amount' => $item['amount'],
                         ]);
                     }
                 }
 
                 // 3. Process Meter Readings (Utilities)
                 if (!empty($data['reading_ids'])) {
                     $activeContracts = Contract::whereHas('bedSpace', function ($q) use ($contract) {
                         $q->where('room_id', $contract->room->room_id);
                     })
                         ->where('status', ContractStatus::ACTIVE)
                         ->orderBy('move_in_date', 'asc')
                         ->get();
 
                     $occupantIds = $activeContracts->pluck('contract_id')->all();
 
                     foreach ($data['reading_ids'] as $id) {
                         $reading = MeterReading::with('meter.utility')->findOrFail($id);
                         $meter = $reading->meter;
 
                         // Calculate cost for the meter session (authoritative cost)
                         // Use billing_period_from for rate lookup (BR-MET-007)
                         $totalCost = Financials::computeUtilityCost(
                             $meter->meter_id,
                             (float) $reading->reading_value,
                             $billing->billing_period_from
                         );
 
                         // Centralized BR-MET-011 Logic
                         $apportionments = Financials::apportionUtilityCharge($totalCost, $occupantIds);
                         $sharedAmount = $apportionments[$contract->contract_id] ?? 0;
 
                         BillingLineItem::create([
                             'billing_id' => $billing->billing_id,
                             'utility_id' => $meter->utility_id,
                             'reading_id' => $reading->reading_id,
                             'item_type' => LineItemType::UTILITY,
                             'item_description' => "{$meter->utility->name} (Meter: {$meter->serial_number}) - Share {$sharedAmount} / " . count($occupantIds),
                             'amount' => $sharedAmount,
                         ]);
                     }
                 }
 
                 return self::getById((int) $billing->billing_id);
             }
         );
     }
 
     /**
      * Specialized initialization (Rent only).
      * Deposit is handled via Contract/Payment directly.
      * 
      * @param User $actor The staff member initializing billing.
      * @param int $contractId
      * @param string|null $idempotencyKey
      * @return Billing
      */
     public static function initializeContractBilling(User $actor, int $contractId, ?string $idempotencyKey = null): Billing
     {
         $contract = Contract::findOrFail($contractId);
 
         $billingPeriodFrom = Carbon::parse($contract->move_in_date);
         $billingPeriodTo = $billingPeriodFrom->copy()->endOfMonth()->toDateString();
         $dueDate = $billingPeriodFrom->toDateString();
         $baseRent = $contract->monthly_rate_override ?? $contract->monthly_rate;
 
         return self::runWriteWorkflow(
             actorId: $actor->user_id,
             action: 'INITIALIZE_BILLING',
             payload: ['contract_id' => $contract->contract_id, 'initial_rent' => $baseRent],
             operation: function () use ($contract, $billingPeriodFrom, $billingPeriodTo, $dueDate, $baseRent, $idempotencyKey): Billing {
                 $billing = Billing::create([
                     'contract_id' => $contract->contract_id,
                     'billing_period_from' => $billingPeriodFrom->toDateString(),
                     'billing_period_to' => $billingPeriodTo,
                     'due_date' => $dueDate,
                     'status' => BillingStatus::UNPAID,
                     'idempotency_key' => $idempotencyKey,
                 ]);
 
                 $billing->lineItems()->create([
                     'item_type' => LineItemType::BASE_RENT,
                     'item_description' => 'Advance Rent (Initial)',
                     'amount' => $baseRent,
                 ]);
 
                 return self::getById((int) $billing->billing_id);
             }
         );
     }
 
     /**
     * Authoritative status reconciliation for a billing record.
     * 
     * @param User $actor The staff member triggering the sync.
     * @param Billing $billing
     * @return Billing
     */
    public static function syncBillingStatus(User $actor, Billing $billing): Billing
    {
        if (self::synchronizeStatus($billing)) {
            return self::runWriteWorkflow(
                actorId: $actor->user_id,
                action: 'RECONCILE_BILLING',
                payload: ['billing_id' => $billing->billing_id, 'new_status' => $billing->status->value],
                operation: function () use ($billing): Billing {
                    // Actual save happens here via Workflow
                    $billing->save();
                    return $billing->fresh();
                }
            );
        }
        return $billing;
    }

    /**
     * Internal: Reconcile status without workflow overhead.
     * 
     * @param Billing $billing
     * @return bool True if status was changed.
     */
    public static function synchronizeStatus(Billing $billing): bool
    {
        $amountDue = (float) $billing->lineItems()->sum('amount');
        $amountPaid = (float) $billing->payments()->whereNull('voided_at')->sum('amount_paid');
        $newStatus = Financials::deriveBillingStatus($amountDue, $amountPaid, (string) $billing->due_date);

        if ($billing->status === $newStatus) {
            return false;
        }

        $billing->status = $newStatus;
        return $billing->save();
    }
 
     /**
      * List billing history with pagination.
      */
     public static function listPaginated(array $filters = [], int $page = 1, int $perPage = 15)
     {
         return self::listQueryWithSums($filters)->paginate($perPage, ['*'], 'page', $page);
     }
 
     /**
      * Paginated list query with aggregated sums.
      * 
      * @param array $filters
      * @return Builder<\App\Models\Billing>
      */
     public static function listQueryWithSums(array $filters): Builder
     {
         $query = Billing::query()
             ->with([
                 'contract' => fn($q) => $q->withTrashed(),
                 'contract.tenant' => fn($q) => $q->withTrashed(),
                 'contract.room' => fn($q) => $q->withTrashed()
             ])
             ->withSum([
                 'lineItems as total_amount' => function ($q) {
                     $q->select(DB::raw('COALESCE(SUM(amount), 0)'));
                 }
             ], 'amount')
             ->withSum([
                 'payments as total_paid' => function ($q) {
                     $q->select(DB::raw('COALESCE(SUM(amount_paid), 0)'))->whereNull('voided_at');
                 }
             ], 'amount_paid');
 
         if (!empty($filters['contract_id']))
             $query->where('contract_id', $filters['contract_id']);
         if (!empty($filters['tenant_id']))
             $query->whereHas('contract', fn($q) => $q->where('tenant_id', $filters['tenant_id']));
         if (!empty($filters['status']))
             $query->where('status', $filters['status']);
 
         if (!empty($filters['past_due'])) {
             $query->where('due_date', '<', now()->toDateString())
                 ->where('status', '!=', BillingStatus::PAID->value);
         }
 
         $query->orderByDesc('billing_id');
 
         return $query;
     }
 
     /**
      * Retrieve a billing record by ID with full forensic context.
      * 
      * @param int $billingId
      * @return Billing|null
      */
     public static function getById(int $billingId): ?Billing
     {
         return Billing::useWritePdo()
             ->with([
                'contract' => fn($q) => $q->withTrashed(),
                'contract.tenant' => fn($q) => $q->withTrashed(),
                'contract.room' => fn($q) => $q->withTrashed(),
                'contract.bedSpace',
                'lineItems.utility',
                'payments.processor'
             ])
             ->withSum([
                 'lineItems as total_amount' => function ($q) {
                     $q->select(DB::raw('COALESCE(SUM(amount), 0)'));
                 }
             ], 'amount')
             ->withSum([
                 'payments as total_paid' => function ($q) {
                     $q->select(DB::raw('COALESCE(SUM(amount_paid), 0)'))->whereNull('voided_at');
                 }
             ], 'amount_paid')
             ->find($billingId);
     }
 
     /**
      * Internal input validation for billing generation.
      * 
      * @param array $data
      * @return void
      * @throws ValidationException
      */
     private static function validateCreateInput(array $data): void
     {
         $contract = Contract::find((int) $data['contract_id']);
         if (!$contract || !in_array($contract->status, [ContractStatus::ACTIVE, ContractStatus::PENDING_PAYMENT])) {
             throw ValidationException::withMessages(['contract_id' => ['Contract missing/inactive.']]);
         }
 
         // Rule BR-BIL-002: Duplicate Prevention
         $exists = Billing::where('contract_id', (int) $data['contract_id'])
             ->whereDate('billing_period_from', Carbon::parse($data['billing_period_from'])->toDateString())
             ->whereDate('billing_period_to', Carbon::parse($data['billing_period_to'])->toDateString())
             ->exists();
 
         if ($exists) {
             throw ValidationException::withMessages([
                 'billing_period_from' => ['A billing cycle already exists for this contract and period.'],
             ]);
         }
     }
 }
