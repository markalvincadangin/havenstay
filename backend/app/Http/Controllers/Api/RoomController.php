<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BedSpace;
use App\Models\Room;
use App\Services\AuditService;
use App\Services\AuthorizationService;
use App\Services\RoomService;
use App\Support\PaginationResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RoomController extends Controller
{
    /**
     * FR-012: List all rooms
     */
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate(array_merge([
            'q' => ['nullable', 'string', 'max:200'],
            'status' => ['nullable', 'string', 'in:available,unavailable,maintenance'],
            'room_type' => ['nullable', 'string', 'in:solo,shared'],
        ], PaginationResponse::queryRules()));

        $pageParams = PaginationResponse::normalizePageParams($validated);

        $query = Room::with('bedSpaces')->orderBy('room_code');

        if (! empty($validated['status'])) {
            $query->where('status', $validated['status']);
        }

        if (! empty($validated['room_type'])) {
            $query->where('room_type', $validated['room_type']);
        }

        if (! empty($validated['q'])) {
            $needle = $validated['q'];
            $query->where(function ($w) use ($needle): void {
                $w->where('room_code', 'LIKE', "%{$needle}%")
                    ->orWhere('amenities', 'LIKE', "%{$needle}%")
                    ->orWhere('description', 'LIKE', "%{$needle}%");
            });
        }

        $paginator = $query->paginate($pageParams['per_page'], ['*'], 'page', $pageParams['page']);

        return PaginationResponse::fromPaginator($paginator);
    }

    /**
     * FR-012, FR-013: Create a new room
     * TC-ROOM-001
     */
    public function store(Request $request): JsonResponse
    {
        // Check authorization: only admin/staff
        if (! AuthorizationService::canManageUsers($request->user()) && ! $request->user()->canStaff()) {
            AuditService::logAccessDenied($request->user(), 'rooms.create');

            return response()->json([
                'message' => 'Unauthorized: only Admin or Staff can create rooms.',
            ], 403);
        }

        $validated = $request->validate([
            'room_code' => ['required', 'string', 'max:20', 'unique:rooms'],
            'room_type' => ['required', 'in:solo,shared'],
            'capacity' => ['sometimes', 'integer', 'min:1'],
            'monthly_rate' => ['required', 'numeric', 'min:0'],
            'status' => ['sometimes', 'in:available,unavailable,maintenance'],
            'amenities' => ['nullable', 'string'],
            'description' => ['nullable', 'string'],
            'bed_spaces' => ['sometimes', 'array'],
            'bed_spaces.*.bed_label' => ['required_with:bed_spaces', 'string', 'max:20'],
            'bed_spaces.*.status' => ['sometimes', 'in:vacant,occupied,maintenance'],
        ]);

        $room = RoomService::create($validated);

        return response()->json([
            'message' => 'Room created successfully.',
            'room' => $room->load('bedSpaces'),
        ], 201);
    }

    /**
     * FR-012: Get a specific room
     */
    public function show(Request $request, Room $room): JsonResponse
    {
        return response()->json($room->load('bedSpaces'));
    }

    /**
     * FR-012, FR-013: Update a room
     */
    public function update(Request $request, Room $room): JsonResponse
    {
        // Check authorization
        if (! AuthorizationService::canManageUsers($request->user()) && ! $request->user()->canStaff()) {
            AuditService::logAccessDenied($request->user(), 'rooms.update');

            return response()->json([
                'message' => 'Unauthorized: only Admin or Staff can update rooms.',
            ], 403);
        }

        $validated = $request->validate([
            'room_type' => ['sometimes', 'in:solo,shared'],
            'capacity' => ['sometimes', 'integer', 'min:1'],
            'monthly_rate' => ['sometimes', 'numeric', 'min:0'],
            'status' => ['sometimes', 'in:available,unavailable,maintenance'],
            'amenities' => ['sometimes', 'nullable', 'string'],
            'description' => ['sometimes', 'nullable', 'string'],
            'bed_spaces' => ['sometimes', 'array'],
            'bed_spaces.*.bed_space_id' => ['sometimes', 'nullable', 'integer', 'exists:bed_spaces,bed_space_id'],
            'bed_spaces.*.bed_label' => ['required_with:bed_spaces', 'string', 'max:20'],
            'bed_spaces.*.status' => ['sometimes', 'in:vacant,occupied,maintenance'],
        ]);

        $room = RoomService::update($room, $validated);

        return response()->json([
            'message' => 'Room updated successfully.',
            'room' => $room->load('bedSpaces'),
        ]);
    }

    /**
     * FR-014: Add bed spaces to a shared room
     * TC-BED-001
     */
    public function addBedSpace(Request $request, Room $room): JsonResponse
    {
        // Check authorization
        if (! AuthorizationService::canManageUsers($request->user()) && ! $request->user()->canStaff()) {
            AuditService::logAccessDenied($request->user(), 'bed_spaces.create');

            return response()->json([
                'message' => 'Unauthorized: only Admin or Staff can add bed spaces.',
            ], 403);
        }

        $validated = $request->validate([
            'bed_label' => ['required', 'string', 'max:20'],
        ]);

        try {
            $bedSpace = RoomService::addBedSpace($room, $validated['bed_label']);

            return response()->json([
                'message' => 'Bed space added successfully.',
                'bed_space' => $bedSpace,
            ], 201);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Error adding bed space: '.$e->getMessage(),
            ], 422);
        }
    }

    /**
     * FR-014, TC-BED-002: Mark a bed space as occupied
     * Used by tests to verify double-occupancy prevention
     */
    public function occupyBedSpace(Request $request, BedSpace $bedSpace): JsonResponse
    {
        // Check authorization
        if (! AuthorizationService::canManageUsers($request->user()) && ! $request->user()->canStaff()) {
            AuditService::logAccessDenied($request->user(), 'bed_spaces.occupy');

            return response()->json([
                'message' => 'Unauthorized: only Admin or Staff can occupy bed spaces.',
            ], 403);
        }

        try {
            $bedSpace = RoomService::occupyBedSpace($bedSpace);

            return response()->json([
                'message' => 'Bed space occupied successfully.',
                'bed_space' => $bedSpace,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Error: Bed space already occupied or invalid.',
                'error' => $e->getMessage(),
            ], 409);
        }
    }

    /**
     * FR-015: Get availability status for all rooms
     * CCR-005: Use JOIN logic (rooms + bed_spaces)
     */
    public function availability(Request $request): JsonResponse
    {
        $availability = RoomService::getAllAvailability();

        return response()->json([
            'availability' => $availability,
        ]);
    }
}
