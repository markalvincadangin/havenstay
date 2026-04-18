<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Room\StoreRoomRequest;
use App\Http\Requests\Room\UpdateRoomRequest;
use App\Models\BedSpace;
use App\Models\Room;
use App\Services\Identity\AuthorizationService;
use App\Services\Operations\RoomService;
use App\Support\Pagination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RoomController extends Controller
{

    /**
     * FR-012: List all rooms with bed space relationships.
     */
    public function index(Request $request): JsonResponse
    {
        AuthorizationService::ensureCanViewReports($request->user());

        $validated = $request->validate(array_merge([
            'q' => ['nullable', 'string', 'max:200'],
            'status' => ['nullable', 'string', 'in:vacant,partially_occupied,fully_occupied,maintenance,archived'],
            'type' => ['nullable', 'string', 'in:solo,shared'],
            'room_type' => ['nullable', 'string', 'in:solo,shared'],
        ], Pagination::queryRules()));

        $pageParams = Pagination::normalizePageParams($validated);

        $query = Room::query()->with(['bedSpaces', 'meterReadings'])->orderBy('room_code');

        if (!empty($validated['status'])) {
            if ($validated['status'] === 'archived') {
                $query->onlyTrashed();
            } else {
                $query->where('status', $validated['status']);
            }
        } else {
            // "All Statuses" or default includes archived rooms for forensic integrity, 
            // similar to the Tenant module.
            $query->withTrashed();
        }

        $type = $validated['type'] ?? $validated['room_type'] ?? null;
        if (!empty($type)) {
            $query->where('room_type', $type);
        }

        if (!empty($validated['q'])) {
            $needle = $validated['q'];
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

        $paginator = $query->paginate($pageParams['per_page'], ['*'], 'page', $pageParams['page']);

        return Pagination::fromPaginator($paginator);
    }

    /**
     * TC-ROOM-001
     */
    public function store(StoreRoomRequest $request): JsonResponse
    {
        AuthorizationService::ensureCanManageRooms($request->user());

        $validated = $request->validated();

        $room = RoomService::create($request->user(), $validated);

        return response()->json([
            'message' => 'Room created successfully.',
            'data' => $room->load('bedSpaces'),
        ], 201);
    }

    /**
     */
    public function show(Request $request, Room $room): JsonResponse
    {
        AuthorizationService::ensureCanViewReports($request->user());

        return response()->json([
            'message' => 'Room retrieved successfully.',
            'data' => RoomService::detailPayload($room->load('meterReadings')),
        ]);
    }

    /**
     */
    public function update(UpdateRoomRequest $request, Room $room): JsonResponse
    {
        AuthorizationService::ensureCanManageRooms($request->user());

        $validated = $request->validated();

        $room = RoomService::update($request->user(), $room, $validated);

        return response()->json([
            'message' => 'Room updated successfully.',
            'data' => $room->load('bedSpaces'),
        ]);
    }

    /**
     * TC-BED-001
     */
    public function addBedSpace(Request $request, Room $room): JsonResponse
    {
        AuthorizationService::ensureCanManageRooms($request->user());

        $validated = $request->validate([
            'bed_label' => ['required', 'string', 'max:20'],
        ]);

        try {
            $bedSpace = RoomService::addBedSpace($request->user(), $room, $validated['bed_label']);

            return response()->json([
                'message' => 'Bed space added successfully.',
                'data' => $bedSpace,
            ], 201);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Error adding bed space: ' . $e->getMessage(),
            ], 422);
        }
    }

    /**
     * Used by tests to verify double-occupancy prevention
     */
    public function occupyBedSpace(Request $request, BedSpace $bedSpace): JsonResponse
    {
        AuthorizationService::ensureCanManageRooms($request->user());

        try {
            $bedSpace = RoomService::occupyBedSpace($request->user(), $bedSpace);

            return response()->json([
                'message' => 'Bed space occupied successfully.',
                'data' => $bedSpace,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Error: Bed space already occupied or invalid.',
                'error' => $e->getMessage(),
            ], 409);
        }
    }
    /**
     * Provide aggregate stats for Room Inventory dashboard.
     */
    public function stats(Request $request): JsonResponse
    {
        AuthorizationService::ensureCanViewReports($request->user());

        return response()->json([
            'message' => 'Room statistics retrieved successfully.',
            'data' => RoomService::statsSummary(),
        ]);
    }

    /**
     * FR-015: Check bed availability.
     */
    public function availability(Request $request): JsonResponse
    {
        AuthorizationService::ensureCanViewReports($request->user());

        $availability = RoomService::getAllAvailability();

        return response()->json([
            'message' => 'Room availability retrieved successfully.',
            'data' => $availability,
        ]);
    }


    /**
     * Archive a room (Soft Delete) - FR-012a
     */
    public function archive(Request $request, Room $room): JsonResponse
    {
        AuthorizationService::ensureCanManageRooms($request->user());

        $room = RoomService::archive($request->user(), $room);

        return response()->json([
            'message' => 'Room archived successfully.',
            'data' => $room,
        ]);
    }

    /**
     * Restore an archived room - FR-012a
     */
    public function restore(Request $request, int $id): JsonResponse
    {
        AuthorizationService::ensureCanManageRooms($request->user());

        $room = RoomService::restore($request->user(), $id);

        return response()->json([
            'message' => 'Room restored successfully.',
            'data' => $room,
        ]);
    }
}
