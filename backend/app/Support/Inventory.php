<?php

namespace App\Support;

use App\Models\Room;
use App\Models\BedSpace;
use App\Models\Contract;
use Illuminate\Validation\ValidationException;

/**
 * Inventory
 * 
 * Centralizes room and bed space state derivation and inventory guard logic.
 */
class Inventory
{
    /**
     * Synchronize room status and capacity based on current occupancy facts.
     */
    public static function syncRoomState(Room $room): void
    {
        $room->load('bedSpaces');

        // 1. Derive Capacity
        if ($room->room_type === Room::TYPE_SOLO) {
            $room->capacity = 1;
            if ($room->bedSpaces->isEmpty()) {
                $room->bedSpaces()->create([
                    'bed_label' => 'Solo Bed',
                    'status' => BedSpace::STATUS_VACANT,
                ]);
                $room->load('bedSpaces');
            }
        } else {
            $room->capacity = $room->bedSpaces->count();
        }

        // 2. Derive Status (unless maintenance override exists)
        if ($room->status !== Room::STATUS_MAINTENANCE) {
            $assignedBedIds = Contract::whereIn('status', [Contract::STATUS_ACTIVE, Contract::STATUS_PENDING_PAYMENT])
            ->whereNull('deleted_at')
            ->pluck('bed_space_id')
            ->toArray();

        // Forensic Sync: Room status tracks physical + legal occupancy facts.
        $occupiedCount = $room->bedSpaces()
            ->where(function($q) use ($assignedBedIds) {
                $q->where('status', BedSpace::STATUS_OCCUPIED)
                  ->orWhereIn('bed_space_id', $assignedBedIds);
            })->count();
            $vacantCount = $room->bedSpaces->count() - $occupiedCount;
            $maintenanceCount = $room->bedSpaces->where('status', BedSpace::STATUS_MAINTENANCE)->count();

            if ($vacantCount === 0 && $occupiedCount > 0) {
                $room->status = Room::STATUS_FULLY_OCCUPIED;
            } elseif ($occupiedCount > 0 && $vacantCount > 0) {
                $room->status = Room::STATUS_PARTIALLY_OCCUPIED;
            } elseif ($occupiedCount === 0 && $vacantCount > 0) {
                $room->status = Room::STATUS_VACANT;
            } elseif ($occupiedCount === 0 && $vacantCount === 0 && $maintenanceCount > 0) {
                $room->status = Room::STATUS_MAINTENANCE;
            }
        }

        $room->save();
    }

    /**
     * Guard against overlapping active contracts for a tenant or bed space.
     * 
     * @throws ValidationException
     */
    public static function guardOverlaps(int $tenantId, ?int $bedSpaceId): void
    {
        $hasTenantOverlap = Contract::where('tenant_id', $tenantId)
            ->whereIn('status', [Contract::STATUS_ACTIVE, Contract::STATUS_PENDING_PAYMENT])
            ->exists();

        if ($hasTenantOverlap) {
            throw ValidationException::withMessages([
                'tenant_id' => ['Tenant already has an active contract.'],
            ]);
        }

        if ($bedSpaceId) {
            $hasBedSpaceOverlap = Contract::where('bed_space_id', $bedSpaceId)
                ->whereIn('status', [Contract::STATUS_ACTIVE, Contract::STATUS_PENDING_PAYMENT])
                ->exists();

            if ($hasBedSpaceOverlap) {
                throw ValidationException::withMessages([
                    'bed_space_id' => ['Bed space is already assigned to an active contract.'],
                ]);
            }
        }
    }
}
