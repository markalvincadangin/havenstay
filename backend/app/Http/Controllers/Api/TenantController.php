<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Tenant\StoreTenantRequest;
use App\Http\Requests\Tenant\UpdateTenantRequest;
use App\Models\Tenant;
use App\Services\Analytics\PiiMaskingService;
use App\Services\Identity\AuthorizationService;
use App\Services\Operations\TenantService;
use App\Support\Pagination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TenantController extends Controller
{

    /**
     * Get all tenants
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function index(Request $request): JsonResponse
    {
        return $this->listTenants($request);
    }

    /**
     * Get tenant summary
     */
    public function summary(Request $request): JsonResponse
    {
        AuthorizationService::ensureCanViewTenants($request->user());

        $summary = TenantService::summary();

        return response()->json([
            'message' => 'Tenant summary retrieved successfully.',
            'data' => $summary,
        ]);
    }

    /**
     * Create a new tenant
     */
    public function store(StoreTenantRequest $request): JsonResponse
    {
        AuthorizationService::ensureCanManageTenants($request->user());

        $validated = $request->validated();

        $tenant = TenantService::create($request->user(), $validated);

        return response()->json([
            'message' => 'Tenant created successfully.',
            'data' => $tenant,
        ], 201);
    }

    /**
     * Get a tenant by ID
     */
    public function show(Request $request, int $id): JsonResponse
    {
        AuthorizationService::ensureCanViewTenants($request->user());

        $tenant = TenantService::findByIdWithTrashedOrFail($id);
        $payload = PiiMaskingService::maybeMaskTenantArray($request->user(), $tenant->toArray());

        return response()->json([
            'message' => 'Tenant retrieved successfully.',
            'data' => $payload,
        ]);
    }

    /**
     * Update a tenant
     */
    public function update(UpdateTenantRequest $request, Tenant $tenant): JsonResponse
    {
        AuthorizationService::ensureCanManageTenants($request->user());

        $validated = $request->validated();

        $tenant = TenantService::update($request->user(), $tenant, $validated);

        return response()->json([
            'message' => 'Tenant updated successfully.',
            'data' => $tenant,
        ]);
    }

    /**
     * Reactivate a tenant
     */
    public function reactivate(Request $request, Tenant $tenant): JsonResponse
    {
        AuthorizationService::ensureCanManageTenants($request->user());

        $tenant = TenantService::reactivate($request->user(), $tenant);

        return response()->json([
            'message' => 'Tenant reactivated successfully.',
            'data' => $tenant,
        ]);
    }

    /**
     * Search tenants
     */
    public function search(Request $request): JsonResponse
    {
        return $this->listTenants($request);
    }

    /**
     * Archive a tenant
     */
    public function archive(Request $request, Tenant $tenant): JsonResponse
    {
        AuthorizationService::ensureCanManageTenants($request->user());

        $tenant = TenantService::archive($request->user(), $tenant);

        return response()->json([
            'message' => 'Tenant profile archived for forensic retention.',
            'data' => $tenant,
        ]);
    }

    /**
     * Restore a tenant
     */
    public function restore(Request $request, int $id): JsonResponse
    {
        AuthorizationService::ensureCanManageTenants($request->user());

        $tenant = TenantService::restore($request->user(), $id);

        return response()->json([
            'message' => 'Tenant profile restored to active operations.',
            'data' => $tenant,
        ]);
    }

    public function listTenants(Request $request): JsonResponse
    {
        AuthorizationService::ensureCanViewTenants($request->user());

        $validated = $request->validate(array_merge([
            'q' => ['nullable', 'string', 'max:200'],
            'status' => ['nullable', 'string', 'in:active,moved_out,archived'],
        ], Pagination::queryRules()));

        $pageParams = Pagination::normalizePageParams($validated);
        $q = $validated['q'] ?? '';
        $status = $validated['status'] ?? '';

        $paginator = TenantService::searchRichBuilder($q, $status)
            ->paginate($pageParams['per_page'], ['*'], 'page', $pageParams['page']);

        $paginator->through(function ($tenant) use ($request) {
            return PiiMaskingService::maybeMaskTenantArray($request->user(), $tenant->toArray());
        });

        return Pagination::fromPaginator($paginator);
    }

}
