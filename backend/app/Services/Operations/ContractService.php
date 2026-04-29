<?php

namespace App\Services\Operations;

use App\Services\Concerns\ManagesWorkflows;
use App\Models\BedSpace;
use App\Models\Contract;
use App\Models\Room;
use App\Models\User;
use App\Enums\ContractStatus;
use App\Enums\ContractType;
use App\Enums\RoomType;
use App\Enums\BedSpaceStatus;
use App\Services\Operations\BillingService;
use App\Services\Operations\RoomService;
use App\Services\Operations\TenantService;
use App\Support\Financials;
use App\Support\Inventory;
use App\Support\OperationalHardening;
use App\Models\MeterReading;
use App\Enums\BillingStatus;
use Illuminate\Support\Facades\DB;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Validation\ValidationException;

/**
 * Handles the rental agreement lifecycle, including check-in, activation, 
 * and move-out workflows.
 */
class ContractService
{
    use ManagesWorkflows;

    /**
     * Create a new contract with overlap prevention.
     * 
     * Implementation details:
     * - Sets bed status to 'occupied' upon creation.
     * - Uses contract_id for relational mapping.
     * - Sets initial status to 'pending_payment'.
     * 
     * @param User $actor The staff member performing the action.
     * @param array $data Input details (tenant_id, bed_space_id, dates, monthly_rate).
     * @return Contract
     * @throws ValidationException
     */
    public static function create(User $actor, array $data): Contract
    {
        // Compatibility fallback: if bed_space_id is missing but room_id is provided,
        // auto-pick a vacant bed if it's a private/solo room.
        if (empty($data['bed_space_id']) && !empty($data['room_id'])) {
            $room = Room::find((int) $data['room_id']);
            if ($room && $room->room_type === RoomType::PRIVATE) {
                $bed = $room->bedSpaces()->where('status', BedSpaceStatus::VACANT)->first();
                if ($bed) {
                    $data['bed_space_id'] = $bed->bed_space_id;
                } else {
                    throw ValidationException::withMessages([
                        'room_id' => ['This room is either occupied or has no bed space configured.'],
                    ]);
                }
            }
        }

        self::validateCreateInput($data);

        return self::runWriteWorkflow(
            actorId: $actor->user_id,
            action: 'TENANT_CHECKIN',
            payload: [
                'tenant_id' => $data['tenant_id'],
                'bed_space_id' => $data['bed_space_id'],
                'monthly_rate_fact' => $data['monthly_rate'] ?? 0,
                'deposit_fact' => $data['deposit_amount'] ?? 0,
            ],
            operation: function () use ($actor, $data): Contract {
                Inventory::guardOverlaps((int) $data['tenant_id'], $data['bed_space_id'] ?? null, $data['move_in_date'] ?? null);

                // Fetch room rate if not overridden
                $bedSpace = BedSpace::with('room')->find((int) $data['bed_space_id']);
                $monthlyRate = $data['monthly_rate'] ?? $bedSpace->room->monthly_rate;

                $contract = Contract::create([
                    'tenant_id' => $data['tenant_id'],
                    'bed_space_id' => $data['bed_space_id'],
                    'created_by' => $actor->user_id,
                    'contract_type' => $data['contract_type'] ?? ContractType::FIXED_TERM,
                    'move_in_date' => $data['move_in_date'],
                    'expected_move_out_date' => $data['expected_move_out'] ?? null,
                    'deposit_amount' => $data['deposit_amount'] ?? 0,
                    'monthly_rate' => $monthlyRate,
                    'monthly_rate_override' => $data['monthly_rate_override'] ?? null,
                    'status' => ContractStatus::PENDING_PAYMENT,
                    'notes' => $data['notes'] ?? null,
                    'idempotency_key' => $data['idempotency_key'] ?? null,
                ]);

                // Update bed space status to occupied
                RoomService::occupyBedSpace($actor, $bedSpace);

                // Auto-initialize first billing cycle (optional, but standard)
                BillingService::initializeContractBilling($actor, (int) $contract->contract_id);

                return $contract->fresh(['tenant', 'room', 'bedSpace', 'creator', 'latestBilling']);
            },
            resultDetails: fn(Contract $contract): array => [
                'contract_id' => $contract->contract_id,
                'bed_space_id' => $contract->bed_space_id,
            ]
        );
    }

    /**
     * Paginated contract list with optional filters.
     * 
     * @param array $filters
     * @param int $page
     * @param int $perPage
     * @return LengthAwarePaginator<\App\Models\Contract>
     */
    public static function listPaginated(array $filters, int $page, int $perPage): LengthAwarePaginator
    {
        $query = Contract::query()->with([
            'tenant' => fn($q) => $q->withTrashed(),
            'room',
            'bedSpace',
            'creator',
            'latestBilling'
        ]);

        if (!empty($filters['tenant_id'])) {
            $query->where('tenant_id', (int) $filters['tenant_id']);
        }

        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (!empty($filters['q'])) {
            $needle = trim((string) $filters['q']);
            $query->where(function ($w) use ($needle): void {
                $w->where('contracts.contract_id', 'like', "%{$needle}%")
                    ->orWhereHas('tenant', function ($t) use ($needle): void {
                        $t->where('first_name', 'like', "%{$needle}%")
                            ->orWhere('last_name', 'like', "%{$needle}%")
                            ->orWhereRaw("CONCAT(first_name, ' ', last_name) LIKE ?", ["%{$needle}%"]);
                    })
                    ->orWhereHas('room', function ($r) use ($needle): void {
                        $r->where('room_code', 'like', "%{$needle}%");
                    });
            });
        }

        $paginator = $query->orderByDesc('contract_id')
            ->paginate($perPage, ['*'], 'page', $page);

        // Optimization: only load unbilled readings for active contract lists (e.g. Billing Wizard)
        if (isset($filters['status']) && $filters['status'] === 'active') {
            foreach ($paginator as $contract) {
                $contract->unbilled_readings = self::getUnbilledReadings($contract);
            }
        }

        return $paginator;
    }

    public static function getById(int $id): ?Contract
    {
        $contract = Contract::with([
            'tenant' => fn($q) => $q->withTrashed(),
            'room',
            'bedSpace',
            'creator',
            'latestBilling'
        ])
            ->find($id);

        if ($contract) {
            $contract->unbilled_readings = self::getUnbilledReadings($contract);
        }

        return $contract;
    }

    /**
     * Retrieve readings that haven't been associated with a billing record yet.
     */
    public static function getUnbilledReadings(Contract $contract): \Illuminate\Support\Collection
    {
        $roomId = $contract->room->room_id;

        // Find meters currently or previously assigned to this room
        return MeterReading::query()
            ->with(['meter.utility'])
            ->whereIn('meter_id', function ($q) use ($roomId) {
                $q->select('meter_id')
                    ->from('meter_assignments')
                    ->where('room_id', $roomId);
            })
            ->whereNotExists(function ($q) use ($contract) {
                $q->select(DB::raw(1))
                    ->from('billing_line_items')
                    ->join('billing', 'billing.billing_id', '=', 'billing_line_items.billing_id')
                    ->whereColumn('billing_line_items.reading_id', 'meter_readings.reading_id')
                    ->where('billing.contract_id', $contract->contract_id);
            })
            ->orderBy('reading_date', 'desc')
            ->get()
            ->map(function (MeterReading $reading) use ($contract) {
                // Flatten for frontend consumption
                $r = $reading->toArray();
                $r['utility_name'] = $reading->meter->utility->name;
                $r['utility_type'] = strtolower($reading->meter->utility->name); // for legacy FE compatibility
                $r['unit'] = $reading->meter->utility->unit_of_measurement;
                $r['calculated_amount'] = Financials::computeUtilityCost($reading->meter_id, (float) $reading->reading_value);
                return $r;
            });
    }

    /**
     * Update contract metadata (locked for duration - BR-CON-005).
     */
    public static function update(User $actor, Contract $contract, array $data): Contract
    {
        // Prevent status and date modification via generic update
        if (isset($data['status']) && $data['status'] !== $contract->status->value) {
            throw ValidationException::withMessages([
                'status' => ['Contract status cannot be modified via generic update. Use specialized workflows.'],
            ]);
        }

        return self::runWriteWorkflow(
            actorId: $actor->user_id,
            action: 'UPDATE_CONTRACT',
            payload: ['contract_id' => $contract->contract_id, 'old_rate_fact' => $contract->monthly_rate],
            operation: function () use ($contract, $data): Contract {
                if (isset($data['monthly_rate_override'])) {
                    $oldRate = (float) ($contract->monthly_rate_override ?? $contract->monthly_rate);
                    OperationalHardening::validateRentControlCap($oldRate, (float) $data['monthly_rate_override']);
                }

                $contract->update($data);
                return $contract->fresh(['tenant', 'room', 'bedSpace']);
            }
        );
    }

    /**
     * Move-out workflow: complete contract, vacate bed, sync room status.
     */
    public static function moveOut(User $actor, Contract $contract, array $data): Contract
    {
        $actualMoveOut = $data['actual_move_out'] ?? null;

        if (empty($actualMoveOut)) {
            throw ValidationException::withMessages([
                'actual_move_out' => ['Actual move-out date is required.'],
            ]);
        }

        if ($contract->status !== ContractStatus::ACTIVE) {
            throw ValidationException::withMessages([
                'contract' => ['Only active contracts can be moved out.'],
            ]);
        }

        if (\Illuminate\Support\Carbon::parse($actualMoveOut)->lt(\Illuminate\Support\Carbon::parse($contract->move_in_date))) {
            throw ValidationException::withMessages([
                'actual_move_out' => ['Actual move-out date cannot be before move-in date.'],
            ]);
        }

        // Rule: Gate Pass / Clearance (No outstanding bills)
        $totalOwed = Financials::getOutstandingBalance($contract->contract_id);

        if ($totalOwed > 0.01) {
            throw ValidationException::withMessages([
                'contract' => [
                    sprintf('Tenant has an outstanding balance of %s. All bills must be settled before move-out.', Financials::formatCurrency($totalOwed))
                ],
            ]);
        }

        return self::runWriteWorkflow(
            actorId: $actor->user_id,
            action: 'TENANT_MOVEOUT',
            payload: ['contract_id' => $contract->contract_id, 'move_out_date_fact' => $actualMoveOut],
            operation: function () use ($contract, $actualMoveOut, $data): Contract {
                $contract->update([
                    'actual_move_out_date' => $actualMoveOut,
                    'status' => ContractStatus::COMPLETED,
                    'notes' => $data['notes'] ?? $contract->notes,
                ]);

                if ($contract->bedSpace) {
                    $contract->bedSpace->status = BedSpaceStatus::VACANT;
                    $contract->bedSpace->save();
                }

                return $contract->fresh(['tenant', 'room', 'bedSpace', 'creator']);
            }
        );
    }

    /**
     * Activate contract after payment verification.
     */
    public static function activate(User $actor, Contract $contract): Contract
    {
        if ($contract->status !== ContractStatus::PENDING_PAYMENT) {
            throw ValidationException::withMessages([
                'contract' => ['Only contracts in pending_payment status can be activated.'],
            ]);
        }

        // Rule: Activation requires settlement of at least (Base Rent + Deposit)
        $totalPaid = Financials::getTotalPaid($contract->contract_id);
        $minRequired = $contract->monthly_rate + $contract->deposit_amount;

        if ($totalPaid < ($minRequired - 0.01)) {
            throw ValidationException::withMessages([
                'contract' => [
                    sprintf(
                        'Required settlement (Rent + Deposit) is %s. Total paid: %s.',
                        Financials::formatCurrency($minRequired),
                        Financials::formatCurrency($totalPaid)
                    )
                ],
            ]);
        }

        return self::runWriteWorkflow(
            actorId: $actor->user_id,
            action: 'ACTIVATE_LEASE',
            payload: ['contract_id' => $contract->contract_id, 'total_paid_fact' => $totalPaid],
            operation: function () use ($contract): Contract {
                $contract->update(['status' => ContractStatus::ACTIVE]);
                return $contract->fresh(['tenant', 'room', 'bedSpace']);
            }
        );
    }

    /**
     * Specialized void workflow: cancels a contract created in error (BR-CON-012).
     */
    public static function void(User $actor, Contract $contract, ?string $reason = null): Contract
    {
        // Rule: Only non-active contracts with no financial history can be voided
        if ($contract->status !== ContractStatus::PENDING_PAYMENT) {
            throw ValidationException::withMessages([
                'contract' => ['Only contracts in pending_payment status can be voided. Active or completed contracts must be terminated.'],
            ]);
        }

        $paymentCount = $contract->payments()->whereNull('voided_at')->count();

        if ($paymentCount > 0) {
            throw ValidationException::withMessages([
                'contract' => ['This contract has recorded payments and cannot be voided.'],
            ]);
        }

        $paidBillingCount = $contract->billings()->whereIn('status', [BillingStatus::PAID, BillingStatus::PARTIAL])->count();
        if ($paidBillingCount > 0) {
            throw ValidationException::withMessages([
                'contract' => ['This contract has settled or partially settled billings and cannot be voided.'],
            ]);
        }

        return self::runWriteWorkflow(
            actorId: $actor->user_id,
            action: 'VOID_CONTRACT',
            payload: ['contract_id' => $contract->contract_id, 'void_reason_fact' => $reason],
            operation: function () use ($contract, $reason): Contract {
                // Cascade voiding to all unpaid billings
                $contract->billings()->where('status', BillingStatus::UNPAID)->delete();

                // Release the bed lock immediately (triggering BedSpaceObserver)
                if ($contract->bedSpace) {
                    $contract->bedSpace->status = BedSpaceStatus::VACANT;
                    $contract->bedSpace->save();
                }

                $contract->update([
                    'status' => ContractStatus::VOIDED,
                    'notes' => ($reason ?: 'Contract voided by admin.') . ($contract->notes ? "\n" . $contract->notes : ''),
                ]);

                return $contract->fresh(['tenant', 'room', 'bedSpace']);
            }
        );
    }

    /**
     * Archive/Soft-delete a contract record.
     */
    public static function archive(User $actor, Contract $contract): Contract
    {
        if ($contract->status === ContractStatus::ACTIVE) {
            throw ValidationException::withMessages([
                'contract' => ['Active contracts cannot be archived. Process move-out first.'],
            ]);
        }

        return self::runWriteWorkflow(
            actorId: $actor->user_id,
            action: 'ARCHIVE_CONTRACT',
            payload: ['contract_id' => $contract->contract_id],
            operation: function () use ($contract): Contract {
                $contract->delete();
                return $contract;
            }
        );
    }

    /**
     * Restore an archived contract record.
     * 
     * @param User $actor The staff member performing the action.
     * @param int $id The ID of the archived contract.
     * @return Contract
     */
    public static function restore(User $actor, int $id): Contract
    {
        return self::runWriteWorkflow(
            actorId: $actor->user_id,
            action: 'RESTORE_CONTRACT',
            payload: ['contract_id' => $id],
            operation: function () use ($id): Contract {
                $contract = Contract::withTrashed()->findOrFail($id);
                $contract->restore();

                return $contract->fresh(['tenant', 'room', 'bedSpace']);
            }
        );
    }

    /**
     * Internal input validation for contract creation.
     */
    private static function validateCreateInput(array $data): void
    {
        $tenant = \App\Models\Tenant::find((int) $data['tenant_id']);
        if ($tenant && $tenant->status === \App\Enums\TenantStatus::ARCHIVED) {
            throw ValidationException::withMessages([
                'tenant_id' => ['Archived tenants cannot be assigned to new contracts.'],
            ]);
        }

        $bedSpace = BedSpace::with('room')->find((int) $data['bed_space_id']);
        if (!$bedSpace) {
            throw ValidationException::withMessages([
                'bed_space_id' => ['Bed space does not exist.'],
            ]);
        }

        // Rule: BR-CON-011 - Renewals are allowed on OCCUPIED bed spaces for the same tenant
        $isRenewal = false;
        if ($bedSpace->status === BedSpaceStatus::OCCUPIED) {
            $activeContract = Contract::where('bed_space_id', $bedSpace->bed_space_id)
                ->where('status', ContractStatus::ACTIVE)
                ->first();
            
            if ($activeContract && (int)$activeContract->tenant_id === (int)$data['tenant_id']) {
                $isRenewal = true;
            } else {
                throw ValidationException::withMessages([
                    'bed_space_id' => ['Bed space is currently occupied by another resident.'],
                ]);
            }
        }

        if (!$isRenewal && $bedSpace->status !== BedSpaceStatus::VACANT) {
            throw ValidationException::withMessages([
                'bed_space_id' => ['Bed space is not vacant or available for new registration.'],
            ]);
        }

        if (!empty($data['room_id']) && (int) $bedSpace->room_id !== (int) $data['room_id']) {
            throw ValidationException::withMessages([
                'bed_space_id' => ['Selected bed space does not belong to the selected room.'],
            ]);
        }

        // Forensic Rule: BR-MET-002 - Hardware Guard for Metered Rooms
        if ($bedSpace->room->is_metered) {
            $meterCount = DB::table('meter_assignments')
                ->where('room_id', $bedSpace->room_id)
                ->whereNull('valid_to')
                ->count();
            
            if ($meterCount === 0) {
                throw ValidationException::withMessages([
                    'room_id' => ['This room is configured as "Metered" but has no active meters assigned.'],
                ]);
            }
        }

        $monthlyRate = (float) ($data['monthly_rate'] ?? $bedSpace->room->monthly_rate);
        OperationalHardening::validateDepositCap($monthlyRate, (float) ($data['deposit_amount'] ?? 0));
    }
}
