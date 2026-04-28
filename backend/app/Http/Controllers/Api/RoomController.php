<?php
 
 namespace App\Http\Controllers\Api;
 
 use App\Http\Controllers\Controller;
 use App\Http\Requests\Room\AddBedSpaceRequest;
 use App\Http\Requests\Room\IndexRoomRequest;
 use App\Http\Requests\Room\ManageRoomRequest;
 use App\Http\Requests\Room\OccupyBedSpaceRequest;
 use App\Http\Requests\Room\StoreRoomRequest;
 use App\Http\Requests\Room\UpdateRoomRequest;
 use App\Http\Resources\BedSpaceResource;
 use App\Http\Resources\RoomResource;
 use App\Models\BedSpace;
 use App\Models\Room;
 use App\Services\Operations\RoomService;
 use App\Support\Pagination;
 use Illuminate\Http\JsonResponse;
 use Illuminate\Http\Request;
 
 /**
  * RoomController
  * 
  * Manages physical room assets and bed-space availability.
  * Optimized for HavenStay Forensic v5.0 with recursive Resource wrapping.
  */
 class RoomController extends Controller
 {
     /**
      * FR-012: List all rooms with bed space relationships.
      */
     public function index(IndexRoomRequest $request): JsonResponse
     {
         $validated = $request->validated();
         $pageParams = Pagination::normalizePageParams($validated);
 
         $paginator = RoomService::listPaginated($validated, $pageParams['page'], $pageParams['per_page']);
 
         return $this->paginated($paginator, [], 'Rooms retrieved successfully.', RoomResource::class);
     }
 
     /**
      * Create a new room entry.
      */
     public function store(StoreRoomRequest $request): JsonResponse
     {
         $room = RoomService::create($request->user(), $request->validated());
 
         return $this->created('Room created successfully.', new RoomResource($room->load('bedSpaces')));
     }
 
     /**
      * Retrieve detailed room profile.
      */
     public function show(ManageRoomRequest $request, Room $room): JsonResponse
     {
         return $this->success('Room retrieved successfully.', new RoomResource($room->load([
             'bedSpaces.activeContract.tenant',
             'meterAssignments.meter'
         ])));
     }
 
     /**
      * Update an existing room record.
      */
     public function update(UpdateRoomRequest $request, Room $room): JsonResponse
     {
         $room = RoomService::update($request->user(), $room, $request->validated());
 
         return $this->success('Room updated successfully.', new RoomResource($room->load('bedSpaces')));
     }
 
     /**
      * Add a new bed space to a room (BR-ROM-002 check in Service).
      */
     public function addBedSpace(AddBedSpaceRequest $request, Room $room): JsonResponse
     {
         $bedSpace = RoomService::addBedSpace($request->user(), $room, $request->validated()['bed_label']);
 
         return $this->created('Bed space added successfully.', new BedSpaceResource($bedSpace));
     }
 
     /**
      * Used by forensic tests to verify occupancy states.
      */
     public function occupyBedSpace(OccupyBedSpaceRequest $request, BedSpace $bedSpace): JsonResponse
     {
         $bedSpace = RoomService::occupyBedSpace($request->user(), $bedSpace);
 
         return $this->success('Bed space occupied successfully.', new BedSpaceResource($bedSpace));
     }
 
     /**
      * Provide aggregate stats for Room Inventory dashboard.
      */
     public function stats(ManageRoomRequest $request): JsonResponse
     {
         return $this->success('Room statistics retrieved successfully.', RoomService::statsSummary());
     }
 
     /**
      * FR-015: Check bed availability.
      */
     public function availability(ManageRoomRequest $request): JsonResponse
     {
         $availability = RoomService::getAllAvailability();
 
         return $this->success('Room availability retrieved successfully.', $availability);
     }
 
     /**
      * Archive a room (Soft Delete).
      */
     public function archive(ManageRoomRequest $request, Room $room): JsonResponse
     {
         $room = RoomService::archive($request->user(), $room);
 
         return $this->success('Room archived successfully.', new RoomResource($room));
     }
 
     /**
      * Restore an archived room record.
      */
     public function restore(ManageRoomRequest $request, int $id): JsonResponse
     {
         $room = RoomService::restore($request->user(), $id);
 
         return $this->success('Room restored successfully.', new RoomResource($room));
     }
 }