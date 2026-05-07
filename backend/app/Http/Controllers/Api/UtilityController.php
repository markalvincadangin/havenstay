<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Utility\ManageUtilityRequest;
use App\Services\Core\AuthorizationService;
use App\Http\Requests\Utility\StoreUtilityRateRequest;
use App\Http\Requests\Utility\StoreUtilityRequest;
use App\Http\Requests\Utility\UpdateUtilityRequest;
use App\Http\Resources\UtilityRateResource;
use App\Http\Resources\UtilityResource;
use App\Models\Utility;
use App\Services\Operations\UtilityService;
use App\Support\OperationalHardening;
use Illuminate\Http\JsonResponse;

/**
 * UtilityController
 *
 * Handles API endpoints for the Utility Rates Registry and Catalog management.
 * Optimized for HavenStay Forensic v5.0 with strict Service-driven writes.
 */
class UtilityController extends Controller
{
    /**
     * Get the utility catalog with their active and historical rates.
     */
    public function index(ManageUtilityRequest $request): JsonResponse
    {
        $query = Utility::query();

        // Handle status filter
        $status = $request->query('status', 'active');
        if ($status === 'archived') {
            $query->onlyTrashed();
        } elseif ($status === 'all') {
            $query->withTrashed();
        }

        if ($request->filled('q')) {
            $needle = trim((string) $request->query('q'));
            $forensicId = OperationalHardening::parseForensicId($needle);

            $query->where(function ($sub) use ($needle, $forensicId) {
                if ($forensicId) {
                    $sub->where('utility_id', $forensicId);
                } else {
                    $stripped = ltrim($needle, '#');
                    $sub->where('utility_id', 'LIKE', "%{$stripped}%")
                        ->orWhere('name', 'LIKE', "%{$stripped}%")
                        ->orWhere('unit_of_measurement', 'LIKE', "%{$stripped}%");
                }
            });
        }

        // Fetch utilities, ordered by name, and eager load their rates ordered by effective_from DESC
        $utilities = $query->with(['meters', 'rates' => function ($q) {
            $q->orderBy('effective_from', 'desc');
        }])->orderBy('name')->get();

        return $this->success('Utility catalog retrieved successfully.', UtilityResource::collection($utilities));
    }

    /**
     * Get a specific utility alongside its rates and assigned meters.
     */
    public function show(ManageUtilityRequest $request, Utility $utility): JsonResponse
    {
        $utility->load(['rates' => function ($query) {
            $query->orderBy('effective_from', 'desc');
        }, 'meters']);

        return $this->success('Utility details retrieved successfully.', new UtilityResource($utility));
    }

    /**
     * Register a new utility category with an initial rate.
     * FR-023: Forensic utility setup.
     */
    public function store(StoreUtilityRequest $request): JsonResponse
    {
        $utility = UtilityService::create($request->user(), $request->validated());

        return $this->created('Utility category registered successfully.', new UtilityResource($utility));
    }

    /**
     * Update utility metadata.
     */
    public function update(UpdateUtilityRequest $request, Utility $utility): JsonResponse
    {
        $updated = UtilityService::update($request->user(), $utility, $request->validated());

        return $this->success('Utility category updated successfully.', new UtilityResource($updated));
    }

    /**
     * Archive a utility.
     */
    public function archive(ManageUtilityRequest $request, Utility $utility): JsonResponse
    {
        AuthorizationService::ensureCanManageUtilities($request->user());

        UtilityService::archive($request->user(), $utility);

        return $this->success('Utility category archived successfully.', ['utility_id' => $utility->utility_id]);
    }

    /**
     * Store a new historical rate for a utility.
     */
    public function storeRate(StoreUtilityRateRequest $request): JsonResponse
    {
        $rate = UtilityService::createRate($request->user(), $request->validated());

        return $this->created('Utility rate recorded successfully.', new UtilityRateResource($rate->load('utility')));
    }
}
