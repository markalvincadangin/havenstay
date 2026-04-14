<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Tenant;
use App\Services\AuditService;
use App\Services\AuthorizationService;
use App\Services\TenantService;
use App\Support\PaginationResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TenantController extends Controller
{
    /**
     */
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate(array_merge([
            'q' => ['nullable', 'string', 'max:200'],
            'status' => ['nullable', 'string', 'max:32'],
        ], PaginationResponse::queryRules()));

        $pageParams = PaginationResponse::normalizePageParams($validated);
        $q = $validated['q'] ?? '';
        $status = $validated['status'] ?? '';

        $paginator = TenantService::searchRichBuilder($q, $status)
            ->paginate($pageParams['per_page'], ['*'], 'page', $pageParams['page']);

        return PaginationResponse::fromPaginator($paginator);
    }

    /**
     * TC-TENANT-001
     */
    public function store(Request $request): JsonResponse
    {
        // Check authorization: only admin/staff
        if (! AuthorizationService::canManageTenants($request->user())) {
            AuditService::logAccessDenied($request->user(), 'tenants.create');


            return response()->json([
                'message' => 'Unauthorized: only Admin or Staff can create tenants.',
            ], 403);
        }

        $validated = $request->validate([
            'first_name' => ['required', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'contact_number' => ['required', 'string', 'max:20'],
            'email' => ['required', 'email', 'max:150'],
            'emergency_contact_name' => ['required', 'string', 'max:200'],
            'emergency_contact_number' => ['required', 'string', 'max:20'],
            'address' => ['required', 'string'],
        ]);

        $tenant = TenantService::create($request->user(), $validated);

        return response()->json([
            'message' => 'Tenant created successfully.',
            'tenant' => $tenant,
        ], 201);
    }

    /**
     */
    public function show(Request $request, Tenant $tenant): JsonResponse
    {
        return response()->json($tenant);
    }

    /**
     * TC-TENANT-002
     */
    public function update(Request $request, Tenant $tenant): JsonResponse
    {
        // Check authorization
        if (! AuthorizationService::canManageTenants($request->user())) {
            AuditService::logAccessDenied($request->user(), 'tenants.update');


            return response()->json([
                'message' => 'Unauthorized: only Admin or Staff can update tenants.',
            ], 403);
        }

        $validated = $request->validate([
            'first_name' => ['required', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'contact_number' => ['required', 'string', 'max:20'],
            'email' => ['required', 'email', 'max:150'],
            'emergency_contact_name' => ['required', 'string', 'max:200'],
            'emergency_contact_number' => ['required', 'string', 'max:20'],
            'address' => ['required', 'string'],
            'status' => ['sometimes', 'string', 'in:active,moved_out,archived'],
        ]);

        $tenant = TenantService::update($request->user(), $tenant, $validated);

        return response()->json([
            'message' => 'Tenant updated successfully.',
            'tenant' => $tenant,
        ]);
    }

    /**
     * TC-TENANT-002
     */
    public function deactivate(Request $request, Tenant $tenant): JsonResponse
    {
        // Check authorization
        if (! AuthorizationService::canManageTenants($request->user())) {
            AuditService::logAccessDenied($request->user(), 'tenants.deactivate');


            return response()->json([
                'message' => 'Unauthorized: only Admin or Staff can deactivate tenants.',
            ], 403);
        }

        $tenant = TenantService::deactivate($request->user(), $tenant);

        return response()->json([
            'message' => 'Tenant deactivated successfully.',
            'tenant' => $tenant,
        ]);
    }

    /**
     * TC-TENANT-002
     */
    public function reactivate(Request $request, Tenant $tenant): JsonResponse
    {
        // Check authorization
        if (! AuthorizationService::canManageTenants($request->user())) {
            AuditService::logAccessDenied($request->user(), 'tenants.reactivate');


            return response()->json([
                'message' => 'Unauthorized: only Admin or Staff can reactivate tenants.',
            ], 403);
        }

        $tenant = TenantService::reactivate($request->user(), $tenant);

        return response()->json([
            'message' => 'Tenant reactivated successfully.',
            'tenant' => $tenant,
        ]);
    }

    /**
     * TC-TENANT-003
     */
    public function search(Request $request): JsonResponse
    {
        $validated = $request->validate(array_merge([
            'q' => ['nullable', 'string', 'max:200'],
            'status' => ['nullable', 'string', 'max:32'],
        ], PaginationResponse::queryRules()));

        $pageParams = PaginationResponse::normalizePageParams($validated);
        $q = $validated['q'] ?? '';
        $status = $validated['status'] ?? '';

        $paginator = TenantService::searchRichBuilder($q, $status)
            ->paginate($pageParams['per_page'], ['*'], 'page', $pageParams['page']);

        return PaginationResponse::fromPaginator($paginator);
    }

    /**
     */
    public function archive(Request $request, Tenant $tenant): JsonResponse
    {
        if (! AuthorizationService::canManageTenants($request->user())) {
            AuditService::logAccessDenied($request->user(), 'tenants.archive');
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        AuditService::setAuditUserContext($request->user()->user_id);


        $tenant->delete(); // Eloquent SoftDeletes

        return response()->json([
            'message' => 'Tenant profile archived for forensic retention.',
            'tenant' => $tenant,
        ]);
    }

    /**
     */
    public function restore(Request $request, int $id): JsonResponse
    {
        if (! AuthorizationService::canManageTenants($request->user())) {
            AuditService::logAccessDenied($request->user(), 'tenants.restore');
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        AuditService::setAuditUserContext($request->user()->user_id);

        $tenant = Tenant::withTrashed()->findOrFail($id);
        $tenant->restore();

        return response()->json([
            'message' => 'Tenant profile restored to active operations.',
            'tenant' => $tenant,
        ]);
    }
}
