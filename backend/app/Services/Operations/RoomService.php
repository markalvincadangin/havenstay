<?php
 
 namespace App\Services\Operations;
 
 use App\Services\Concerns\ManagesWorkflows;
 use App\Models\BedSpace;
 use App\Models\Contract;
 use App\Models\Room;
 use App\Models\User;
 use App\Enums\RoomType;
 use App\Enums\RoomStatus;
 use App\Enums\BedSpaceStatus;
 use App\Enums\ContractStatus;
 use App\Support\Inventory;
 use Illuminate\Support\Collection;
 use Illuminate\Validation\ValidationException;
 
 /**
  * RoomService
  * 
  * Orchestrates room inventory, capacity management, and bed space lifecycle.
  * Ensures data integrity between rooms and their underlying bed occupancy facts.
  */
 class RoomService
 {
     use ManagesWorkflows;
 
     /**
      * Create a new room record with integrated bed spaces.
      * 
      * Forensic Rules:
      * - BR-018: Solo rooms are automatically capped at 1 capacity.
      * - Validation: Shared rooms must have >= 2 bed spaces.
      * - Atomicity: Room and initial bed spaces created in a single transaction.
      * 
      * @param User $actor The staff member performing the creation.
      * @param array $data Input including room_code, capacity, and bed_spaces.
      * @return Room
      */
     public static function create(User $actor, array $data): Room
     {
         $roomData = collect($data)->except(['bed_spaces'])->toArray();
 
         return self::runWriteWorkflow(
             actorId: $actor->user_id,
             action: 'CREATE_ROOM',
             payload: ['room_code' => $roomData['room_code'] ?? 'ERR'],
             operation: function () use ($roomData, $data) {
                 // BR-018: Private room manual bed management bypass
                 if (($roomData['room_type'] ?? null) === RoomType::PRIVATE->value) {
                     $roomData['capacity'] = 1;
                 }
 
                 $room = Room::create($roomData);
 
                 // Create initial bed spaces if provided
                 if ($room->room_type === RoomType::SHARED) {
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
                     // Ensure private rooms have exactly one bed space (SDD Sec. 10 Decision 2)
                     $room->bedSpaces()->create([
                         'bed_label' => 'Standard Bed',
                         'status' => BedSpaceStatus::VACANT,
                     ]);
                 }
 
                 // Atomic Sync: Compute state and update in one final call
                 $room->load('bedSpaces');
                 $state = Inventory::computeRoomState($room);
                 $room->update($state);
 
                 return $room->fresh(['bedSpaces']);
             },
             resultDetails: fn(Room $room) => ['room_id' => $room->room_id]
         );
     }
 
     /**
      * Update an existing room record with integrated bed space management.
      * 
      * Forensic Rules:
      * - Constraint: Cannot delete bed spaces that are currently occupied.
      * - Constraint: Cannot delete bed spaces with historical contract references.
      * - Sync: Re-computes room status after every modification.
      * 
      * @param User $actor The staff member performing the update.
      * @param Room $room The existing room entity.
      * @param array $data Updated fields and bed space configuration.
      * @return Room
      */
     public static function update(User $actor, Room $room, array $data): Room
     {
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
                 } elseif ($roomType === RoomType::PRIVATE->value) {
                      $roomData['capacity'] = 1;
                 }
 
                 $room->update($roomData);
 
                 // Atomic Sync: Re-load and update derived facts
                 $room->load('bedSpaces');
                 $state = Inventory::computeRoomState($room);
                 $room->update($state);
 
                 return $room->fresh(['bedSpaces']);
             },
             resultDetails: fn(Room $room) => ['room_id' => $room->room_id]
         );
     }
 
     /**
      * List rooms with deep filtering and bed occupancy context.
      * 
      * @param array $filters Query parameters (q, status, type).
      * @param int $page Current page number.
      * @param int $perPage Records per page.
      * @return \Illuminate\Contracts\Pagination\LengthAwarePaginator
      */
     public static function listPaginated(array $filters, int $page = 1, int $perPage = 25)
     {
         $query = Room::query()->with(['bedSpaces']);
 
         if (!empty($filters['status'])) {
             if ($filters['status'] === 'archived') {
                 $query->onlyTrashed();
             } else {
                 $query->where('status', $filters['status']);
             }
         } else {
             $query->withTrashed();
         }
 
         $type = $filters['type'] ?? $filters['room_type'] ?? null;
         if (!empty($type)) {
             $query->where('room_type', $type);
         }
 
         if (!empty($filters['q'])) {
             $needle = $filters['q'];
             $query->where(function ($w) use ($needle): void {
                 $w->where('room_code', 'LIKE', "%{$needle}%")
                     ->orWhere('amenities', 'LIKE', "%{$needle}%")
                     ->orWhere('description', 'LIKE', "%{$needle}%")
                     ->orWhereHas('bedSpaces.contracts.tenant', function ($q) use ($needle): void {
                         $q->where('first_name', 'LIKE', "%{$needle}%")
                             ->orWhere('last_name', 'LIKE', "%{$needle}%");
                     });
             });
         }
 
         return $query->orderBy('room_code')
             ->paginate($perPage, ['*'], 'page', $page);
     }
 
     /**
      * Add bed spaces to a shared room (Atomic legacy support).
      * 
      * @param User $actor The staff member performing the action.
      * @param Room $room The target room.
      * @param string $bedLabel Desired label for the new bed.
      * @return BedSpace
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
 
                 self::syncStatusAndCapacity($room);
 
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
      * @param User $actor The staff member performing the action.
      * @param BedSpace $bedSpace The target bed space.
      * @return BedSpace
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
 
                 if ($bedSpace->room) {
                     self::syncStatusAndCapacity($bedSpace->room);
                 }
 
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
      * @param Room $room
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
         return Room::with('bedSpaces')->get()->map(function (Room $room) {
             return self::getAvailability($room);
         });
     }
 
     /**
      * Compose room detail payload with occupancy and active contract context.
      * 
      * @param Room $room
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
 
         $occupancyPct = $totalBeds > 0 ? (int) round(($occupiedBeds / $totalBeds) * 100) : 0;
 
         return [
             'total_rooms' => $totalRooms,
             'total_beds' => $totalBeds,
             'occupied_beds' => $occupiedBeds,
             'bookable_vacant_beds' => $bookableVacantBeds,
             'maintenance_beds' => $maintenanceBeds,
             'offline_units' => $offlineRooms,
             'occupancy_pct' => $occupancyPct,
         ];
     }
 
     /**
      * Archive a room for forensic retention (FR-012a).
      * 
      * @param User $actor The staff member performing the action.
      * @param Room $room The target room entity.
      * @return Room
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
             action: 'ARCHIVE_ROOM',
             payload: ['room_id' => $room->room_id],
             operation: function () use ($room) {
                 // Forensic Rule: Mark as unavailable (archived) before soft-deletion
                 $room->status = RoomStatus::UNAVAILABLE;
                 $room->save();
 
                 $room->delete();
                 return $room;
             }
         );
     }
 
     /**
      * Restore an archived room (FR-012a).
      * 
      * @param User $actor The staff member performing the action.
      * @param int $id The ID of the archived room.
      * @return Room
      */
     public static function restore(User $actor, int $id): Room
     {
         return self::runWriteWorkflow(
             actorId: $actor->user_id,
             action: 'RESTORE_ROOM',
             payload: ['room_id' => $id],
             operation: function () use ($id): Room {
                 $room = Room::withTrashed()->findOrFail($id);
                 $room->restore();
                 self::syncStatusAndCapacity($room);
 
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
             ->where('status', ContractStatus::ACTIVE)
             ->whereNull('deleted_at')
             ->whereHas('bedSpace', function ($q) use ($room): void {
                 $q->where('room_id', $room->room_id);
             })
             ->exists();
     }
 }
