<?php

namespace App\Services\Operations;

use App\Services\Concerns\ManagesWorkflows;
use App\Models\BedSpace;
use App\Models\Contract;
use App\Models\Room;
use App\Models\Tenant;
use App\Models\User;
use App\Services\Operations\BillingService;
use App\Support\Financials;
use App\Support\Inventory;
use App\Support\Compliance;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Validation\ValidationException;

/**
 * ContractService
 * 
 * Manages the rental agreement lifecycle, including check-in, activation, 
 * and move-out workflows. Enforces Philippine Rent Control laws (R.A. 9653).
 */
class ContractService
{
    use ManagesWorkflows;

    /**
     * Create contract with overlap prevention and transaction safety.
     * 
     * Forensic Rules:
     * - Rule: Primary key `contract_id` used for forensic mapping.
     * - Rule: Initial status set to 'pending_payment' per Philippine 1+1/2+1 policy.
     * - Validation: Rent control cap (1% move-in increase) enforced for affordable units.
     * 
     * @param User $actor The staff member performing the action.
     * @param array $data Input details (tenant_id, bed_space_id, dates, financial overrides).
     * @return Contract
     * @throws ValidationException
     */
    public static function create(User $actor, array $data): Contract
    {
        // Compatibility fallback: if bed_space_id is missing but room_id is a solo room,
        // auto-pick a vacant bed. Shared units must provide bed_space_id.
        if (empty($data['bed_space_id']) && ! empty($data['room_id'])) {
            $roomFromRoomId = Room::find((int) $data['room_id']);
            if ($roomFromRoomId && $roomFromRoomId->room_type === Room::TYPE_SOLO) {
                $bed = $roomFromRoomId->bedSpaces()->where('status', BedSpace::STATUS_VACANT)->first();
                if ($bed) {
                    $data['bed_space_id'] = $bed->bed_space_id;
                } else {
                    throw ValidationException::withMessages([
                        'room_id' => ['This solo room is either occupied or has no bed space configured.'],
                    ]);
                }
            }
        }

        self::validateCreateInput($data);
        Compliance::validateRentControlCap((int) $data['tenant_id'], (int) $data['bed_space_id'], (float) ($data['monthly_rate_override'] ?? 0));

        // Enforce mandatory setup billing for the 1+1 Capital workflow
        $shouldInitializeBilling = true;

        return self::runWriteWorkflow(
            actorId: $actor->user_id,
            action: 'TENANT_CHECKIN',
            txnReference: self::buildTxnReference('CHK'),
            payload: ['tenant_id' => $data['tenant_id']],
            operation: function () use ($actor, $data, $shouldInitializeBilling): Contract {
                Inventory::guardOverlaps((int) $data['tenant_id'], $data['bed_space_id'] ?? null);

                $contract = Contract::create([
                    'tenant_id' => $data['tenant_id'],
                    'bed_space_id' => $data['bed_space_id'],
                    'created_by' => $actor->user_id,
                    'move_in_date' => $data['move_in_date'],
                    'expected_move_out_date' => $data['expected_move_out'] ?? null,
                    'deposit_amount' => $data['deposit_amount'] ?? 0,
                    'monthly_rate_override' => $data['monthly_rate_override'] ?? null,
                    'status' => Contract::STATUS_PENDING_PAYMENT, 
                    'notes' => $data['notes'] ?? null,
                ]);

                TenantService::syncStatus((int) $contract->tenant_id);

                if ($shouldInitializeBilling) {
                    BillingService::initializeContractBilling($actor, (int) $contract->contract_id);
                }

                return $contract->fresh(['tenant', 'room', 'bedSpace', 'creator', 'latestBilling']);

            },
            resultDetails: fn (Contract $contract): array => [
                'contract_id' => $contract->contract_id,
                'bed_space_id' => $contract->bed_space_id,
            ]
        );
    }

    /**
     * Paginated contract list with optional filters.
     * 
     * @param array $filters (tenant_id, status, q).
     * @param int $page
     * @param int $perPage
     * @return LengthAwarePaginator
     */
    public static function listPaginated(array $filters, int $page, int $perPage): LengthAwarePaginator
    {
        $query = Contract::with(['tenant', 'room', 'bedSpace', 'creator', 'latestBilling', 'addOns']);

        if (! empty($filters['tenant_id'])) {
            $query->where('tenant_id', (int) $filters['tenant_id']);
        }

        if (! empty($filters['status'])) {
            $query->where('status', (string) $filters['status']);
        }

        if (! empty($filters['q'])) {
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

        return $query->orderByDesc('contract_id')
            ->paginate($perPage, ['*'], 'page', $page);
    }

    /**
     * Authoritative retrieval of contract with unified relations.
     */
    public static function getById(int $id): ?Contract
    {
        return Contract::with(['tenant', 'room', 'bedSpace', 'creator', 'latestBilling'])
            ->find($id);
    }

    /**
     * Update an existing contract agreement.
     */
    public static function update(User $actor, Contract $contract, array $data): Contract
    {
        return self::runWriteWorkflow(
            actorId: $actor->user_id,
            action: 'UPDATE_CONTRACT',
            txnReference: self::buildTxnReference('CONTRACT-UPD'),
            payload: ['contract_id' => $contract->contract_id],
            operation: function () use ($contract, $data): Contract {
                $contract->update($data);
                return $contract->fresh(['tenant', 'room', 'bedSpace']);
            }
        );
    }

    /**
     * Move-out workflow: complete contract, vacate bed, sync room status.
     * 
     * Forensic Rules:
     * - Constraint: Gate Pass Denied if tenant has an outstanding balance > ₱0.01.
     * - Rule: Tenant status reverts to 'moved_out' unless other active contracts exist.
     * 
     * @param User $actor The staff member performing the action.
     * @param Contract $contract The contract target.
     * @param array $data Input including actual_move_out date.
     * @return Contract
     * @throws ValidationException
     */
    public static function moveOut(User $actor, Contract $contract, array $data): Contract
    {
        $actualMoveOut = $data['actual_move_out'] ?? null;

        if (empty($actualMoveOut)) {
            throw ValidationException::withMessages([
                'actual_move_out' => ['Actual move-out date is required.'],
            ]);
        }

        if ($contract->status !== 'active') {
            throw ValidationException::withMessages([
                'contract' => ['Only active contracts can be moved out.'],
            ]);
        }

        // Rule: Gate Pass / Clearance (No outstanding bills)
        $totalOwed = Financials::getOutstandingBalance($contract->contract_id);

        if ($totalOwed > 0.01) {
            throw ValidationException::withMessages([
                'contract' => [
                    sprintf('Gate Pass Denied: Tenant has an outstanding balance of %s. All bills must be settled before move-out.', Financials::formatCurrency($totalOwed))
                ],
            ]);
        }

        return self::runWriteWorkflow(
            actorId: $actor->user_id,
            action: 'TENANT_MOVEOUT',
            txnReference: self::buildTxnReference('OUT'),
            payload: ['contract_id' => $contract->contract_id],
            operation: function () use ($contract, $actualMoveOut, $data): Contract {
                $targetStatus = $data['status'] ?? Contract::STATUS_COMPLETED;

                $contract->update([
                    'actual_move_out_date' => $actualMoveOut,
                    'status' => $targetStatus,
                    'is_cleared' => true,
                    'notes' => $data['notes'] ?? $contract->notes,
                ]);

                if ($contract->bed_space_id) {
                    BedSpace::where('bed_space_id', $contract->bed_space_id)->update(['status' => BedSpace::STATUS_VACANT]);
                }

                if ($contract->room) {
                    RoomService::syncStatusAndCapacity($contract->room);
                }

                TenantService::syncStatus((int) $contract->tenant_id);

                return $contract->fresh(['tenant', 'room', 'bedSpace', 'creator']);
            },
            resultDetails: fn (Contract $contract): array => [
                'contract_id' => $contract->contract_id,
                'move_out_date' => $actualMoveOut,
            ]
        );
    }

    /**
     * Activate contract after payment verification (1+1 or 2+1 Rule).
     * 
     * Forensic Rules:
     * - Condition: Requires settlement of Rent + Deposit before activation.
     * - Side-Effect: Transitions bed space status to 'occupied'.
     * 
     * @param User $actor The staff member performing the action.
     * @param Contract $contract
     * @return Contract
     * @throws ValidationException
     */
    public static function activate(User $actor, Contract $contract): Contract
    {
        if ($contract->status !== Contract::STATUS_PENDING_PAYMENT) {
            throw ValidationException::withMessages([
                'contract' => ['Only contracts in pending_payment status can be activated.'],
            ]);
        }
        
        // Rule: Activation requires settlement of at least (Base Rent + Deposit)
        $totalPaid = Financials::getTotalPaid($contract->contract_id);
        $minRequired = ($contract->monthly_rate_override ?: $contract->room->monthly_rate) + $contract->deposit_amount;

        if ($totalPaid < ($minRequired - 0.01)) {
            throw ValidationException::withMessages([
                'contract' => [
                    sprintf('Activation Denied: Required settlement (Rent + Deposit) is %s. Total paid: %s. Initial billing must be generated and settled.', 
                        Financials::formatCurrency($minRequired), 
                        Financials::formatCurrency($totalPaid)
                    )
                ],
            ]);
        }

        return self::runWriteWorkflow(
            actorId: $actor->user_id,
            action: 'ACTIVATE_LEASE',
            txnReference: self::buildTxnReference('ACT'),
            payload: [
                'contract_id' => $contract->contract_id,
                'min_required' => $minRequired,
                'actual_paid' => $totalPaid,
            ],
            operation: function () use ($actor, $contract): Contract {
                $contract->update(['status' => Contract::STATUS_ACTIVE]);

                if ($contract->bed_space_id) {
                    $bed = BedSpace::find($contract->bed_space_id);
                    if ($bed) {
                        RoomService::occupyBedSpace($actor, $bed);
                    }
                }

                return $contract->fresh(['tenant', 'room', 'bedSpace']);
            },
            resultDetails: fn(Contract $contract) => [
                'contract_id' => $contract->contract_id,
                'status' => Contract::STATUS_ACTIVE,
                'activated_at' => now()->toIso8601String()
            ]
        );
    }

    /**
     * Archive/Soft-delete a contract record.
     * 
     * @param User $actor
     * @param Contract $contract
     * @return Contract
     * @throws ValidationException If contract is currently active.
     */
    public static function archive(User $actor, Contract $contract): Contract
    {
        if ((string) $contract->status === Contract::STATUS_ACTIVE) {
            throw ValidationException::withMessages([
                'contract' => ['Active contracts cannot be archived. Process move-out first.'],
            ]);
        }

        return self::runWriteWorkflow(
            actorId: $actor->user_id,
            action: 'ARCHIVE_CONTRACT',
            txnReference: self::buildTxnReference('CONTRACT-ARC'),
            payload: ['contract_id' => $contract->contract_id, 'prev_status' => $contract->status],
            operation: function () use ($contract): Contract {
                // Forensic Rule: If voiding a pending registration, record the intent before deleting
                if ($contract->status === Contract::STATUS_PENDING_PAYMENT) {
                    $contract->status = Contract::STATUS_VOIDED;
                    $contract->save();
                }

                $contract->delete();
                return $contract;
            }
        );
    }

    /**
     * Restore a soft-deleted contract.
     * 
     * @param User $actor
     * @param int $id
     * @return Contract
     */
    public static function restore(User $actor, int $id): Contract
    {
        return self::runWriteWorkflow(
            actorId: $actor->user_id,
            action: 'RESTORE_CONTRACT',
            txnReference: self::buildTxnReference('CONTRACT-RES'),
            payload: ['contract_id' => $id],
            operation: function () use ($id): Contract {
                $contract = Contract::withTrashed()->findOrFail($id);
                $contract->restore();
                return $contract;
            }
        );
    }

    /**
     * Internal input validation for contract creation.
     */
    private static function validateCreateInput(array $data): void
    {
        $tenant = Tenant::find($data['tenant_id']);
        if (! $tenant || $tenant->status === Tenant::STATUS_ARCHIVED) {
            throw ValidationException::withMessages([
                'tenant_id' => ['Tenant must exist and not be archived.'],
            ]);
        }

        $bedSpace = BedSpace::with('room')->find((int) $data['bed_space_id']);
        if (! $bedSpace || ! $bedSpace->room) {
            throw ValidationException::withMessages([
                'bed_space_id' => ['Bed space does not exist.'],
            ]);
        }

        // Philippine Rule (R.A. 9653): Max 2 months deposit
        $monthlyRate = $data['monthly_rate_override'] ?? ($bedSpace->room->monthly_rate ?? 0);
        Compliance::validateDepositCap((float)$monthlyRate, (float)($data['deposit_amount'] ?? 0));

        if ($bedSpace->status !== BedSpace::STATUS_VACANT) {
            throw ValidationException::withMessages([
                'bed_space_id' => ['Bed space is not vacant.'],
            ]);
        }
    }
}
