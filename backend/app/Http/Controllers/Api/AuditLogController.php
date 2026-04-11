<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AuditService;
use App\Services\AuthorizationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuditLogController extends Controller
{
    /**
     * List audit logs with filters.
     *
     * FR-033, FR-034
     */
    public function index(Request $request): JsonResponse
    {
        if (! AuthorizationService::canManageUsers($request->user())) {
            AuditService::logAccessDenied($request->user(), 'audit_logs.list');

            return response()->json([
                'message' => 'Unauthorized: only Admin can view audit logs.',
            ], 403);
        }

        $logs = AuditService::listLogs($request->all());

        return response()->json($logs);
    }
}
