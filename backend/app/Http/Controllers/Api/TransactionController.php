<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AuditService;
use App\Services\AuthorizationService;
use App\Services\TransactionService;
use App\Support\PaginationResponse;
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

        $validated = $request->validate(array_merge([
            'q' => ['sometimes', 'nullable', 'string', 'max:200'],
            /** `transaction_logs.status` ENUM — `backend/database/sql/havenstay_schema.sql` */
            'status' => ['sometimes', 'nullable', 'string', 'in:started,committed,rolled_back,failed'],
            'from' => ['sometimes', 'nullable', 'string', 'max:32'],
            'to' => ['sometimes', 'nullable', 'string', 'max:32'],
        ], PaginationResponse::queryRules()));
        $pageParams = PaginationResponse::normalizePageParams($validated);

        $filters = array_filter(
            [
                'q' => isset($validated['q']) ? trim((string) $validated['q']) : '',
                'status' => $validated['status'] ?? '',
                'from' => $validated['from'] ?? '',
                'to' => $validated['to'] ?? '',
            ],
            fn ($v) => $v !== null && $v !== ''
        );

        $paginator = TransactionService::listLogsPaginated($pageParams['page'], $pageParams['per_page'], $filters);

        return PaginationResponse::fromPaginator($paginator);
    }
}
