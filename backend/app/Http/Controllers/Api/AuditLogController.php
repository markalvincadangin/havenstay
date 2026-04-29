<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\AuditLog\ExportAuditLogRequest;
use App\Http\Requests\AuditLog\IndexAuditLogRequest;
use App\Http\Resources\AuditLogResource;
use App\Services\Analytics\AuditReportingService;
use App\Support\Pagination;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * AuditLogController
 *
 * Handles administrative inspection and export of system audit logs.
 * Strictly restricted to Admin role.
 */
class AuditLogController extends Controller
{
    /**
     * List system audit logs with advanced filtering.
     */
    public function index(IndexAuditLogRequest $request): JsonResponse
    {
        $validated = $request->validated();
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

        $paginator = AuditReportingService::listLogsPaginated($filters, $pageParams['page'], $pageParams['per_page']);

        // Use the helper's ability to transform the paginator items
        $paginator->through(fn ($item) => new AuditLogResource($item));

        $accessDeniedTotal = AuditReportingService::countAccessDeniedMatchingFilters($filters);

        return $this->paginated($paginator, [
            'access_denied_total' => $accessDeniedTotal,
        ], 'Audit logs retrieved successfully.');
    }

    /**
     * Export audit logs to CSV for external analysis.
     */
    public function export(ExportAuditLogRequest $request): StreamedResponse
    {
        $validated = $request->validated();

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
        $payload = AuditReportingService::auditLogsCsvPayload($filters);

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
