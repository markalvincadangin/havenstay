<?php
 
 namespace App\Http\Controllers\Api;
 
 use App\Http\Controllers\Controller;
 use App\Http\Requests\Meter\AssignMeterRequest;
 use App\Http\Requests\Meter\IndexMeterRequest;
 use App\Http\Requests\Meter\ManageMeterRequest;
 use App\Http\Requests\Meter\StoreMeterReadingRequest;
 use App\Http\Resources\MeterReadingResource;
 use App\Http\Resources\MeterResource;
 use App\Models\Meter;
 use App\Models\Room;
 use App\Services\Operations\MeterService;
 use App\Support\Pagination;
 use Illuminate\Http\JsonResponse;
 use Illuminate\Http\Request;
 
 /**
  * MeterController
  * 
  * Handles API endpoints for Meter Asset Management and Metrology.
  * Optimized for HavenStay Forensic v5.0 with specialized Resources.
  */
 class MeterController extends Controller
 {
     /**
      * List all meters with specialized forensic filtering.
      */
     public function index(IndexMeterRequest $request): JsonResponse
     {
         $validated = $request->validated();
         $pageParams = Pagination::normalizePageParams($validated);
 
         $paginator = MeterService::listPaginated($validated, $pageParams['page'], $pageParams['per_page']);
 
         return $this->paginated($paginator, [], 'Meters retrieved successfully.');
     }
 
     /**
      * Retrieve detailed meter history.
      */
     public function show(ManageMeterRequest $request, Meter $meter): JsonResponse
     {
         $loaded = MeterService::getById((int) $meter->meter_id);
 
         return $this->success('Meter retrieved successfully.', new MeterResource($loaded));
     }
 
     /**
      * List meters assigned to a specific room.
      */
     public function roomMeters(ManageMeterRequest $request, Room $room): JsonResponse
     {
         $meters = MeterService::getMetersForRoom((int) $room->room_id);
 
         return $this->success('Room meters retrieved successfully.', MeterResource::collection($meters));
     }
 
     /**
      * Map a physical meter to a room (Temporal Assignment).
      */
     public function assign(AssignMeterRequest $request, Meter $meter): JsonResponse
     {
         $validated = $request->validated();
 
         $assignment = MeterService::assignToRoom(
             $request->user(),
             $meter->meter_id,
             (int) $validated['room_id'],
             $validated['start_date']
         );
 
         return $this->success('Meter assigned to room successfully.', $assignment);
     }
 
     /**
      * List readings for a specific meter.
      */
     public function listReadings(ManageMeterRequest $request, Meter $meter): JsonResponse
     {
         $readings = $meter->readings()->with('recorder')->orderByDesc('reading_date')->get();
         
         return $this->success('Meter readings retrieved successfully.', MeterReadingResource::collection($readings));
     }
 
     /**
      * Store a new meter reading with monotonicity validation.
      */
     public function recordReading(StoreMeterReadingRequest $request, Meter $meter): JsonResponse
     {
         $reading = MeterService::recordReading($request->user(), $meter->meter_id, $request->validated());
         
         $resource = new MeterReadingResource($reading);
         if ($reading->getAttribute('warning')) {
             return $this->success($reading->getAttribute('warning'), $resource, 201);
         }
 
         return $this->created('Meter reading recorded successfully.', $resource);
     }
 
     /**
      * Retrieve the last reading that was committed to a bill.
      */
     public function lastBilled(Request $request, Meter $meter): JsonResponse
     {
         $reading = MeterService::getLastBilledReading((int) $meter->meter_id);
         
         if (!$reading) {
             return $this->success('No billed readings found for this meter.', null);
         }
 
         return $this->success('Last billed reading retrieved.', new MeterReadingResource($reading));
     }
 }
