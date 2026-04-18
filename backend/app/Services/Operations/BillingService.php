<?php

namespace App\Services\Operations;

use App\Services\Concerns\ManagesWorkflows;
use App\Models\Billing;
use App\Models\BillingLineItem;
use App\Models\Contract;
use App\Models\User;
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
 * (rent, utilities, add-ons), and authoritative status reconciliation.
 */
class BillingService
{
    use ManagesWorkflows;

    /**
     * Generate a new billing cycle record with itemized line items.
     * 
     * Forensic Rules:
     * - Rule: Automatically attaches active Appliance (Add-on) registry items.
     * - Rule: Associates verified Room Meter Readings for utility billing.
     * - Guard: Prevents duplicate billing cycles for the same contract/period.
     * 
     * @param User $actor The staff member performing the action.
     * @param array $data Input including contract_id, periods, and line_items.
     * @return Billing
     * @throws ValidationException
     */
    public static function create(User $actor, array $data): Billing
    {
        self::validateCreateInput($data);

        return self::runWriteWorkflow(
            actorId: $actor->user_id,
            action: 'GENERATE_BILLING',
            txnReference: self::buildTxnReference('BIL'),
            payload: [
                'contract_id' => $data['contract_id'],
                'reading_ids' => Arr::get($data, 'reading_ids', []),
            ],
            operation: function () use ($data): Billing {
                // Forensic Guard: Prevent duplicate billing for same contract and overlapping period
                $exists = Billing::where('contract_id', $data['contract_id'])
                    ->where('billing_period_from', $data['billing_period_from'])
                    ->where('billing_period_to', $data['billing_period_to'])
                    ->exists();
                
                if ($exists) {
                    throw ValidationException::withMessages([
                        'billing_period' => ['A billing record already exists for this contract and period. Duplicate entries are prevented for ledger integrity.']
                    ]);
                }

                $billing = Billing::create([
                    'contract_id' => (int) $data['contract_id'],
                    'billing_period_from' => $data['billing_period_from'],
                    'billing_period_to' => $data['billing_period_to'],
                    'due_date' => $data['due_date'],
                    'status' => Billing::STATUS_UNPAID,
                ]);

                $hasManualAddOns = false;
                foreach ($data['line_items'] as $item) {
                    if ($item['item_type'] === 'add_on') {
                        $hasManualAddOns = true;
                    }

                    BillingLineItem::create([
                        'billing_id' => $billing->billing_id,
                        'item_type' => $item['item_type'],
                        'item_description' => Arr::get($item, 'item_description'),
                        'amount' => $item['amount'],
                    ]);
                }

                // Philippine Rule: Automated Add-on attachment only if not manually calculated in wizard
                if (!$hasManualAddOns) {
                    $contract = Contract::with('addOns')->find($billing->contract_id);
                    if ($contract) {
                        foreach ($contract->addOns as $addOn) {
                            BillingLineItem::create([
                                'billing_id' => $billing->billing_id,
                                'item_type' => 'add_on',
                                'item_description' => "Appliance Fee: " . $addOn->item_name,
                                'amount' => $addOn->pivot->actual_rate,
                            ]);
                        }
                    }
                }

                // Philippine Rule: Associate Meter Readings
                if (!empty($data['reading_ids'])) {
                    $contract = Contract::with('room')->find($billing->contract_id);
                    foreach ($data['reading_ids'] as $id) {
                        $reading = DB::table('room_meter_readings')
                            ->where('reading_id', $id)
                            ->first();
                        
                        if ($reading) {
                            if ($reading->room_id !== ($contract->room->room_id ?? null)) {
                                throw new \Exception("Forensic Desync: Utility reading #{$id} does not belong to the assigned room.");
                            }
                            
                            DB::table('room_meter_readings')
                                ->where('reading_id', $id)
                                ->update(['billing_id' => $billing->billing_id]);
                        }
                    }
                }

                return self::getById((int) $billing->billing_id);
            },
            resultDetails: function (Billing $result): array {
                return [
                    'billing_id' => $result->billing_id,
                    'amount_due' => (float) $result->lineItems()->sum('amount'),
                ];
            }
        );
    }

    /**
     * Specialized initialization for new contracts (First Month + Deposit).
     * 
     * @param User $actor
     * @param int $contractId
     * @return Billing
     */
    public static function initializeContractBilling(User $actor, int $contractId): Billing
    {
        // Eager load everything needed for the response and calculation
        $contract = Contract::with(['room', 'bedSpace'])->findOrFail($contractId);
        
        if (!in_array($contract->status, [Contract::STATUS_PENDING_PAYMENT, Contract::STATUS_ACTIVE])) {
            throw ValidationException::withMessages([
                'contract_id' => ['Check-in billing can only be initialized for new or active contracts.'],
            ]);
        }

        $billingPeriodFrom = Carbon::parse($contract->move_in_date);
        $billingPeriodTo = $billingPeriodFrom->copy()->endOfMonth()->toDateString();
        $dueDate = $billingPeriodFrom->toDateString();

        // Safe rate calculation
        $baseRate = (float) ($contract->monthly_rate_override ?? ($contract->room->monthly_rate ?? 0));
        $deposit = (float) ($contract->deposit_amount ?? 0);

        $lineItems = [
            [
                'item_type' => BillingLineItem::TYPE_BASE_RENT,
                'item_description' => 'Advance Rent (Initial)',
                'amount' => $baseRate,
            ],
            [
                'item_type' => BillingLineItem::TYPE_ADJUSTMENT,
                'item_description' => 'Security Deposit',
                'amount' => $deposit,
            ]
        ];

        return self::runWriteWorkflow(
            actorId: $actor->user_id,
            action: 'INITIALIZE_BILLING',
            txnReference: "CONTRACT-{$contract->contract_id}-INIT",
            payload: ['contract_id' => $contract->contract_id],
            operation: function () use ($contract, $billingPeriodFrom, $billingPeriodTo, $dueDate, $lineItems): Billing {
                $billing = Billing::create([
                    'contract_id' => $contract->contract_id,
                    'billing_period_from' => $billingPeriodFrom->toDateString(),
                    'billing_period_to' => $billingPeriodTo,
                    'due_date' => $dueDate,
                    'status' => 'unpaid',
                ]);

                foreach ($lineItems as $item) {
                    $billing->lineItems()->create($item);
                }

                // Return with eager-loaded relationships for safe serialization
                return self::getById((int) $billing->billing_id);
            }
        );
    }

    /**
     * Authored authority for reconciling billing status against non-voided payments.
     * 
     * @param Billing $billing
     * @return Billing
     */
    public static function syncBillingStatus(Billing $billing): Billing
    {
        $amountDue = (float) $billing->lineItems()->sum('amount');
        $amountPaid = (float) $billing->payments()->whereNull('voided_at')->sum('amount_paid');

        $newStatus = Financials::deriveBillingStatus($amountDue, $amountPaid, (string)$billing->due_date);

        if ($billing->status !== $newStatus) {
            $billing->update(['status' => $newStatus]);
        }

        return $billing;
    }

    /**
     * Alias for legacy controller support. Matches the syncBillingStatus logic.
     */
    public static function syncBillingStatusFromAttributes(Billing $billing): void
    {
        self::syncBillingStatus($billing);
    }

    /**
     * Build the authoritative billing list query with precomputed financial sums.
     */
    public static function listQueryWithSums(array $filters): Builder
    {
        $query = Billing::with(['contract.tenant', 'contract.room'])
            ->withSum(['lineItems as total_amount' => function ($q): void {
                $q->select(DB::raw('COALESCE(SUM(amount), 0)'));
            }], 'amount')
            ->withSum(['payments as total_paid' => function ($q): void {
                $q->select(DB::raw('COALESCE(SUM(amount_paid), 0)'))->whereNull('voided_at');
            }], 'amount_paid');

        if (! empty($filters['contract_id'])) {
            $query->where('contract_id', $filters['contract_id']);
        }

        if (! empty($filters['tenant_id'])) {
            $query->whereHas('contract', fn ($q) => $q->where('tenant_id', $filters['tenant_id']));
        }

        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (! empty($filters['due_date'])) {
            $query->whereDate('due_date', $filters['due_date']);
        }

        if (! empty($filters['q'])) {
            $needle = $filters['q'];
            $query->whereHas('contract.tenant', function ($q) use ($needle): void {
                $q->where('first_name', 'LIKE', "%{$needle}%")
                    ->orWhere('last_name', 'LIKE', "%{$needle}%")
                    ->orWhereRaw("CONCAT(first_name, ' ', last_name) LIKE ?", ["%{$needle}%"]);
            });
        }

        if (! empty($filters['receivable_state'])) {
            if ($filters['receivable_state'] === 'past_due') {
                $query->where('status', '!=', Billing::STATUS_PAID)
                    ->where('due_date', '<', now()->toDateString());
            } elseif ($filters['receivable_state'] === 'current') {
                $query->where('due_date', '>=', now()->toDateString());
            }
        }

        return $query->orderByDesc('billing_id');
    }

    /**
     * Compute utility cost based on sub-meter reading (By Room rule).
     * 
     * @param int $roomId
     * @param string $type ('electricity'|'water')
     * @param float $currentReading
     * @param float $unitRate
     * @return array<string,float>
     */
    public static function computeUtilityCost(int $roomId, string $type, float $currentReading, float $unitRate): array
    {
        return Financials::computeUtilityCost($roomId, $type, $currentReading, $unitRate);
    }

    /**
     * Internal input validation for billing generation.
     */
    private static function validateCreateInput(array $data): void
    {
        $contract = Contract::find((int) $data['contract_id']);

        if (! $contract || ! in_array($contract->status, [Contract::STATUS_ACTIVE, Contract::STATUS_PENDING_PAYMENT])) {
            throw ValidationException::withMessages([
                'contract_id' => ['Contract must exist and be active or pending payment for billing generation.'],
            ]);
        }
    }

    /**
     * Find a billing record by ID with relations and precomputed financial totals.
     */
    public static function getById(int $billingId): ?Billing
    {
        return Billing::with(['contract.tenant', 'contract.room', 'contract.bedSpace', 'lineItems', 'payments.processor'])
            ->withSum(['lineItems as total_amount' => function ($q): void {
                $q->select(DB::raw('COALESCE(SUM(amount), 0)'));
            }], 'amount')
            ->withSum(['payments as total_paid' => function ($q): void {
                $q->select(DB::raw('COALESCE(SUM(amount_paid), 0)'))->whereNull('voided_at');
            }], 'amount_paid')
            ->find($billingId);
    }
}
