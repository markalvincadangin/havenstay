<?php

namespace App\Services;

use App\Services\Concerns\ManagesWorkflows;
use App\Models\BedSpace;
use App\Models\Contract;
use App\Models\Room;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ContractService
{
    use ManagesWorkflows;

    /**
     * Create contract with overlap prevention and transaction safety.
     */
    public static function create(User $actor, array $data): Contract
    {
        if (array_key_exists('monthly_rate', $data) && ! array_key_exists('monthly_rate_override', $data)) {
            $data['monthly_rate_override'] = $data['monthly_rate'];
        }

        // Compatibility fallback: if bed_space_id is missing but room_id is a solo room,
        // auto-pick a vacant bed. Shared units must provide bed_space_id.
        if (empty($data['bed_space_id']) && ! empty($data['room_id'])) {
            $roomFromRoomId = Room::find((int) $data['room_id']);
            if ($roomFromRoomId && $roomFromRoomId->room_type === 'solo') {
                $bed = $roomFromRoomId->bedSpaces()->where('status', 'vacant')->first();
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

        return self::runWriteWorkflow(
            actorId: $actor->user_id,
            action: 'TENANT_CHECKIN',
            txnReference: self::buildTxnReference('CHK'),
            payload: ['tenant_id' => $data['tenant_id']],
            operation: function () use ($actor, $data): Contract {
                self::guardActiveOverlaps((int) $data['tenant_id'], $data['bed_space_id'] ?? null);

                $contract = Contract::create([
                    'tenant_id' => $data['tenant_id'],
                    'bed_space_id' => $data['bed_space_id'],
                    'created_by' => $actor->user_id,
                    'move_in_date' => $data['move_in_date'],
                    'expected_move_out_date' => $data['expected_move_out'] ?? null,
                    'deposit_amount' => $data['deposit_amount'] ?? 0,
                    'monthly_rate_override' => $data['monthly_rate_override'] ?? null,
                    'status' => 'active',
                    'notes' => $data['notes'] ?? null,
                ]);

                if (! empty($data['bed_space_id'])) {
                    $bed = BedSpace::find($data['bed_space_id']);
                    if ($bed) {
                        RoomService::occupyBedSpace($actor, $bed);
                    }
                }

                Tenant::where('tenant_id', $contract->tenant_id)->update(['status' => 'active']);

                return $contract->fresh(['tenant', 'room', 'bedSpace', 'creator']);
            },
            resultDetails: fn (Contract $contract): array => [
                'contract_id' => $contract->contract_id,
                'bed_space_id' => $contract->bed_space_id,
            ]
        );
    }

    public static function getById(int $contractId): ?Contract
    {
        return Contract::with(['tenant', 'room', 'bedSpace', 'creator'])->find($contractId);
    }

    /**
     * Paginated contract list with optional filters.
     *
     * @param  array{tenant_id?:int|string,status?:string,q?:string}  $filters
     */
    public static function listPaginated(array $filters, int $page, int $perPage): LengthAwarePaginator
    {
        $query = Contract::with(['tenant', 'room', 'bedSpace', 'creator', 'latestBilling']);

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

        if ($actualMoveOut < $contract->move_in_date) {
            throw ValidationException::withMessages([
                'actual_move_out' => ['Actual move-out date cannot be earlier than move-in date.'],
            ]);
        }

        if ($contract->status !== 'active') {
            throw ValidationException::withMessages([
                'contract' => ['Only active contracts can be moved out.'],
            ]);
        }

        return self::runWriteWorkflow(
            actorId: $actor->user_id,
            action: 'TENANT_MOVEOUT',
            txnReference: self::buildTxnReference('OUT'),
            payload: ['contract_id' => $contract->contract_id],
            operation: function () use ($contract, $actualMoveOut, $data): Contract {
                $contract->update([
                    'actual_move_out_date' => $actualMoveOut,
                    'status' => 'completed',
                    'notes' => $data['notes'] ?? $contract->notes,
                ]);

                if ($contract->bed_space_id) {
                    BedSpace::where('bed_space_id', $contract->bed_space_id)->update(['status' => 'vacant']);
                }

                if ($contract->room) {
                    RoomService::syncStatusAndCapacity($contract->room);
                }

                self::syncTenantStatus((int) $contract->tenant_id);

                return $contract->fresh(['tenant', 'room', 'bedSpace', 'creator']);
            },
            resultDetails: fn (Contract $contract): array => [
                'contract_id' => $contract->contract_id,
                'move_out_date' => $actualMoveOut,
            ]
        );
    }

    /**
     * Update contract details including status change safety.
     */
    public static function update(User $actor, Contract $contract, array $data): Contract
    {
        $oldStatus = $contract->status;
        $newStatus = $data['status'] ?? $oldStatus;
        $isTermination = ($oldStatus === 'active' && $newStatus !== 'active');

        return self::runWriteWorkflow(
            actorId: $actor->user_id,
            action: $isTermination ? 'TERMINATE_CONTRACT' : 'UPDATE_CONTRACT',
            txnReference: self::buildTxnReference('CONTRACT-UP'),
            payload: [
                'contract_id' => $contract->contract_id,
                'action'      => $isTermination ? 'terminate' : 'modify'
            ],
            operation: function () use ($actor, $contract, $data, $oldStatus, $newStatus): Contract {
                // If status is moving from active to something else, vacating the bed is mandatory
                if ($oldStatus === 'active' && $newStatus !== 'active') {
                    if ($contract->bed_space_id) {
                        BedSpace::where('bed_space_id', $contract->bed_space_id)->update(['status' => 'vacant']);
                    }
                }

                $contract->update($data);

                if ($contract->room) {
                    RoomService::syncStatusAndCapacity($contract->room);
                }

                self::syncTenantStatus((int) $contract->tenant_id);

                return $contract->fresh(['tenant', 'room', 'bedSpace', 'creator']);
            },
            resultDetails: fn (Contract $contract): array => ['new_status' => $newStatus]
        );
    }

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
            payload: ['contract_id' => $contract->contract_id],
            operation: function () use ($contract): Contract {
                $contract->delete();
                return $contract;
            },
            resultDetails: fn (Contract $contract): array => ['contract_id' => $contract->contract_id]
        );
    }

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
            },
            resultDetails: fn (Contract $contract): array => ['contract_id' => $id]
        );
    }


    private static function validateCreateInput(array $data): void
    {
        $tenant = Tenant::find($data['tenant_id']);
        if (! $tenant || $tenant->status === 'archived') {
            throw ValidationException::withMessages([
                'tenant_id' => ['Tenant must exist and not be archived.'],
            ]);
        }

        if (empty($data['bed_space_id'])) {
            throw ValidationException::withMessages([
                'bed_space_id' => ['Bed space is required for contract creation.'],
            ]);
        }

        $bedSpace = BedSpace::with('room')->find((int) $data['bed_space_id']);
        if (! $bedSpace || ! $bedSpace->room) {
            throw ValidationException::withMessages([
                'bed_space_id' => ['Bed space does not exist.'],
            ]);
        }

        $room = $bedSpace->room;

        // Backwards-compatibility: if room_id is provided, ensure it matches the bed's room.
        if (! empty($data['room_id']) && (int) $data['room_id'] !== (int) $room->room_id) {
            throw ValidationException::withMessages([
                'bed_space_id' => ['Bed space does not belong to the selected room.'],
            ]);
        }

        if (($data['deposit_amount'] ?? 0) < 0) {
            throw ValidationException::withMessages([
                'deposit_amount' => ['Deposit amount must be non-negative.'],
            ]);
        }

        if (! empty($data['expected_move_out']) && $data['expected_move_out'] <= $data['move_in_date']) {
            throw ValidationException::withMessages([
                'expected_move_out' => ['Expected move-out date must be after move-in date.'],
            ]);
        }

        if ($bedSpace->status !== 'vacant') {
            throw ValidationException::withMessages([
                'bed_space_id' => ['Bed space is not vacant.'],
            ]);
        }
    }

    private static function guardActiveOverlaps(int $tenantId, ?int $bedSpaceId): void
    {
        $hasTenantOverlap = Contract::where('tenant_id', $tenantId)
            ->where('status', 'active')
            ->exists();

        if ($hasTenantOverlap) {
            throw ValidationException::withMessages([
                'tenant_id' => ['Tenant already has an active contract.'],
            ]);
        }

        if ($bedSpaceId) {
            $hasBedSpaceOverlap = Contract::where('bed_space_id', $bedSpaceId)
                ->where('status', 'active')
                ->exists();

            if ($hasBedSpaceOverlap) {
                throw ValidationException::withMessages([
                    'bed_space_id' => ['Bed space is already assigned to an active contract.'],
                ]);
            }
        }
    }

    private static function syncTenantStatus(int $tenantId): void
    {
        $tenant = Tenant::find($tenantId);
        if (! $tenant || $tenant->status === 'archived') {
            return;
        }

        $hasActive = Contract::where('tenant_id', $tenantId)
            ->where('status', 'active')
            ->exists();

        $newStatus = $hasActive ? 'active' : 'moved_out';

        if ($tenant->status !== $newStatus) {
            $tenant->update(['status' => $newStatus]);
        }
    }


}
