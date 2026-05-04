<?php

namespace App\Http\Controllers\Api;

use App\Enums\AuditAction;
use App\Enums\EventCategory;
use App\Http\Controllers\Controller;
use App\Http\Requests\AuditLog\ExportAuditLogRequest;
use App\Http\Requests\AuditLog\IndexAuditLogRequest;
use App\Http\Resources\AuditLogResource;
use App\Models\AuditLog;
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

        $paginator = AuditReportingService::listLogsPaginated($validated, $pageParams['page'], $pageParams['per_page']);

        // Use the helper's ability to transform the paginator items
        $paginator->through(fn ($item) => new AuditLogResource($item));

        $accessDeniedTotal = AuditReportingService::countAccessDeniedMatchingFilters($validated);

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

        $payload = AuditReportingService::auditLogsCsvPayload($validated);
        
        // Record the export action in the forensic ledger
        AuditLog::create([
            'action' => AuditAction::EXPORT,
            'event_category' => EventCategory::SECURITY,
            'target_table' => 'audit_logs',
            'record_id' => 0,
            'is_success' => true,
            'metadata' => [
                'filters' => $validated,
                'row_count' => count($payload['rows']),
            ],
        ]);

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
