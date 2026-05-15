<?php

namespace App\Support;

use App\Enums\BedSpaceStatus;
use App\Enums\ContractStatus;
use App\Enums\RoomStatus;
use App\Enums\RoomType;
use App\Models\Contract;
use App\Models\Room;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;

/**
 * Inventory
 *
 * Centralizes room and bed space state derivation and inventory guard logic.
 * Optimized for HavenStay Forensic v5.0 (Stateless Calculation Engine).
 */
class Inventory
{
    /**
     * Compute room status and capacity based on current occupancy facts.
     *
     * Forensic Rule: Macro status (available, unavailable, maintenance) is stored.
     * Micro occupancy (beds available) is derived via views/queries.
     *
     * This method is pure and does not write to the database.
     *
     * @return array{status: RoomStatus, capacity: int}
     */
    public static function computeRoomState(Room $room): array
    {
        // 1. Derive/Enforce Capacity
        $capacity = ($room->room_type === RoomType::PRIVATE) ? 1 : $room->bedSpaces->count();

        // 2. Derive Status (per BR-ROM-003)
        // A room is UNAVAILABLE if all beds are occupied or in maintenance.
        // A room is AVAILABLE if at least one bed is vacant (and not in maintenance).
        // A room is in MAINTENANCE only if explicitly set by staff (macro state).

        $hasVacant = $room->bedSpaces->where('status', BedSpaceStatus::VACANT)->isNotEmpty();
        $currentStatus = $room->status;

        // BR-ROM-007: Decommissioned status is authoritative and cannot be overwritten by bed syncs
        if ($currentStatus === RoomStatus::DECOMMISSIONED) {
            return [
                'status' => RoomStatus::DECOMMISSIONED,
                'capacity' => $capacity
            ];
        }

        if ($currentStatus !== RoomStatus::MAINTENANCE) {
            $currentStatus = $hasVacant ? RoomStatus::AVAILABLE : RoomStatus::UNAVAILABLE;
        }

        return [
            'status' => $currentStatus,
            'capacity' => $capacity,
        ];
    }

    /**
     * Guard against overlapping active contracts for a tenant or bed space.
     *
     * @param  string|null  $newMoveInDate  The start date of the proposed contract.
     *
     * @throws ValidationException
     */
    public static function guardOverlaps(int $tenantId, ?int $bedSpaceId, ?string $newMoveInDate = null): void
    {
        // Rule BR-TEN-003: One active contract per tenant
        $activeTenantContract = Contract::where('tenant_id', $tenantId)
            ->whereIn('status', [ContractStatus::ACTIVE, ContractStatus::PENDING_PAYMENT])
            ->first();

        // Rule BR-CON-011: Renewal Exception
        if ($activeTenantContract && $newMoveInDate) {
            $isContiguous = $activeTenantContract->expected_move_out_date &&
                           Carbon::parse($activeTenantContract->expected_move_out_date)->addDay()->toDateString() === $newMoveInDate;

            if (! $isContiguous) {
                throw ValidationException::withMessages([
                    'tenant_id' => ['Tenant already has an active contract. Renewals must be contiguous with the current move-out date.'],
                ]);
            }
        } elseif ($activeTenantContract) {
            throw ValidationException::withMessages([
                'tenant_id' => ['Tenant already has an active contract.'],
            ]);
        }

        // Rule BR-CON-003: One active contract per bed space
        if ($bedSpaceId) {
            $activeBedContract = Contract::where('bed_space_id', $bedSpaceId)
                ->whereIn('status', [ContractStatus::ACTIVE, ContractStatus::PENDING_PAYMENT])
                ->first();

            if ($activeBedContract) {
                // Check if this is the renewal for the SAME tenant
                if ($newMoveInDate && $activeBedContract->tenant_id === $tenantId) {
                    $isContiguous = $activeBedContract->expected_move_out_date &&
                                   Carbon::parse($activeBedContract->expected_move_out_date)->addDay()->toDateString() === $newMoveInDate;

                    if (! $isContiguous) {
                        throw ValidationException::withMessages([
                            'bed_space_id' => ['Bed space is occupied. Renewals for the same tenant must be contiguous.'],
                        ]);
                    }
                } else {
                    throw ValidationException::withMessages([
                        'bed_space_id' => ['Bed space is already assigned to an active contract.'],
                    ]);
                }
            }
        }
    }
}
