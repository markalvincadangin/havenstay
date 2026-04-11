<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AuditService;
use App\Services\AuthorizationService;
use App\Services\TransactionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TransactionController extends Controller
{
    /**
     * FR-034: Transaction Log Retrieval (Adherence to CCR-007)
     */
    public function index(Request $request): JsonResponse
    {
        if (! AuthorizationService::canManageUsers($request->user())) {
            AuditService::logAccessDenied($request->user(), 'transaction_logs.list');

            return response()->json([
                'message' => 'Unauthorized: only Admin can view transaction logs.',
            ], 403);
        }

        try {
            $logs = TransactionService::listLogs();

            return response()->json($logs);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }
}
