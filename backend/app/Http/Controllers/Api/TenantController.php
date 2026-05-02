<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Tenant\IndexTenantRequest;
use App\Http\Requests\Tenant\ManageTenantRequest;
use App\Http\Requests\Tenant\StoreTenantRequest;
use App\Http\Requests\Tenant\UpdateTenantRequest;
use App\Http\Requests\Tenant\ViewTenantRequest;
use App\Http\Resources\TenantResource;
use App\Models\Tenant;
use App\Services\Operations\TenantService;
use App\Support\Pagination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * TenantController
 *
 * Manages tenant profiles and state reconciliation.
 * Optimized for HavenStay Forensic v5.0 with API Resource serialization.
 */
class TenantController extends Controller
{
    /**
     * FR-011: List all tenants with filtering and masking.
     */
    public function index(IndexTenantRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $pageParams = Pagination::normalizePageParams($validated);

        $paginator = TenantService::listPaginated($validated, $pageParams['page'], $pageParams['per_page']);

        return $this->paginated($paginator, [], 'Tenants retrieved successfully.', TenantResource::class);
    }

    /**
     * FR-011b: Retrieve summary statistics for tenant distribution.
     */
    public function summary(Request $request): JsonResponse
    {
        $summary = TenantService::summary();

        return $this->success('Tenant summary retrieved successfully.', $summary);
    }

    /**
     * FR-011c: Lightweight tenant search for autocompletes.
     */
    public function search(Request $request): JsonResponse
    {
        $query = $request->query('q', '');
        $status = $request->query('status', '');

        $results = TenantService::searchRichBuilder($query, $status)->limit(20)->get();

        return $this->success('Search results retrieved.', TenantResource::collection($results));
    }

    /**
     * FR-011a: Retrieve detailed tenant forensic record.
     */
    public function show(ViewTenantRequest $request, Tenant $tenant): JsonResponse
    {
        $loaded = TenantService::getById((int) $tenant->tenant_id);
        if (! $loaded) {
            return $this->error('Tenant not found.', 404);
        }

        return $this->success('Tenant retrieved successfully.', new TenantResource($loaded));
    }

    /**
     * FR-012: Register a new tenant.
     */
    public function store(StoreTenantRequest $request): JsonResponse
    {
        $tenant = TenantService::create($request->user(), $request->validated());

        return $this->created('Tenant created successfully.', new TenantResource($tenant));
    }

    /**
     * FR-013: Update tenant contact information.
     */
    public function update(UpdateTenantRequest $request, Tenant $tenant): JsonResponse
    {
        $updated = TenantService::update($request->user(), $tenant, $request->validated());

        return $this->success('Tenant updated successfully.', new TenantResource($updated));
    }

    /**
     * FR-014: Archive tenant record (Soft Delete).
     */
    public function archive(ManageTenantRequest $request, Tenant $tenant): JsonResponse
    {
        $archived = TenantService::archive($request->user(), $tenant);

        return $this->success('Tenant archived successfully.', new TenantResource($archived));
    }

    /**
     * Reactivate a moved-out or inactive tenant.
     */
    public function reactivate(ManageTenantRequest $request, Tenant $tenant): JsonResponse
    {
        $reactivated = TenantService::reactivate($request->user(), $tenant);

        return $this->success('Tenant reactivated successfully.', new TenantResource($reactivated));
    }

    /**
     * Restore an archived tenant record.
     */
    public function restore(ManageTenantRequest $request, int $id): JsonResponse
    {
        $restored = TenantService::restore($request->user(), $id);

        return $this->success('Tenant restored successfully.', new TenantResource($restored));
    }
}
