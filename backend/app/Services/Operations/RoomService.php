<?php

namespace App\Services\Operations;

use App\Enums\BedSpaceStatus;
use App\Enums\ContractStatus;
use App\Enums\RoomStatus;
use App\Enums\RoomType;
use App\Models\BedSpace;
use App\Models\Contract;
use App\Models\Room;
use App\Models\User;
use App\Services\Concerns\ManagesWorkflows;
use App\Support\Inventory;
use App\Support\OperationalHardening;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Validation\ValidationException;

/**
 * Manages room inventory, capacity, and bed space lifecycle.
 * Ensures synchronization between room status and underlying bed occupancy.
 */
class RoomService
{
    use ManagesWorkflows;

    /**
     * Create a new room record with bed spaces.
     *
     * Implementation details:
     * - Private rooms are capped at 1 capacity.
     * - Shared rooms must have at least 2 bed spaces.
     * - Room and bed spaces are created within a single transaction.
     *
     * @param  User  $actor  The staff member performing the creation.
     * @param  array  $data  Input including room_code, capacity, and bed_spaces.
     */
    public static function create(User $actor, array $data): Room
    {
        $roomData = collect($data)->except(['bed_spaces'])->toArray();

        return self::runWriteWorkflow(
            actorId: $actor->user_id,
            action: 'CREATE_ROOM',
            payload: ['room_code' => $roomData['room_code'] ?? 'ERR'],
            operation: function () use ($roomData, $data) {
                // Private room bed management bypass
                if (($roomData['room_type'] ?? null) === RoomType::PRIVATE ->value) {
                    $roomData['capacity'] = 1;
                }

                $room = Room::create($roomData);

                // Create initial bed spaces if provided
                if ($room->room_type === RoomType::SHARED) {
                    if (isset($data['bed_spaces']) && is_array($data['bed_spaces'])) {
                        // Validation: Shared rooms must have >= 2 beds
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
                                    'status' => BedSpaceStatus::VACANT,
                                ]);
                            }
                        }
                    } else {
                        throw ValidationException::withMessages([
                            'bed_spaces' => ['Shared rooms require at least 2 bed spaces.'],
                        ]);
                    }
                } elseif ($room->room_type === RoomType::PRIVATE) {
                    // Ensure private rooms have exactly one bed space
                    $room->bedSpaces()->create([
                        'bed_label' => 'Standard Bed',
                        'status' => BedSpaceStatus::VACANT,
                    ]);
                }

                // Sync: Compute state and update in one final call
                $room->load('bedSpaces');
                $state = Inventory::computeRoomState($room);
                $room->update($state);

                self::clearCache();

                return $room->fresh(['bedSpaces']);
            },
            resultDetails: fn(Room $room) => ['room_id' => $room->room_id]
        );
    }

    /**
     * Update an existing room record and its bed spaces.
     *
     * Implementation details:
     * - Prevents deletion of occupied bed spaces.
     * - Prevents deletion of bed spaces with historical contract references.
     * - Re-computes room status after modification.
     *
     * @param  User  $actor  The staff member performing the update.
     * @param  Room  $room  The existing room entity.
     * @param  array  $data  Updated fields and bed space configuration.
     */
    public static function update(User $actor, Room $room, array $data): Room
    {
        if ($room->status === RoomStatus::DECOMMISSIONED) {
            throw ValidationException::withMessages([
                'room' => ['Decommissioned rooms cannot be modified. Restore the room first if updates are required.'],
            ]);
        }

        return self::runWriteWorkflow(
            actorId: $actor->user_id,
            action: 'UPDATE_ROOM',
            payload: ['room_id' => $room->room_id],
            operation: function () use ($room, $data) {
                $roomType = $data['room_type'] ?? $room->room_type;

                // Handle integrated bed spaces if provided
                if (isset($data['bed_spaces']) && is_array($data['bed_spaces'])) {
                    $incomingBeds = collect($data['bed_spaces']);
                    $currentBeds = $room->bedSpaces;

                    // Validation for Shared rooms
                    if ($roomType === RoomType::SHARED && $incomingBeds->count() < 2) {
                        throw ValidationException::withMessages([
                            'bed_spaces' => ['Shared rooms must maintain at least 2 bed spaces.'],
                        ]);
                    }

                    // 1. Identify beds to delete (those in current but not in incoming)
                    $incomingIds = $incomingBeds->pluck('bed_space_id')->filter()->toArray();
                    $toDelete = $currentBeds->whereNotIn('bed_space_id', $incomingIds);

                    foreach ($toDelete as $bedToDelete) {
                        // Safety: Check if occupied
                        if ($bedToDelete->status === BedSpaceStatus::OCCUPIED) {
                            throw ValidationException::withMessages([
                                'bed_spaces' => ["Cannot delete occupied bed: {$bedToDelete->bed_label}"],
                            ]);
                        }
                        // Count ALL contract references — including soft-deleted ones.
                        // Without withTrashed(), an archived contract would be invisible,
                        // allowing a historically-referenced bed to be hard-deleted.
                        $contractRefs = Contract::withTrashed()
                            ->where('bed_space_id', $bedToDelete->bed_space_id)
                            ->count();
                        if ($contractRefs > 0) {
                            throw ValidationException::withMessages([
                                'bed_spaces' => ["Cannot delete bed \"{$bedToDelete->bed_label}\": {$contractRefs} contract record(s) reference this bed."],
                            ]);
                        }
                        $bedToDelete->delete();
                    }

                    // 2. Update existing or create new
                    foreach ($incomingBeds as $bedData) {
                        if (!empty($bedData['bed_space_id'])) {
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
                                'status' => $bedData['status'] ?? BedSpaceStatus::VACANT,
                            ]);
                        }
                    }
                }

                $roomData = collect($data)->except(['bed_spaces'])->toArray();
                if ($roomType instanceof RoomType) {
                    if ($roomType === RoomType::PRIVATE) {
                        $roomData['capacity'] = 1;
                    }
                } elseif ($roomType === RoomType::PRIVATE ->value) {
                    $roomData['capacity'] = 1;
                }

                $room->update($roomData);

                // Sync: Re-load and update derived facts
                $room->load('bedSpaces');
                $state = Inventory::computeRoomState($room);
                $room->update($state);

                self::clearCache();

                return $room->fresh(['bedSpaces']);
            },
            resultDetails: fn(Room $room) => ['room_id' => $room->room_id]
        );
    }

    /**
     * List rooms with deep filtering and bed occupancy context.
     *
     * @param  array  $filters  Query parameters (q, status, type).
     * @param  int  $page  Current page number.
     * @param  int  $perPage  Records per page.
     * @return LengthAwarePaginator
     */
    public static function listPaginated(array $filters, int $page = 1, int $perPage = 25)
    {
        $query = Room::query()->with(['bedSpaces']);

        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        } else {
            $query->where('status', '!=', RoomStatus::DECOMMISSIONED->value);
        }

        $type = $filters['type'] ?? $filters['room_type'] ?? null;
        if (!empty($type)) {
            $query->where('room_type', $type);
        }

        if (!empty($filters['q'])) {
            $needle = trim((string) $filters['q']);
            $forensicId = OperationalHardening::parseForensicId($needle);

            $query->where(function ($w) use ($needle, $forensicId): void {
                if ($forensicId) {
                    $w->where('room_id', $forensicId);
                } else {
                    $stripped = ltrim($needle, '#');
                    $w->where('room_code', 'LIKE', "%{$stripped}%")
                        ->orWhere('amenities', 'LIKE', "%{$stripped}%")
                        ->orWhere('description', 'LIKE', "%{$stripped}%")
                        ->orWhereHas('bedSpaces.contracts.tenant', function ($q) use ($stripped): void {
                            $q->where('first_name', 'LIKE', "%{$stripped}%")
                                ->orWhere('last_name', 'LIKE', "%{$stripped}%");
                        });
                }
            });
        }

        $sortByRaw = $filters['sort_by'] ?? null;
        $sortDir = $filters['sort_dir'] ?? 'asc';

        if ($sortByRaw === 'id') {
            $query->orderBy('room_id', $sortDir);
        } elseif ($sortByRaw === 'type') {
            $query->orderBy('room_type', $sortDir)->orderBy('room_code', 'asc');
        } elseif ($sortByRaw === 'status') {
            $query->orderBy('status', $sortDir)->orderBy('room_code', 'asc');
        } elseif ($sortByRaw === 'monthly_rate') {
            $query->orderBy('monthly_rate', $sortDir)->orderBy('room_code', 'asc');
        } elseif ($sortByRaw === 'capacity') {
            $query->orderBy('capacity', $sortDir)->orderBy('room_code', 'asc');
        } else {
            $query->orderBy('room_code', $sortDir);
        }

        // Secondary tie-breaker for all
        $query->orderBy('room_id', $sortDir);

        return $query->paginate($perPage, ['*'], 'page', $page);
    }

    /**
     * Add bed spaces to a shared room.
     *
     * @param  User  $actor  The staff member performing the action.
     * @param  Room  $room  The target room.
     * @param  string  $bedLabel  Desired label for the new bed.
     */
    public static function addBedSpace(User $actor, Room $room, string $bedLabel): BedSpace
    {
        return self::runWriteWorkflow(
            actorId: $actor->user_id,
            action: 'ADD_BED_SPACE',
            payload: [
                'room_id' => $room->room_id,
                'bed_label' => $bedLabel,
            ],
            operation: function () use ($room, $bedLabel): BedSpace {
                $bedSpace = BedSpace::create([
                    'room_id' => $room->room_id,
                    'bed_label' => $bedLabel,
                    'status' => BedSpaceStatus::VACANT,
                ]);

                return $bedSpace;
            },
            resultDetails: fn(BedSpace $bed) => [
                'room_id' => $room->room_id,
                'bed_space_id' => $bed->bed_space_id,
            ]
        );
    }

    public static function syncStatusAndCapacity(Room $room): void
    {
        $room->loadMissing('bedSpaces');

        $state = Inventory::computeRoomState($room);

        $room->update([
            'status' => $state['status'],
            'capacity' => $state['capacity'],
        ]);
    }

    /**
     * Mark a bed space as occupied.
     *
     * @param  User  $actor  The staff member performing the action.
     * @param  BedSpace  $bedSpace  The target bed space.
     *
     * @throws ValidationException If bed is already occupied or in maintenance.
     */
    public static function occupyBedSpace(User $actor, BedSpace $bedSpace): BedSpace
    {
        if ($bedSpace->status === BedSpaceStatus::OCCUPIED) {
            throw ValidationException::withMessages([
                'bed_space_id' => ['Bed space is already occupied.'],
            ]);
        }

        if ($bedSpace->status === BedSpaceStatus::MAINTENANCE) {
            throw ValidationException::withMessages([
                'bed_space_id' => ['Bed space is currently under maintenance and cannot be occupied.'],
            ]);
        }

        return self::runWriteWorkflow(
            actorId: $actor->user_id,
            action: 'OCCUPY_BED_SPACE',
            payload: ['bed_space_id' => $bedSpace->bed_space_id],
            operation: function () use ($bedSpace): BedSpace {
                $bedSpace->update(['status' => BedSpaceStatus::OCCUPIED]);
                self::clearCache();

                return $bedSpace;
            },
            resultDetails: fn(BedSpace $bed) => [
                'bed_space_id' => $bed->bed_space_id,
                'room_id' => $bed->room_id,
            ]
        );
    }

    /**
     * Get availability summary for a room.
     *
     * @return array<string,mixed>
     */
    public static function getAvailability(Room $room): array
    {
        $room->load('bedSpaces');

        $occupiedCount = $room->bedSpaces->where('status', BedSpaceStatus::OCCUPIED)->count();

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
     * Get availability summary for all operational rooms.
     */
    public static function getAllAvailability(): Collection
    {
        return Cache::remember('rooms:availability', 300, function () {
            return Room::with('bedSpaces')->get()->map(function (Room $room) {
                return self::getAvailability($room);
            });
        });
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
                ->whereIn('status', [ContractStatus::ACTIVE, ContractStatus::PENDING_PAYMENT])
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
     * Aggregate room inventory KPI stats for dashboard cards.
     *
     * @return array<string,int>
     */
    public static function statsSummary(): array
    {
        return Cache::remember('rooms:stats', 300, function () {
            $totalRooms = Room::count();
            $totalBeds = BedSpace::count();
            $occupiedBeds = BedSpace::where('status', BedSpaceStatus::OCCUPIED)->count();

            // Bookable vacant beds: vacant beds in rooms that still have usable inventory.
            $bookableVacantBeds = BedSpace::where('status', BedSpaceStatus::VACANT)
                ->whereHas('room', function ($q): void {
                    $q->where('status', RoomStatus::AVAILABLE);
                })
                ->count();

            $maintenanceBeds = BedSpace::where('status', BedSpaceStatus::MAINTENANCE)->count();
            $offlineRooms = Room::where('status', RoomStatus::MAINTENANCE)->count();
            $decommissionedRooms = Room::where('status', RoomStatus::DECOMMISSIONED)->count();

            $occupancyPct = $totalBeds > 0 ? (int) round(($occupiedBeds / $totalBeds) * 100) : 0;

            return [
                'total_rooms' => $totalRooms,
                'total_beds' => $totalBeds,
                'occupied_beds' => $occupiedBeds,
                'bookable_vacant_beds' => $bookableVacantBeds,
                'maintenance_beds' => $maintenanceBeds,
                'offline_units' => $offlineRooms,
                'decommissioned_rooms' => $decommissionedRooms,
                'occupancy_pct' => $occupancyPct,
            ];
        });
    }

    /**
     * Archive a room for historical retention.
     *
     * @param  User  $actor  The staff member performing the action.
     * @param  Room  $room  The target room entity.
     *
     * @throws ValidationException If room is occupied or linked to active contracts.
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
            action: 'DECOMMISSION_ROOM',
            payload: ['room_id' => $room->room_id],
            operation: function () use ($room) {
                $room->status = RoomStatus::DECOMMISSIONED;
                $room->save();

                self::clearCache();

                return $room;
            }
        );
    }

    /**
     * Restore an archived room (FR-012a).
     *
     * @param  User  $actor  The staff member performing the action.
     * @param  int  $id  The ID of the archived room.
     */
    public static function restore(User $actor, int $id): Room
    {
        return self::runWriteWorkflow(
            actorId: $actor->user_id,
            action: 'RESTORE_ROOM',
            payload: ['room_id' => $id],
            operation: function () use ($id): Room {
                $room = Room::findOrFail($id);
                $room->status = RoomStatus::AVAILABLE;
                $room->save();

                self::syncStatusAndCapacity($room);
                self::clearCache();

                return $room;
            }
        );
    }

    /**
     * Internal: Check for occupied beds.
     */
    private static function hasOccupiedBeds(Room $room): bool
    {
        return BedSpace::query()
            ->where('room_id', $room->room_id)
            ->where('status', BedSpaceStatus::OCCUPIED)
            ->exists();
    }

    /**
     * Internal: Check for active contracts linked to room.
     */
    private static function hasActiveContracts(Room $room): bool
    {
        return Contract::query()
            ->whereIn('status', [ContractStatus::ACTIVE, ContractStatus::PENDING_PAYMENT])
            ->whereNull('deleted_at')
            ->whereHas('bedSpace', function ($q) use ($room): void {
                $q->where('room_id', $room->room_id);
            })
            ->exists();
    }

    /**
     * Clear cached room data to maintain consistency across replicas.
     */
    public static function clearCache(): void
    {
        Cache::forget('rooms:stats');
        Cache::forget('rooms:availability');
    }
}
