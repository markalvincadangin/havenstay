<?php

namespace App\Services\Operations;

use App\Enums\BillingStatus;
use App\Enums\ContractStatus;
use App\Enums\LineItemType;
use App\Models\Billing;
use App\Models\BillingLineItem;
use App\Models\Contract;
use App\Models\Meter;
use App\Models\MeterReading;
use App\Models\User;
use App\Services\Concerns\ManagesWorkflows;
use App\Support\Financials;
use App\Support\OperationalHardening;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Arr;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Manages the generation of monthly billing cycles, itemization of charges
 * (rent, utilities), and status reconciliation.
 */
class BillingService
{
    use ManagesWorkflows;

    /**
     * Generate a new billing cycle record.
     *
     * @param  User  $actor  The staff member generating the bill.
     * @param  array  $data  Input details (contract_id, periods, line_items, readings).
     *
     * @throws ValidationException
     */
    public static function create(User $actor, array $data): Billing
    {
        self::validateCreateInput($data);

        $contract = Contract::with(['bedSpace.room'])->findOrFail((int) $data['contract_id']);
        $baseRent = $contract->monthly_rate_override ?? $contract->monthly_rate;

        return DB::transaction(function () use ($actor, $data, $baseRent) {
            // High-Performance Hardening: Use a shared lock to prevent concurrent creation 
            // of overlapping billing periods for the same contract (Race Condition Prevention).
            self::validateCreateInput($data, true);

            return self::runWriteWorkflow(
                actorId: $actor->user_id,
                action: 'GENERATE_BILLING',
                payload: [
                    'contract_id' => $data['contract_id'],
                    'billing_period' => ($data['billing_period_from'] ?? 'N/A').' to '.($data['billing_period_to'] ?? 'N/A'),
                    'base_rent_fact' => $baseRent,
                    'reading_ids' => Arr::get($data, 'reading_ids', []),
                ],
                operation: function () use ($data, $baseRent): Billing {
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
                    if (! empty($data['line_items'])) {
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
                    if (! empty($data['reading_ids'])) {
                        $contract = Contract::with(['bedSpace.room'])->findOrFail((int) $data['contract_id']);
                        $activeContracts = Contract::whereHas('bedSpace', function ($q) use ($contract) {
                            $q->where('room_id', $contract->room->room_id);
                        })
                            ->whereIn('status', [ContractStatus::ACTIVE, ContractStatus::PENDING_PAYMENT])
                            ->orderBy('move_in_date', 'asc')
                            ->get();

                        $occupantIds = $activeContracts->pluck('contract_id')->all();

                        foreach ($data['reading_ids'] as $id) {
                            $reading = MeterReading::with('meter.utility')->findOrFail($id);
                            $meter = $reading->meter;

                            $totalCost = Financials::computeUtilityCost(
                                $meter->meter_id,
                                (float) $reading->reading_value,
                                $billing->billing_period_from
                            );

                            $apportionments = Financials::apportionUtilityCharge($totalCost, $occupantIds);
                            $sharedAmount = $apportionments[$contract->contract_id] ?? 0;

                            if (abs($sharedAmount) > 0.001) {
                                BillingLineItem::create([
                                    'billing_id' => $billing->billing_id,
                                    'utility_id' => $meter->utility_id,
                                    'reading_id' => $reading->reading_id,
                                    'item_type' => LineItemType::UTILITY,
                                    'item_description' => "{$meter->utility->name} (Meter: {$meter->serial_number}) - Share {$sharedAmount} / ".count($occupantIds),
                                    'amount' => $sharedAmount,
                                ]);
                            }
                        }
                    }

                    return self::getById((int) $billing->billing_id);
                }
            );
        });
    }

    /**
     * Specialized initialization (Rent only).
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
     * Update the status of a billing record based on payments.
     */
    public static function syncBillingStatus(User $actor, Billing $billing): Billing
    {
        if (self::synchronizeStatus($billing)) {
            return self::runWriteWorkflow(
                actorId: $actor->user_id,
                action: 'RECONCILE_BILLING',
                payload: ['billing_id' => $billing->billing_id, 'new_status' => $billing->status->value],
                operation: function () use ($billing): Billing {
                    $billing->save();

                    return $billing->fresh();
                }
            );
        }

        return $billing;
    }

    /**
     * Internal: Reconcile status without workflow overhead.
     */
    public static function synchronizeStatus(Billing $billing): bool
    {
        // Performance Polish: Prefer already-calculated context attributes from withFinancials()
        // to avoid redundant aggregate queries (N+1 prevention).
        $amountDue = isset($billing->total_amount) 
            ? (float) $billing->total_amount 
            : (float) $billing->lineItems()->sum('amount');
            
        $amountPaid = isset($billing->total_paid) 
            ? (float) $billing->total_paid 
            : (float) $billing->payments()->whereNull('voided_at')->sum('amount_paid');
            
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
        $query = self::listQueryWithSums($filters);
        
        $sortBy = $filters['sort_by'] ?? 'id';
        $sortDir = $filters['sort_dir'] ?? 'desc';
        
        $sortMap = [
            'id'     => 'billing_id',
            'period' => 'billing_period_from',
            'due'    => 'due_date',
            'status' => 'status',
            'amount' => 'total_amount',
        ];

        if (isset($sortMap[$sortBy])) {
            $query->orderBy($sortMap[$sortBy], $sortDir);
        } elseif ($sortBy === 'balance') {
            $query->orderByRaw('(IFNULL(total_amount, 0) - IFNULL(total_paid, 0)) ' . ($sortDir === 'desc' ? 'DESC' : 'ASC'));
        } else {
            $query->orderByDesc('billing_id');
        }
        
        // Secondary tie-breaker
        $query->orderByDesc('billing_id');
        
        return $query->paginate($perPage, ['*'], 'page', $page);
    }

    /**
     * Paginated list query with aggregated sums.
     */
    public static function listQueryWithSums(array $filters): Builder
    {
        $query = Billing::query()
            ->with([
                'contract' => fn ($q) => $q->withTrashed(),
                'contract.tenant',
                'contract.room',
                'contract.bedSpace',
            ])
            ->withFinancials();

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

        if (! empty($filters['past_due'])) {
            $query->where('due_date', '<', now()->toDateString())
                ->where('status', '!=', BillingStatus::PAID->value);
        }

        if (! empty($filters['q'])) {
            $needle = trim((string) $filters['q']);
            $forensicId = OperationalHardening::parseForensicId($needle);

            $query->where(function ($w) use ($needle, $forensicId) {
                if ($forensicId) {
                    $w->where('billing_id', $forensicId);
                } else {
                    $stripped = ltrim($needle, '#');
                    $w->where('billing_id', 'like', "%{$stripped}%")
                        ->orWhereHas('contract.tenant', function ($t) use ($stripped) {
                            $t->where('first_name', 'like', "%{$stripped}%")
                                ->orWhere('last_name', 'like', "%{$stripped}%")
                                ->orWhere('contact_number', 'like', "%{$stripped}%");
                        });
                }
            });
        }

        return $query;
    }

    /**
     * Retrieve a billing record by ID with related line items and payments.
     */
    public static function getById(int $billingId): ?Billing
    {
        return Billing::useWritePdo()
            ->with([
                'contract' => fn ($q) => $q->withTrashed(),
                'contract.tenant' => fn ($q) => $q->withTrashed(),
                'contract.room' => fn ($q) => $q->withTrashed(),
                'contract.bedSpace',
                'lineItems.utility',
                'payments.processor',
            ])
            ->withFinancials()
            ->find($billingId);
    }

    /**
     * Internal input validation for billing generation.
     */
    private static function validateCreateInput(array $data, bool $withLock = false): void
    {
        $contractQuery = Contract::query();
        if ($withLock) {
            $contractQuery->lockForUpdate();
        }
        
        $contract = $contractQuery->find((int) $data['contract_id']);
        if (! $contract || ! in_array($contract->status, [ContractStatus::ACTIVE, ContractStatus::PENDING_PAYMENT])) {
            throw ValidationException::withMessages(['contract_id' => ['Contract missing/inactive.']]);
        }

        // Rule BR-BIL-002: Duplicate Prevention
        // CCR-010: Inclusive overlap check to prevent collision in contract transitions
        $newFrom = Carbon::parse($data['billing_period_from'])->toDateString();
        $newTo = Carbon::parse($data['billing_period_to'])->toDateString();

        $checkQuery = Billing::where('contract_id', (int) $data['contract_id'])
            ->where(function ($q) use ($newFrom, $newTo) {
                $q->whereDate('billing_period_from', '<=', $newTo)
                    ->whereDate('billing_period_to', '>=', $newFrom);
            });
            
        if ($withLock) {
            $checkQuery->sharedLock();
        }

        if ($checkQuery->exists()) {
            throw ValidationException::withMessages([
                'billing_period_from' => ['A billing cycle already exists for this contract that overlaps with the selected period.'],
            ]);
        }
    }
}
