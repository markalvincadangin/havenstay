<?php

namespace App\Services;

use App\Services\Concerns\ManagesWorkflows;
use App\Models\BedSpace;
use App\Models\Contract;
use App\Models\Room;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

class RoomService
{
    use ManagesWorkflows;

    /**
     * Create a new room record with integrated bed spaces.
     */
    public static function create(User $actor, array $data): Room
    {
        $roomData = collect($data)->except(['bed_spaces'])->toArray();

        return self::runWriteWorkflow(
            actorId: $actor->user_id,
            action: 'CREATE_ROOM',
            txnReference: self::buildTxnReference('RM-CRT'),
            payload: ['room_code' => $roomData['room_code'] ?? 'ERR'],
            operation: function () use ($roomData, $data) {
                // BR-018: Solo room manual bed management bypass
                if (($roomData['room_type'] ?? null) === 'solo') {
                    $roomData['capacity'] = 1;
                }

                $room = Room::create($roomData);

                // Create initial bed spaces if provided
                if ($room->room_type === 'shared') {
                    if (isset($data['bed_spaces']) && is_array($data['bed_spaces'])) {
                        // User constraint: Shared rooms must have >= 2 beds
                        if (count($data['bed_spaces']) < 2) {
                            throw ValidationException::withMessages([
                                'bed_spaces' => ['Shared rooms must have at least 2 bed spaces.'],
                            ]);
                        }
                        foreach ($data['bed_spaces'] as $bed) {
                            $bedLabel = is_array($bed) ? ($bed['bed_label'] ?? null) : $bed;
                            if ($bedLabel) {
                                $room->bedSpaces()->create([
                                    'bed_label' => $bedLabel,
                                    'status' => 'vacant',
                                ]);
                            }
                        }
                    } else {
                        throw ValidationException::withMessages([
                            'bed_spaces' => ['Shared rooms require at least 2 bed spaces.'],
                        ]);
                    }
                } elseif ($room->room_type === 'solo') {
                    // Ensure solo rooms have exactly one bed space (SDD Sec. 10 Decision 2)
                    $room->bedSpaces()->create([
                        'bed_label' => 'Solo Bed',
                        'status' => 'vacant',
                    ]);
                }

                self::syncStatusAndCapacity($room);

                return $room->fresh(['bedSpaces']);
            },
            resultDetails: fn (Room $room) => ['room_id' => $room->room_id]
        );
    }

    /**
     * Update an existing room record with integrated bed space management.
     */
    public static function update(User $actor, Room $room, array $data): Room
    {
        return self::runWriteWorkflow(
            actorId: $actor->user_id,
            action: 'UPDATE_ROOM',
            txnReference: self::buildTxnReference('RM-UPD'),
            payload: ['room_id' => $room->room_id],
            operation: function () use ($room, $data) {
                $roomType = $data['room_type'] ?? $room->room_type;

                // Handle integrated bed spaces if provided
                if (isset($data['bed_spaces']) && is_array($data['bed_spaces'])) {
                    $incomingBeds = collect($data['bed_spaces']);
                    $currentBeds = $room->bedSpaces;

                    // Validation for Shared rooms
                    if ($roomType === 'shared' && $incomingBeds->count() < 2) {
                        throw ValidationException::withMessages([
                            'bed_spaces' => ['Shared rooms must maintain at least 2 bed spaces.'],
                        ]);
                    }

                    // 1. Identify beds to delete (those in current but not in incoming)
                    $incomingIds = $incomingBeds->pluck('bed_space_id')->filter()->toArray();
                    $toDelete = $currentBeds->whereNotIn('bed_space_id', $incomingIds);

                    foreach ($toDelete as $bedToDelete) {
                        // Safety: Check if occupied
                        if ($bedToDelete->status === 'occupied') {
                            throw ValidationException::withMessages([
                                'bed_spaces' => ["Cannot delete occupied bed: {$bedToDelete->bed_label}"],
                            ]);
                        }
                        $contractRefs = Contract::where('bed_space_id', $bedToDelete->bed_space_id)->count();
                        if ($contractRefs > 0) {
                            throw ValidationException::withMessages([
                                'bed_spaces' => ["Cannot delete bed \"{$bedToDelete->bed_label}\": {$contractRefs} contract record(s) reference this bed."],
                            ]);
                        }
                        $bedToDelete->delete();
                    }

                    // 2. Update existing or create new
                    foreach ($incomingBeds as $bedData) {
                        if (! empty($bedData['bed_space_id'])) {
                            // Update existing
                            $existing = $currentBeds->firstWhere('bed_space_id', $bedData['bed_space_id']);
                            if ($existing) {
                                $existing->update([
                                    'bed_label' => $bedData['bed_label'],
                                    'status' => $bedData['status'] ?? $existing->status,
                                ]);
                            }
                        } else {
                            // Create new
                            $room->bedSpaces()->create([
                                'bed_label' => $bedData['bed_label'] ?? 'New Bed',
                                'status' => $bedData['status'] ?? 'vacant',
                            ]);
                        }
                    }
                }

                $roomData = collect($data)->except(['bed_spaces'])->toArray();
                if ($roomType === 'solo') {
                    $roomData['capacity'] = 1;
                }
                $room->update($roomData);

                self::syncStatusAndCapacity($room);

                return $room->fresh(['bedSpaces']);
            },
            resultDetails: fn (Room $room) => ['room_id' => $room->room_id]
        );
    }

    /**
     * Add bed spaces to a shared room (Atomic legacy support)
     */
    public static function addBedSpace(User $actor, Room $room, string $bedLabel): BedSpace
    {
        return self::runWriteWorkflow(
            actorId: $actor->user_id,
            action: 'ADD_BED_SPACE',
            txnReference: self::buildTxnReference('BED-ADD'),
            payload: [
                'room_id' => $room->room_id,
                'bed_label' => $bedLabel,
            ],
            operation: function () use ($room, $bedLabel): BedSpace {
                $bedSpace = BedSpace::create([
                    'room_id' => $room->room_id,
                    'bed_label' => $bedLabel,
                    'status' => 'vacant',
                ]);

                self::syncStatusAndCapacity($room);

                return $bedSpace;
            },
            resultDetails: fn (BedSpace $bed) => [
                'room_id' => $room->room_id,
                'bed_space_id' => $bed->bed_space_id,
            ]
        );
    }

    /**
     * Sync room status and capacity based on current occupancy facts
     */
    public static function syncStatusAndCapacity(Room $room): void
    {
        $room->load('bedSpaces');

        // 1. Derive Capacity
        if ($room->room_type === 'solo') {
            $room->capacity = 1;
            // Ensure solo rooms have at least one bed space
            if ($room->bedSpaces->isEmpty()) {
                $room->bedSpaces()->create([
                    'bed_label' => 'Solo Bed',
                    'status' => 'vacant',
                ]);
                $room->load('bedSpaces'); // Reload to reflect the new bed
            }
        } else {
            $room->capacity = $room->bedSpaces()->count();
        }

        // 2. Derive Status from usable inventory (unless manually set to maintenance)
        if ($room->status !== Room::STATUS_MAINTENANCE) {
            $vacantCount = $room->bedSpaces()->where('status', 'vacant')->count();
            $occupiedCount = $room->bedSpaces()->where('status', 'occupied')->count();
            $maintenanceCount = $room->bedSpaces()->where('status', 'maintenance')->count();

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
     * Mark a bed space as occupied
     */
    public static function occupyBedSpace(User $actor, BedSpace $bedSpace): BedSpace
    {
        if ($bedSpace->status === 'occupied') {
            throw ValidationException::withMessages([
                'bed_space_id' => ['Bed space is already occupied.'],
            ]);
        }

        return self::runWriteWorkflow(
            actorId: $actor->user_id,
            action: 'OCCUPY_BED_SPACE',
            txnReference: self::buildTxnReference('BED-OCCUPY'),
            payload: ['bed_space_id' => $bedSpace->bed_space_id],
            operation: function () use ($bedSpace): BedSpace {
                $bedSpace->update(['status' => 'occupied']);

                if ($bedSpace->room) {
                    self::syncStatusAndCapacity($bedSpace->room);
                }

                return $bedSpace;
            },
            resultDetails: fn (BedSpace $bed) => [
                'bed_space_id' => $bed->bed_space_id,
                'room_id' => $bed->room_id,
            ]
        );
    }

    /**
     * Get availability summary for a room
     */
    public static function getAvailability(Room $room): array
    {
        $room->load('bedSpaces');

        $occupiedCount = $room->bedSpaces->where('status', 'occupied')->count();

        return [
            'room_id' => $room->room_id,
            'room_code' => $room->room_code,
            'room_type' => $room->room_type,
            'capacity' => $room->capacity,
            'occupied_beds' => (int) $occupiedCount,
            'vacant_beds' => max(0, $room->capacity - (int) $occupiedCount),
            'status' => $room->status,
        ];
    }

    /**
     * Get availability for all rooms
     */
    public static function getAllAvailability(): Collection
    {
        $rooms = Room::with(['bedSpaces'])->get();

        return $rooms->map(fn (Room $room) => self::getAvailability($room));
    }

    /**
     * Find a room by ID
     */
    public static function findById(int $id): ?Room
    {
        return Room::find($id);
    }

    /**
     * Compose room detail payload with occupancy and active contract context.
     *
     * @return array<string,mixed>
     */
    public static function detailPayload(Room $room): array
    {
        $room->load('bedSpaces');

        $bedSpaceIds = $room->bedSpaces->pluck('bed_space_id')->all();
        $activeContractsByBed = empty($bedSpaceIds)
            ? collect()
            : Contract::query()
                ->with('tenant')
                ->where('status', Contract::STATUS_ACTIVE)
                ->whereNull('deleted_at')
                ->whereIn('bed_space_id', $bedSpaceIds)
                ->get()
                ->keyBy('bed_space_id');

        $bedSpaces = $room->bedSpaces->map(function (BedSpace $bed) use ($activeContractsByBed): array {
            $contract = $activeContractsByBed->get($bed->bed_space_id);

            return array_merge($bed->toArray(), [
                'active_contract' => $contract ? [
                    'contract_id' => $contract->contract_id,
                    'move_in_date' => $contract->move_in_date,
                    'tenant' => $contract->tenant ? [
                        'tenant_id' => $contract->tenant->tenant_id,
                        'first_name' => $contract->tenant->first_name,
                        'last_name' => $contract->tenant->last_name,
                    ] : null,
                ] : null,
            ]);
        });

        return array_merge($room->toArray(), [
            'bed_spaces' => $bedSpaces,
            'has_occupied_beds' => self::hasOccupiedBeds($room),
            'has_active_contracts' => self::hasActiveContracts($room),
        ]);
    }

    /**
     * Aggregate room inventory KPI stats.
     *
     * @return array<string,int>
     */
    public static function statsSummary(): array
    {
        $totalRooms = Room::count();
        $totalBeds = BedSpace::count();
        $occupiedBeds = BedSpace::where('status', BedSpace::STATUS_OCCUPIED)->count();

        // Bookable vacant beds: vacant beds in rooms that still have usable inventory.
        $bookableVacantBeds = BedSpace::where('status', BedSpace::STATUS_VACANT)
            ->whereHas('room', function ($q): void {
                $q->whereIn('status', [Room::STATUS_VACANT, Room::STATUS_PARTIALLY_OCCUPIED]);
            })
            ->count();

        $occupancyPct = $totalBeds > 0 ? (int) round(($occupiedBeds / $totalBeds) * 100) : 0;

        return [
            'total_rooms' => $totalRooms,
            'total_beds' => $totalBeds,
            'occupied_beds' => $occupiedBeds,
            'bookable_vacant_beds' => $bookableVacantBeds,
            'occupancy_pct' => $occupancyPct,
        ];
    }

    /**
     * True when any bed in the room is currently occupied.
     */
    public static function hasOccupiedBeds(Room $room): bool
    {
        return BedSpace::query()
            ->where('room_id', $room->room_id)
            ->where('status', 'occupied')
            ->exists();
    }

    /**
     * True when any active contract references this room's bed spaces.
     */
    public static function hasActiveContracts(Room $room): bool
    {
        return Contract::query()
            ->where('status', 'active')
            ->whereNull('deleted_at')
            ->whereHas('bedSpace', function ($q) use ($room): void {
                $q->where('room_id', $room->room_id);
            })
            ->exists();
    }

    /**
     * Archive a room for forensic retention (FR-012a).
     */
    public static function archive(User $actor, Room $room): Room
    {
        if (self::hasOccupiedBeds($room)) {
            throw ValidationException::withMessages([
                'room' => ['Room cannot be archived while one or more bed spaces are occupied.'],
            ]);
        }

        if (self::hasActiveContracts($room)) {
            throw ValidationException::withMessages([
                'room' => ['Room cannot be archived while active contracts are linked to its bed spaces.'],
            ]);
        }

        return self::runWriteWorkflow(
            actorId: $actor->user_id,
            action: 'ARCHIVE_ROOM',
            txnReference: self::buildTxnReference('RM-ARC'),
            payload: ['room_id' => $room->room_id],
            operation: function () use ($room) {
                $room->delete();
                return $room;
            }
        );
    }

    /**
     * Restore an archived room (FR-012a).
     */
    public static function restore(User $actor, int $id): Room
    {
        return self::runWriteWorkflow(
            actorId: $actor->user_id,
            action: 'RESTORE_ROOM',
            txnReference: self::buildTxnReference('RM-RES'),
            payload: ['room_id' => $id],
            operation: function () use ($id): Room {
                $room = Room::withTrashed()->findOrFail($id);
                $room->restore();
                self::syncStatusAndCapacity($room);

                return $room;
            }
        );
    }

}
