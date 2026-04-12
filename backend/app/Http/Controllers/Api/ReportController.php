<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AuditService;
use App\Services\AuthorizationService;
use App\Services\ReportService;
use App\Support\PaginationResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends Controller
{
    /**
     * FR-028, FR-031: Occupancy report by room and bed.
     */
    public function occupancy(Request $request): JsonResponse
    {
        if (! AuthorizationService::canViewReports($request->user())) {
            AuditService::logAccessDenied($request->user(), 'reports.occupancy');

            return response()->json(['message' => 'Unauthorized to view reports.'], 403);
        }

        $validated = $request->validate(array_merge([
            'room_type' => ['nullable', 'string', 'in:solo,shared'],
        ], PaginationResponse::queryRules()));

        $report = ReportService::occupancy([
            'room_type' => $validated['room_type'] ?? null,
        ]);

        return response()->json($this->withOptionalRowPagination($report, $request));
    }

    /**
     * FR-029, FR-031: Billing and collections report with date-range filters.
     */
    public function billingSummary(Request $request): JsonResponse
    {
        if (! AuthorizationService::canViewReports($request->user())) {
            AuditService::logAccessDenied($request->user(), 'reports.billingSummary');

            return response()->json(['message' => 'Unauthorized to view reports.'], 403);
        }

        $validated = $request->validate(array_merge([
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date'],
        ], PaginationResponse::queryRules()));

        $report = ReportService::billingSummary([
            'start_date' => $validated['start_date'] ?? null,
            'end_date' => $validated['end_date'] ?? null,
        ]);

        return response()->json($this->withOptionalRowPagination($report, $request));
    }

    /**
     * FR-030: Outstanding balances report.
     */
    public function outstandingBalances(Request $request): JsonResponse
    {
        if (! AuthorizationService::canViewReports($request->user())) {
            AuditService::logAccessDenied($request->user(), 'reports.outstandingBalances');

            return response()->json(['message' => 'Unauthorized to view reports.'], 403);
        }

        $validated = $request->validate(array_merge([
            'tenant_id' => ['nullable', 'integer', 'exists:tenants,tenant_id'],
            'due_from' => ['nullable', 'date'],
            'due_to' => ['nullable', 'date'],
        ], PaginationResponse::queryRules()));

        $report = ReportService::outstandingBalances([
            'tenant_id' => $validated['tenant_id'] ?? null,
            'due_from' => $validated['due_from'] ?? null,
            'due_to' => $validated['due_to'] ?? null,
        ]);

        return response()->json($this->withOptionalRowPagination($report, $request));
    }

    /**
     * FR-032: Export occupancy report to CSV.
     */
    public function occupancyExport(Request $request): StreamedResponse
    {
        if (! AuthorizationService::canViewReports($request->user())) {
            AuditService::logAccessDenied($request->user(), 'reports.occupancyExport');
            abort(403, 'Unauthorized to export reports.');
        }

        $validated = $request->validate([
            'room_type' => ['nullable', 'string', 'in:solo,shared'],
        ]);

        $report = ReportService::occupancy([
            'room_type' => $validated['room_type'] ?? null,
        ]);

        return $this->csvDownload('occupancy', $report, 'occupancy-report.csv');
    }

    /**
     * FR-015: Per-bed occupancy via `vw_occupancy_status` (CCR-005).
     */
    public function occupancyStatus(Request $request): JsonResponse
    {
        if (! AuthorizationService::canViewReports($request->user())) {
            AuditService::logAccessDenied($request->user(), 'reports.occupancyStatus');

            return response()->json(['message' => 'Unauthorized to view reports.'], 403);
        }

        $validated = $request->validate(array_merge([
            'room_id' => ['nullable', 'integer', 'exists:rooms,room_id'],
            'bed_status' => ['nullable', 'string', 'in:vacant,occupied,maintenance'],
        ], PaginationResponse::queryRules()));

        $report = ReportService::occupancyStatus([
            'room_id' => $validated['room_id'] ?? null,
            'bed_status' => $validated['bed_status'] ?? null,
        ]);

        return response()->json($this->withOptionalRowPagination($report, $request));
    }

    /**
     * FR-032: Export bed-level occupancy report to CSV.
     */
    public function occupancyStatusExport(Request $request): StreamedResponse
    {
        if (! AuthorizationService::canViewReports($request->user())) {
            AuditService::logAccessDenied($request->user(), 'reports.occupancyStatusExport');
            abort(403, 'Unauthorized to export reports.');
        }

        $validated = $request->validate([
            'room_id' => ['nullable', 'integer', 'exists:rooms,room_id'],
            'bed_status' => ['nullable', 'string', 'in:vacant,occupied,maintenance'],
        ]);

        $report = ReportService::occupancyStatus($validated);

        return $this->csvDownload('occupancy-status', $report, 'occupancy-status-report.csv');
    }

    /**
     * Active leases via `vw_active_contracts` (CCR-005).
     */
    public function activeContracts(Request $request): JsonResponse
    {
        if (! AuthorizationService::canViewReports($request->user())) {
            AuditService::logAccessDenied($request->user(), 'reports.activeContracts');

            return response()->json(['message' => 'Unauthorized to view reports.'], 403);
        }

        $validated = $request->validate(array_merge([
            'room_id' => ['nullable', 'integer', 'exists:rooms,room_id'],
        ], PaginationResponse::queryRules()));

        $report = ReportService::activeContracts([
            'room_id' => $validated['room_id'] ?? null,
        ]);

        return response()->json($this->withOptionalRowPagination($report, $request));
    }

    /**
     * FR-032: Export active contracts report to CSV.
     */
    public function activeContractsExport(Request $request): StreamedResponse
    {
        if (! AuthorizationService::canViewReports($request->user())) {
            AuditService::logAccessDenied($request->user(), 'reports.activeContractsExport');
            abort(403, 'Unauthorized to export reports.');
        }

        $validated = $request->validate([
            'room_id' => ['nullable', 'integer', 'exists:rooms,room_id'],
        ]);

        $report = ReportService::activeContracts($validated);

        return $this->csvDownload('active-contracts', $report, 'active-contracts-report.csv');
    }

    /**
     * FR-032: Export billing summary report to CSV.
     */
    public function billingSummaryExport(Request $request): StreamedResponse
    {
        if (! AuthorizationService::canViewReports($request->user())) {
            AuditService::logAccessDenied($request->user(), 'reports.billingSummaryExport');
            abort(403, 'Unauthorized to export reports.');
        }

        $validated = $request->validate([
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date'],
        ]);

        $report = ReportService::billingSummary($validated);

        return $this->csvDownload('billing-summary', $report, 'billing-summary-report.csv');
    }

    /**
     * FR-032: Export outstanding balances report to CSV.
     */
    public function outstandingBalancesExport(Request $request): StreamedResponse
    {
        if (! AuthorizationService::canViewReports($request->user())) {
            AuditService::logAccessDenied($request->user(), 'reports.outstandingBalancesExport');
            abort(403, 'Unauthorized to export reports.');
        }

        $validated = $request->validate([
            'tenant_id' => ['nullable', 'integer', 'exists:tenants,tenant_id'],
            'due_from' => ['nullable', 'date'],
            'due_to' => ['nullable', 'date'],
        ]);

        $report = ReportService::outstandingBalances($validated);

        return $this->csvDownload('outstanding-balances', $report, 'outstanding-balances-report.csv');
    }

    /**
     * FR-032b: Collections performance report.
     */
    public function collectionsPerformance(Request $request): JsonResponse
    {
        if (! AuthorizationService::canViewReports($request->user())) {
            AuditService::logAccessDenied($request->user(), 'reports.collectionsPerformance');

            return response()->json(['message' => 'Unauthorized to view reports.'], 403);
        }

        $validated = $request->validate(array_merge([
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date'],
            'payment_method' => ['nullable', 'string'],
        ], PaginationResponse::queryRules()));

        $report = ReportService::collectionsPerformance([
            'start_date' => $validated['start_date'] ?? null,
            'end_date' => $validated['end_date'] ?? null,
            'payment_method' => $validated['payment_method'] ?? null,
        ]);

        return response()->json($this->withOptionalRowPagination($report, $request));
    }

    /**
     * FR-032, FR-032b: Export collections performance report to CSV.
     */
    public function collectionsPerformanceExport(Request $request): StreamedResponse
    {
        if (! AuthorizationService::canViewReports($request->user())) {
            AuditService::logAccessDenied($request->user(), 'reports.collectionsPerformanceExport');
            abort(403, 'Unauthorized to export reports.');
        }

        $validated = $request->validate([
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date'],
            'payment_method' => ['nullable', 'string'],
        ]);

        $report = ReportService::collectionsPerformance($validated);

        return $this->csvDownload('collections-performance', $report, 'collections-performance-report.csv');
    }

    /**
     * FR-031, FR-032: Tenant contract history (view-backed).
     */
    public function tenantHistory(Request $request): JsonResponse
    {
        if (! AuthorizationService::canViewReports($request->user())) {
            AuditService::logAccessDenied($request->user(), 'reports.tenantHistory');

            return response()->json(['message' => 'Unauthorized to view reports.'], 403);
        }

        $validated = $request->validate(array_merge([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'status' => ['nullable', 'string', 'in:all,active,moved_out,completed,terminated'],
        ], PaginationResponse::queryRules()));

        $filters = [
            'from' => $validated['from'] ?? null,
            'to' => $validated['to'] ?? null,
            'status' => $validated['status'] ?? 'all',
        ];

        $report = ReportService::tenantHistory($filters);

        return response()->json($this->withOptionalRowPagination($report, $request));
    }

    /**
     * FR-032: Export tenant history report to CSV.
     */
    public function tenantHistoryExport(Request $request): StreamedResponse
    {
        if (! AuthorizationService::canViewReports($request->user())) {
            AuditService::logAccessDenied($request->user(), 'reports.tenantHistoryExport');
            abort(403, 'Unauthorized to export reports.');
        }

        $validated = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'status' => ['nullable', 'string', 'in:all,active,moved_out,completed,terminated'],
        ]);

        $filters = [
            'from' => $validated['from'] ?? null,
            'to' => $validated['to'] ?? null,
            'status' => $validated['status'] ?? 'all',
        ];

        $report = ReportService::tenantHistory($filters);

        return $this->csvDownload('tenant-history', $report, 'tenant-history-report.csv');
    }

    /**
     * FR-032a: Detailed tenant ledger.
     */
    public function tenantLedger(Request $request): JsonResponse
    {
        if (! AuthorizationService::canViewReports($request->user())) {
            AuditService::logAccessDenied($request->user(), 'reports.tenantLedger');

            return response()->json(['message' => 'Unauthorized to view reports.'], 403);
        }

        $validated = $request->validate(array_merge([
            'tenant_id' => ['required', 'integer', 'exists:tenants,tenant_id'],
        ], PaginationResponse::queryRules()));

        $report = ReportService::tenantLedger((int) $validated['tenant_id']);

        return response()->json($this->withOptionalRowPagination($report, $request, 'entries'));
    }

    /**
     * FR-032, FR-032a: Export tenant ledger to CSV.
     */
    public function tenantLedgerExport(Request $request): StreamedResponse
    {
        if (! AuthorizationService::canViewReports($request->user())) {
            AuditService::logAccessDenied($request->user(), 'reports.tenantLedgerExport');
            abort(403, 'Unauthorized to export reports.');
        }

        $validated = $request->validate([
            'tenant_id' => ['required', 'integer', 'exists:tenants,tenant_id'],
        ]);

        $report = ReportService::tenantLedger((int) $validated['tenant_id']);
        $tenantName = str_replace(' ', '_', strtolower($report['tenant']->name ?? 'tenant'));

        return $this->csvDownload('tenant-ledger', $report, "ledger-{$tenantName}.csv");
    }

    /**
     * When `page` or `per_page` is present, slice `rows` (or `entries`) and append `meta` (same shape as list APIs).
     *
     * @param  array<string, mixed>  $report
     * @return array<string, mixed>
     */
    private function withOptionalRowPagination(array $report, Request $request, string $key = 'rows'): array
    {
        if (! $request->filled('page') && ! $request->filled('per_page')) {
            return $report;
        }

        $pageParams = PaginationResponse::normalizePageParams(
            $request->validate(PaginationResponse::queryRules())
        );

        $rows = Collection::make($report[$key] ?? []);
        $total = $rows->count();
        $perPage = $pageParams['per_page'];
        $page = $pageParams['page'];
        $slice = $rows->forPage($page, $perPage)->values()->all();
        $report[$key] = $slice;
        $lastPage = max(1, (int) ceil($total / $perPage));
        $report['meta'] = [
            'current_page' => $page,
            'last_page' => $lastPage,
            'per_page' => $perPage,
            'total' => $total,
            'from' => $total === 0 ? null : (($page - 1) * $perPage) + 1,
            'to' => min($total, $page * $perPage),
        ];

        return $report;
    }

    private function csvDownload(string $type, array $report, string $filename): StreamedResponse
    {
        $payload = ReportService::toCsvPayload($type, $report);

        return response()->streamDownload(function () use ($payload): void {
            $output = fopen('php://output', 'w');
            if (! $output) {
                return;
            }

            fputcsv($output, $payload['headers']);
            foreach ($payload['rows'] as $row) {
                fputcsv($output, (array) $row);
            }

            fclose($output);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }
}
