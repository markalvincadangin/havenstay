<?php

namespace App\Services;

use App\Models\BedSpace;
use App\Models\Contract;
use App\Models\Room;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class RoomService
{
    /**
     * Create a new room record with integrated bed spaces
     * FR-012, FR-013, FR-014
     */
    public static function create(array $data): Room
    {
        $roomData = collect($data)->except(['bed_spaces'])->toArray();

        // CCR-007: Transaction log entry
        $started = TransactionService::logStarted(
            'room_registration',
            Auth::id() ?? 0,
            'rooms',
            $data['room_code'] ?? 'pending'
        );
        $txLogId = $started['tx_log_id'];

        // Set audit context for triggers
        if (Auth::check()) {
            AuditService::setAuditUserContext(Auth::id());
        }
        AuditService::setCorrelationContext($started['correlation_id']);

        try {
            // CCR-006: Explicit transaction — START TRANSACTION / COMMIT / ROLLBACK
            $result = DB::transaction(function () use ($roomData, $data) {
                // CCR-003: INSERT room and bed spaces
                $room = Room::create($roomData);

                // Create initial bed spaces if provided
                if (isset($data['bed_spaces']) && is_array($data['bed_spaces'])) {
                    foreach ($data['bed_spaces'] as $bed) {
                        $bedLabel = is_array($bed) ? ($bed['bed_label'] ?? null) : $bed;
                        if ($bedLabel) {
                            $room->bedSpaces()->create([
                                'bed_label' => $bedLabel,
                                'status' => 'vacant',
                            ]);
                        }
                    }
                } elseif ($room->room_type === 'solo') {
                    // Ensure solo rooms have at least one bed space (SDD Sec. 10 Decision 2)
                    $room->bedSpaces()->create([
                        'bed_label' => 'Solo Bed',
                        'status' => 'vacant',
                    ]);
                }

                self::syncStatusAndCapacity($room);

                return $room->fresh(['bedSpaces']);
            });

            TransactionService::logCommitted($txLogId, [
                'room_id' => $result->room_id,
                'room_code' => $result->room_code,
                'capacity' => $result->capacity,
            ]);

            return $result;
        } catch (\Exception $e) {
            TransactionService::logRolledBack($txLogId, $e->getMessage());
            throw $e;
        } finally {
            AuditService::clearCorrelationContext();
        }
    }

    /**
     * Update an existing room record with integrated bed space management
     * FR-012, FR-013, FR-014
     */
    public static function update(Room $room, array $data): Room
    {
        // CCR-007: Transaction log entry
        $started = TransactionService::logStarted(
            'room_configuration_update',
            Auth::id() ?? 0,
            'rooms',
            (string) $room->room_id
        );
        $txLogId = $started['tx_log_id'];

        // Set audit context for triggers
        if (Auth::check()) {
            AuditService::setAuditUserContext(Auth::id());
        }
        AuditService::setCorrelationContext($started['correlation_id']);

        try {
            // CCR-006: Explicit transaction — START TRANSACTION / COMMIT / ROLLBACK
            $result = DB::transaction(function () use ($room, $data) {
                // CCR-003: UPDATE room and manage bed spaces
                // Handle integrated bed spaces if provided
                if (isset($data['bed_spaces']) && is_array($data['bed_spaces'])) {
                    $incomingBeds = collect($data['bed_spaces']);
                    $currentBeds = $room->bedSpaces;

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
                $room->update($roomData);

                self::syncStatusAndCapacity($room);

                return $room->fresh(['bedSpaces']);
            });

            TransactionService::logCommitted($txLogId, [
                'room_id' => $result->room_id,
                'room_code' => $result->room_code,
                'new_capacity' => $result->capacity,
            ]);

            return $result;
        } catch (\Exception $e) {
            TransactionService::logRolledBack($txLogId, $e->getMessage());
            throw $e;
        } finally {
            AuditService::clearCorrelationContext();
        }
    }

    /**
     * Add bed spaces to a shared room (Atomic legacy support)
     */
    public static function addBedSpace(Room $room, string $bedLabel): BedSpace
    {
        if (Auth::check()) {
            AuditService::setAuditUserContext(Auth::id());
        }

        $bedSpace = BedSpace::create([
            'room_id' => $room->room_id,
            'bed_label' => $bedLabel,
            'status' => 'vacant',
        ]);

        self::syncStatusAndCapacity($room);

        return $bedSpace;
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
            // Ensure solo rooms have at least one bed space (FR-013 compliance)
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

        // 2. Derive Status (unless specifically set to maintenance)
        if ($room->status !== Room::STATUS_MAINTENANCE) {
            $totalBeds = $room->bedSpaces()->count();
            $vacantCount = $room->bedSpaces()->where('status', 'vacant')->count();

            // IF rooms have zero beds OR zero beds are vacant -> Unavailable
            if ($totalBeds === 0 || $vacantCount === 0) {
                $room->status = Room::STATUS_UNAVAILABLE;
            } else {
                $room->status = Room::STATUS_AVAILABLE;
            }
        }

        $room->save();
    }

    /**
     * Mark a bed space as occupied
     */
    public static function occupyBedSpace(BedSpace $bedSpace): BedSpace
    {
        if ($bedSpace->status === 'occupied') {
            throw ValidationException::withMessages([
                'bed_space_id' => ['Bed space is already occupied.'],
            ]);
        }

        if (Auth::check()) {
            AuditService::setAuditUserContext(Auth::id());
        }

        $bedSpace->update(['status' => 'occupied']);

        if ($bedSpace->room) {
            self::syncStatusAndCapacity($bedSpace->room);
        }

        return $bedSpace;
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
        $rooms = Room::all();

        return $rooms->map(fn (Room $room) => self::getAvailability($room));
    }

    /**
     * Find a room by ID
     */
    public static function findById(int $id): ?Room
    {
        return Room::find($id);
    }
}
