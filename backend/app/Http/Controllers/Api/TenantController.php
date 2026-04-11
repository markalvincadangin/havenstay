<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Tenant;
use App\Services\AuditService;
use App\Services\AuthorizationService;
use App\Services\TenantService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TenantController extends Controller
{
    /**
     * FR-008: List all tenants
     */
    public function index(Request $request): JsonResponse
    {
        $tenants = TenantService::allRich();

        return response()->json($tenants);
    }

    /**
     * FR-008, FR-009: Create a new tenant
     * TC-TENANT-001
     */
    public function store(Request $request): JsonResponse
    {
        // Check authorization: only admin/staff
        if (! AuthorizationService::canManageUsers($request->user()) && ! $request->user()->canStaff()) {
            AuditService::logAccessDenied($request->user(), 'tenants.create');

            return response()->json([
                'message' => 'Unauthorized: only Admin or Staff can create tenants.',
            ], 403);
        }

        $validated = $request->validate([
            'first_name' => ['required', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'contact_number' => ['required', 'string', 'max:20'],
            'email' => ['nullable', 'email', 'max:150'],
            'emergency_contact_name' => ['required', 'string', 'max:200'],
            'emergency_contact_number' => ['required', 'string', 'max:20'],
            'address' => ['required', 'string'],
        ]);

        $tenant = TenantService::create($validated);

        return response()->json([
            'message' => 'Tenant created successfully.',
            'tenant' => $tenant,
        ], 201);
    }

    /**
     * FR-008: Get a specific tenant
     */
    public function show(Request $request, Tenant $tenant): JsonResponse
    {
        return response()->json($tenant);
    }

    /**
     * FR-008, FR-009: Update a tenant
     * TC-TENANT-002
     */
    public function update(Request $request, Tenant $tenant): JsonResponse
    {
        // Check authorization
        if (! AuthorizationService::canManageUsers($request->user()) && ! $request->user()->canStaff()) {
            AuditService::logAccessDenied($request->user(), 'tenants.update');

            return response()->json([
                'message' => 'Unauthorized: only Admin or Staff can update tenants.',
            ], 403);
        }

        $validated = $request->validate([
            'first_name' => ['required', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'contact_number' => ['required', 'string', 'max:20'],
            'email' => ['nullable', 'email', 'max:150'],
            'emergency_contact_name' => ['required', 'string', 'max:200'],
            'emergency_contact_number' => ['required', 'string', 'max:20'],
            'address' => ['required', 'string'],
            'status' => ['sometimes', 'string', 'in:active,moved_out,archived'],
        ]);

        $tenant = TenantService::update($tenant, $validated);

        return response()->json([
            'message' => 'Tenant updated successfully.',
            'tenant' => $tenant,
        ]);
    }

    /**
     * FR-010: Deactivate a tenant (move_out)
     * TC-TENANT-002
     */
    public function deactivate(Request $request, Tenant $tenant): JsonResponse
    {
        // Check authorization
        if (! AuthorizationService::canManageUsers($request->user()) && ! $request->user()->canStaff()) {
            AuditService::logAccessDenied($request->user(), 'tenants.deactivate');

            return response()->json([
                'message' => 'Unauthorized: only Admin or Staff can deactivate tenants.',
            ], 403);
        }

        $tenant = TenantService::deactivate($tenant);

        return response()->json([
            'message' => 'Tenant deactivated successfully.',
            'tenant' => $tenant,
        ]);
    }

    /**
     * FR-010: Reactivate a tenant
     * TC-TENANT-002
     */
    public function reactivate(Request $request, Tenant $tenant): JsonResponse
    {
        // Check authorization
        if (! AuthorizationService::canManageUsers($request->user()) && ! $request->user()->canStaff()) {
            AuditService::logAccessDenied($request->user(), 'tenants.reactivate');

            return response()->json([
                'message' => 'Unauthorized: only Admin or Staff can reactivate tenants.',
            ], 403);
        }

        $tenant = TenantService::reactivate($tenant);

        return response()->json([
            'message' => 'Tenant reactivated successfully.',
            'tenant' => $tenant,
        ]);
    }

    /**
     * FR-011: Search tenants by name, contact, status
     * TC-TENANT-003
     * CCR-004: Use LIKE operator
     */
    public function search(Request $request): JsonResponse
    {
        $query = $request->query('q', '');
        $status = $request->query('status', '');

        $tenants = TenantService::searchRich($query, $status);

        return response()->json([
            'tenants' => $tenants,
            'count' => count($tenants),
        ]);
    }
}
