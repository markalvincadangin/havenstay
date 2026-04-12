<?php

namespace App\Services;

use App\Models\BedSpace;
use App\Models\Contract;
use App\Models\Room;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ContractService
{
    /**
     * FR-016..FR-018: Create contract with overlap prevention and transaction safety.
     */
    public static function create(User $actor, array $data): Contract
    {
        $room = Room::find($data['room_id']);
        if ($room && $room->room_type === 'solo' && empty($data['bed_space_id'])) {
            $bed = $room->bedSpaces()->where('status', 'vacant')->first();
            if ($bed) {
                $data['bed_space_id'] = $bed->bed_space_id;
            } else {
                throw ValidationException::withMessages([
                    'room_id' => ['This solo room is either occupied or has no bed space configured.'],
                ]);
            }
        }

        self::validateCreateInput($data);
        self::guardActiveOverlaps((int) $data['tenant_id'], $data['bed_space_id'] ?? null);

        // CCR-007: Transaction log entry
        $started = TransactionService::logStarted(
            'tenant_check_in',
            $actor->user_id,
            'tenants',
            (string) $data['tenant_id']
        );
        $txLogId = $started['tx_log_id'];

        if (Auth::check()) {
            AuditService::setAuditUserContext(Auth::id());
        }
        AuditService::setCorrelationContext($started['correlation_id']);

        try {
            // CCR-006: Explicit transaction — START TRANSACTION / COMMIT / ROLLBACK
            $contract = DB::transaction(function () use ($actor, $data): Contract {
                // ... same implementation ...
                $contract = Contract::create([
                    'tenant_id' => $data['tenant_id'],
                    'bed_space_id' => $data['bed_space_id'],
                    'created_by' => $actor->user_id,
                    'move_in_date' => $data['move_in_date'],
                    'expected_move_out_date' => $data['expected_move_out'] ?? null,
                    'deposit_amount' => $data['deposit_amount'] ?? 0,
                    'monthly_rate' => $data['monthly_rate'] ?? (Room::find($data['room_id'])->monthly_rate ?? 0.00),
                    'status' => 'active',
                    'notes' => $data['notes'] ?? null,
                ]);

                if (! empty($data['bed_space_id'])) {
                    $bed = BedSpace::find($data['bed_space_id']);
                    if ($bed) {
                        RoomService::occupyBedSpace($bed);
                    }
                }

                Tenant::where('tenant_id', $contract->tenant_id)->update(['status' => 'active']);

                return $contract;
            });

            TransactionService::logCommitted($txLogId, [
                'contract_id' => $contract->contract_id,
                'room_id' => $contract->bedSpace->room_id ?? null,
                'bed_space_id' => $contract->bed_space_id,
            ]);

            return $contract->fresh(['tenant', 'room', 'bedSpace', 'creator']);
        } catch (\Exception $e) {
            TransactionService::logRolledBack($txLogId, $e->getMessage());
            throw $e;
        } finally {
            AuditService::clearCorrelationContext();
        }
    }

    public static function getById(int $contractId): ?Contract
    {
        return Contract::with(['tenant', 'room', 'bedSpace', 'creator'])->find($contractId);
    }

    /**
     * FR-019, CCR-006: Move-out workflow with sp_move_out if available.
     */
    public static function moveOut(Contract $contract, array $data): Contract
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

        // CCR-007: Transaction log entry
        $started = TransactionService::logStarted(
            'tenant_move_out',
            Auth::id() ?? 0,
            'contracts',
            (string) $contract->contract_id
        );
        $txLogId = $started['tx_log_id'];

        if (Auth::check()) {
            AuditService::setAuditUserContext(Auth::id());
        }
        AuditService::setCorrelationContext($started['correlation_id']);

        try {
            // CCR-006: Explicit transaction — START TRANSACTION / COMMIT / ROLLBACK
            $result = DB::transaction(function () use ($contract, $actualMoveOut, $data): Contract {
                // CCR-003: UPDATE contract status and bed space
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

                return $contract;
            });

            TransactionService::logCommitted($txLogId, [
                'contract_id' => $contract->contract_id,
                'move_out_date' => $actualMoveOut,
            ]);

            return $result->fresh(['tenant', 'room', 'bedSpace', 'creator']);
        } catch (\Exception $e) {
            TransactionService::logRolledBack($txLogId, $e->getMessage());
            throw $e;
        } finally {
            AuditService::clearCorrelationContext();
        }
    }

    /**
     * Update contract details including status change safety.
     */
    public static function update(User $actor, Contract $contract, array $data): Contract
    {
        return DB::transaction(function () use ($actor, $contract, $data): Contract {
            $oldStatus = $contract->status;
            $newStatus = $data['status'] ?? $oldStatus;

            // Handle audit context
            AuditService::setAuditUserContext($actor->user_id);

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
        });
    }

    private static function validateCreateInput(array $data): void
    {
        $tenant = Tenant::find($data['tenant_id']);
        if (! $tenant || $tenant->status === 'archived') {
            throw ValidationException::withMessages([
                'tenant_id' => ['Tenant must exist and not be archived.'],
            ]);
        }

        $room = Room::find($data['room_id']);
        if (! $room) {
            throw ValidationException::withMessages([
                'room_id' => ['Room does not exist.'],
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

        if (! empty($data['bed_space_id'])) {
            $bedSpace = BedSpace::find($data['bed_space_id']);

            if (! $bedSpace) {
                throw ValidationException::withMessages([
                    'bed_space_id' => ['Bed space does not exist.'],
                ]);
            }

            if ((int) $bedSpace->room_id !== (int) $room->room_id) {
                throw ValidationException::withMessages([
                    'bed_space_id' => ['Bed space does not belong to the selected room.'],
                ]);
            }

            if ($bedSpace->status !== 'vacant') {
                throw ValidationException::withMessages([
                    'bed_space_id' => ['Bed space is not vacant.'],
                ]);
            }
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

    private static function mapDatabaseException(QueryException $e): void
    {
        $sqlState = $e->errorInfo[0] ?? (string) $e->getCode();

        if (in_array($sqlState, ['45000', '23000'], true)) {
            throw ValidationException::withMessages([
                'contract' => ['Contract operation failed due to integrity constraints.'],
            ]);
        }
    }
}
