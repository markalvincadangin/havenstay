<?php

namespace App\Http\Controllers\Api;

use App\Http\Concerns\HandlesAuthorization;
use App\Http\Controllers\Controller;
use App\Http\Requests\Tenant\StoreTenantRequest;
use App\Http\Requests\Tenant\UpdateTenantRequest;
use App\Models\Tenant;
use App\Services\AuthorizationService;
use App\Services\PiiMaskingService;
use App\Services\TenantService;
use App\Support\PaginationResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TenantController extends Controller
{
    use HandlesAuthorization;

    /**
     * Get all tenants
     */
    public function index(Request $request): JsonResponse
    {
        return $this->listTenants($request, 'tenants.index', 'Unauthorized: you do not have permission to view tenants.');
    }

    /**
     * Get tenant summary
     */
    public function summary(Request $request): JsonResponse
    {
        if (!AuthorizationService::canViewTenants($request->user())) {
            return $this->forbidden($request, 'tenants.summary', 'Unauthorized: you do not have permission to view tenant summary.');
        }

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
        if (!AuthorizationService::canManageTenants($request->user())) {
            return $this->forbidden($request, 'tenants.create', 'Unauthorized: only Admin or Staff can create tenants.');
        }

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
        if (!AuthorizationService::canViewTenants($request->user())) {
            return $this->forbidden($request, 'tenants.show', 'Unauthorized: you do not have permission to view tenants.');
        }

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
        if (!AuthorizationService::canManageTenants($request->user())) {
            return $this->forbidden($request, 'tenants.update', 'Unauthorized: only Admin or Staff can update tenants.');
        }

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
        if (!AuthorizationService::canManageTenants($request->user())) {
            return $this->forbidden($request, 'tenants.reactivate', 'Unauthorized: only Admin or Staff can reactivate tenants.');
        }

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
        return $this->listTenants($request, 'tenants.search', 'Unauthorized: you do not have permission to search tenants.');
    }

    /**
     * Archive a tenant
     */
    public function archive(Request $request, Tenant $tenant): JsonResponse
    {
        if (!AuthorizationService::canManageTenants($request->user())) {
            return $this->forbidden($request, 'tenants.archive', 'Unauthorized: only Admin or Staff can archive tenants.');
        }

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
        if (!AuthorizationService::canManageTenants($request->user())) {
            return $this->forbidden($request, 'tenants.restore', 'Unauthorized: only Admin or Staff can restore tenants.');
        }

        $tenant = TenantService::restore($request->user(), $id);

        return response()->json([
            'message' => 'Tenant profile restored to active operations.',
            'data' => $tenant,
        ]);
    }

    private function listTenants(Request $request, string $resource, string $forbiddenMessage): JsonResponse
    {
        if (!AuthorizationService::canViewTenants($request->user())) {
            return $this->forbidden($request, $resource, $forbiddenMessage);
        }

        $validated = $request->validate(array_merge([
            'q' => ['nullable', 'string', 'max:200'],
            'status' => ['nullable', 'string', 'in:active,moved_out,archived'],
        ], PaginationResponse::queryRules()));

        $pageParams = PaginationResponse::normalizePageParams($validated);
        $q = $validated['q'] ?? '';
        $status = $validated['status'] ?? '';

        $paginator = TenantService::searchRichBuilder($q, $status)
            ->paginate($pageParams['per_page'], ['*'], 'page', $pageParams['page']);

        $paginator->through(function ($tenant) use ($request) {
            return PiiMaskingService::maybeMaskTenantArray($request->user(), $tenant->toArray());
        });

        return PaginationResponse::fromPaginator($paginator);
    }

}
