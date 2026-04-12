<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AuditService;
use App\Services\AuthorizationService;
use App\Support\PaginationResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AuditLogController extends Controller
{
    /**
     * List audit logs with filters.
     *
     * FR-033
     */
    public function index(Request $request): JsonResponse
    {
        if (! AuthorizationService::canManageUsers($request->user())) {
            AuditService::logAccessDenied($request->user(), 'audit_logs.list');

            return response()->json([
                'message' => 'Unauthorized: only Admin can view audit logs.',
            ], 403);
        }

        $validated = $request->validate(array_merge([
            'entity_type' => ['sometimes', 'nullable', 'string', 'max:64'],
            /** `audit_logs.action` ENUM — `backend/database/sql/havenstay_schema.sql` */
            'action' => ['sometimes', 'nullable', 'string', 'in:create,update,delete,login,logout,access_denied,status_change'],
            'from' => ['sometimes', 'nullable', 'string', 'max:32'],
            'to' => ['sometimes', 'nullable', 'string', 'max:32'],
            'user' => ['sometimes', 'nullable', 'string', 'max:200'],
            'correlation' => ['sometimes', 'nullable', 'string', 'max:64'],
        ], PaginationResponse::queryRules()));

        $pageParams = PaginationResponse::normalizePageParams($validated);

        $filters = array_filter(
            [
                'entity_type' => $validated['entity_type'] ?? null,
                'action' => $validated['action'] ?? null,
                'from' => $validated['from'] ?? null,
                'to' => $validated['to'] ?? null,
                'user' => $validated['user'] ?? null,
                'correlation' => isset($validated['correlation']) ? trim((string) $validated['correlation']) : null,
            ],
            fn ($v) => $v !== null && $v !== ''
        );

        $paginator = AuditService::listLogsPaginated($filters, $pageParams['page'], $pageParams['per_page']);

        $accessDeniedTotal = AuditService::countAccessDeniedMatchingFilters($filters);

        return PaginationResponse::fromPaginator($paginator, [
            'access_denied_total' => $accessDeniedTotal,
        ]);
    }

    /**
     * FR-032-style CSV export; filters match {@see index()} query params (`entity_type`, `action`, `from`, `to`, `user`).
     */
    public function export(Request $request): StreamedResponse
    {
        if (! AuthorizationService::canManageUsers($request->user())) {
            AuditService::logAccessDenied($request->user(), 'audit_logs.export');

            abort(403, 'Unauthorized: only Admin can export audit logs.');
        }

        $validated = $request->validate([
            'entity_type' => ['sometimes', 'nullable', 'string', 'max:64'],
            'action' => ['sometimes', 'nullable', 'string', 'in:create,update,delete,login,logout,access_denied,status_change'],
            'from' => ['sometimes', 'nullable', 'string', 'max:32'],
            'to' => ['sometimes', 'nullable', 'string', 'max:32'],
            'user' => ['sometimes', 'nullable', 'string', 'max:200'],
            'correlation' => ['sometimes', 'nullable', 'string', 'max:64'],
        ]);

        $filters = array_filter(
            [
                'entity_type' => $validated['entity_type'] ?? null,
                'action' => $validated['action'] ?? null,
                'from' => $validated['from'] ?? null,
                'to' => $validated['to'] ?? null,
                'user' => $validated['user'] ?? null,
                'correlation' => isset($validated['correlation']) ? trim((string) $validated['correlation']) : null,
            ],
            fn ($v) => $v !== null && $v !== ''
        );
        $payload = AuditService::auditLogsCsvPayload($filters);

        return response()->streamDownload(function () use ($payload): void {
            $output = fopen('php://output', 'w');
            if (! $output) {
                return;
            }

            fputcsv($output, $payload['headers']);
            foreach ($payload['rows'] as $row) {
                fputcsv($output, $row);
            }

            fclose($output);
        }, 'audit-logs.csv', [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }
}
