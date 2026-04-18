<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Compliance\AttachAddOnRequest;
use App\Http\Requests\Compliance\StoreMeterReadingRequest;
use App\Models\AddOn;
use App\Models\Contract;
use App\Models\Room;
use App\Models\RoomMeterReading;
use App\Services\Identity\AuthorizationService;
use App\Services\Operations\ComplianceService;
use App\Support\Pagination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ComplianceController extends Controller
{
    /**
     * List all allowable appliances from the registry.
     * Supports pagination, keyword search (q), and status filtering.
     */
    public function index(Request $request): JsonResponse
    {
        AuthorizationService::ensureCanViewCompliance($request->user());
        $query = AddOn::query()
            ->withCount([
                'contracts as active_contracts_count' => function ($q) {
                    $q->where('status', Contract::STATUS_ACTIVE);
                }
            ]);

        if ($request->filled('q')) {
            $keyword = strtolower($request->input('q'));
            $query->whereRaw('LOWER(item_name) LIKE ?', ["%{$keyword}%"]);
        }

        if ($request->filled('is_active')) {
            $query->where('is_active', filter_var($request->input('is_active'), FILTER_VALIDATE_BOOLEAN));
        }

        $perPage = $request->integer('per_page', 15);
        $appliances = $query->orderBy('item_name')->paginate($perPage);

        return Pagination::fromPaginator($appliances);
    }

    /**
     * Get summary metrics for the Assets & Services registry.
     */
    public function registryStats(Request $request): JsonResponse
    {
        AuthorizationService::ensureCanViewCompliance($request->user());

        $totalItems = AddOn::count();
        $availableItems = AddOn::where('is_active', true)->count();
        
        // Sum cross-referenced active assignments and projected yield
        $assignments = \DB::table('contract_add_ons')
            ->join('contracts', 'contract_add_ons.contract_id', '=', 'contracts.contract_id')
            ->where('contracts.status', Contract::STATUS_ACTIVE)
            ->selectRaw('COUNT(*) as total_assignments, SUM(contract_add_ons.actual_rate) as yield')
            ->first();

        return response()->json([
            'total_items' => $totalItems,
            'available_items' => $availableItems,
            'active_assignments' => (int)($assignments->total_assignments ?? 0),
            'projected_monthly_yield' => (float)($assignments->yield ?? 0.0),
        ]);
    }

    public function listAddOns(Request $request): JsonResponse
    {
        AuthorizationService::ensureCanViewCompliance($request->user());
        return response()->json(AddOn::orderBy('item_name')->get());
    }

    /**
     * Retrieve a single appliance entry for detail/edit view.
     */
    public function show(Request $request, AddOn $addOn): JsonResponse
    {
        AuthorizationService::ensureCanViewCompliance($request->user());
        return response()->json($addOn->loadCount([
            'contracts as active_contracts_count' => function ($q) {
                $q->where('status', Contract::STATUS_ACTIVE);
            }
        ]));
    }

    /**
     * Register a new allowable appliance in the master registry.
     */
    public function storeAddOn(Request $request): JsonResponse
    {
        AuthorizationService::ensureCanManageCompliance($request->user());
        $validated = $request->validate([
            'item_name' => 'required|string|max:100|unique:add_on_registry,item_name',
            'default_monthly_rate' => 'required|numeric|min:0',
            'is_active' => 'boolean',
        ]);

        $addOn = ComplianceService::storeRegistryItem($request->user(), $validated);

        return response()->json($addOn, 201);
    }

    /**
     * Update an appliance entry in the registry.
     */
    public function updateAddOn(Request $request, AddOn $addOn): JsonResponse
    {
        AuthorizationService::ensureCanManageCompliance($request->user());
        $validated = $request->validate([
            'item_name' => 'string|max:100|unique:add_on_registry,item_name,' . $addOn->add_on_id . ',add_on_id',
            'default_monthly_rate' => 'numeric|min:0',
            'is_active' => 'boolean',
        ]);

        $addOn->update($validated);

        return response()->json($addOn);
    }

    /**
     * Attach an appliance to a specific contract.
     */
    public function attachAddOn(AttachAddOnRequest $request, int $contractId): JsonResponse
    {
        AuthorizationService::ensureCanManageCompliance($request->user());

        ComplianceService::attachAddOn($request->user(), $contractId, $request->validated());

        return response()->json(['message' => 'Appliance attached successfully.'], 201);
    }

    /**
     * Detach an appliance from a contract (Forensic Reversal).
     */
    public function destroyContractAddOn(Request $request, int $contractId, int $addOnId): JsonResponse
    {
        AuthorizationService::ensureCanManageCompliance($request->user());

        ComplianceService::detachAddOn($request->user(), $contractId, $addOnId);

        return response()->json(['message' => 'Appliance detached successfully.']);
    }

    /**
     * List historical meter readings for a specific room.
     */
    public function listRoomMeters(Request $request, Room $room): JsonResponse
    {
        AuthorizationService::ensureCanViewCompliance($request->user());
        $readings = RoomMeterReading::where('room_id', $room->room_id)
            ->with('recorder:user_id,first_name,last_name')
            ->orderByDesc('reading_date')
            ->orderByDesc('created_at')
            ->get();

        return response()->json($readings);
    }

    /**
     * Record a new room meter reading via ComplianceService.
     */
    public function storeMeterReading(StoreMeterReadingRequest $request, Room $room): JsonResponse
    {
        AuthorizationService::ensureCanManageCompliance($request->user());

        $reading = ComplianceService::storeMeterReading($request->user(), $room, $request->validated());

        return response()->json($reading->load('recorder:user_id,first_name,last_name'), 201);
    }
}
