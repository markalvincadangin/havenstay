<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Analytics\AuditService;
use App\Services\Identity\AuthorizationService;
use App\Support\Pagination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AuditLogController extends Controller
{

    /**
     * List system audit logs with advanced filtering.
     * Authorized: Admin only.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function index(Request $request): JsonResponse
    {
        AuthorizationService::ensureCanManageUsers($request->user());

        $validated = $request->validate(array_merge([
            'entity_type' => ['sometimes', 'nullable', 'string', 'max:64'],
            'action' => ['sometimes', 'nullable', 'string', 'in:INSERT,UPDATE,DELETE,login,logout,access_denied,status_change,archive,restore'],
            'from' => ['sometimes', 'nullable', 'string', 'max:32'],
            'to' => ['sometimes', 'nullable', 'string', 'max:32'],
            'user' => ['sometimes', 'nullable', 'string', 'max:200'],
            'correlation' => ['sometimes', 'nullable', 'string', 'max:64'],
            'q' => ['sometimes', 'nullable', 'string', 'max:255'],
        ], Pagination::queryRules()));

        $pageParams = Pagination::normalizePageParams($validated);

        $filters = array_filter(
            [
                'entity_type' => $validated['entity_type'] ?? null,
                'action' => $validated['action'] ?? null,
                'from' => $validated['from'] ?? null,
                'to' => $validated['to'] ?? null,
                'user' => $validated['user'] ?? null,
                'correlation' => isset($validated['correlation']) ? trim((string) $validated['correlation']) : null,
                'q' => $validated['q'] ?? null,
            ],
            fn ($v) => $v !== null && $v !== ''
        );

        $paginator = AuditService::listLogsPaginated($filters, $pageParams['page'], $pageParams['per_page']);

        $accessDeniedTotal = AuditService::countAccessDeniedMatchingFilters($filters);

        return Pagination::fromPaginator($paginator, [
            'access_denied_total' => $accessDeniedTotal,
        ]);
    }

    /**
     * Export audit logs to CSV for external forensic analysis.
     * Authorized: Admin only.
     *
     * @param Request $request
     * @return StreamedResponse
     */
    public function export(Request $request): StreamedResponse
    {
        AuthorizationService::ensureCanManageUsers($request->user());

        $validated = $request->validate([
            'entity_type' => ['sometimes', 'nullable', 'string', 'max:64'],
            'action' => ['sometimes', 'nullable', 'string', 'in:INSERT,UPDATE,DELETE,login,logout,access_denied,status_change,archive,restore'],
            'from' => ['sometimes', 'nullable', 'string', 'max:32'],
            'to' => ['sometimes', 'nullable', 'string', 'max:32'],
            'user' => ['sometimes', 'nullable', 'string', 'max:200'],
            'correlation' => ['sometimes', 'nullable', 'string', 'max:64'],
            'q' => ['sometimes', 'nullable', 'string', 'max:255'],
        ]);

        $filters = array_filter(
            [
                'entity_type' => $validated['entity_type'] ?? null,
                'action' => $validated['action'] ?? null,
                'from' => $validated['from'] ?? null,
                'to' => $validated['to'] ?? null,
                'user' => $validated['user'] ?? null,
                'correlation' => isset($validated['correlation']) ? trim((string) $validated['correlation']) : null,
                'q' => $validated['q'] ?? null,
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
