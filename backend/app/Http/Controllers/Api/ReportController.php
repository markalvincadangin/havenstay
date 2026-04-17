<?php

namespace App\Http\Controllers\Api;

use App\Http\Concerns\HandlesAuthorization;
use App\Http\Controllers\Controller;
use App\Services\AuthorizationService;
use App\Services\PiiMaskingService;
use App\Services\ReportService;
use App\Support\PaginationResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends Controller
{
    use HandlesAuthorization;

    /**
     */
    public function occupancy(Request $request): JsonResponse
    {
        if (! AuthorizationService::canViewReports($request->user())) {
            return $this->forbidden($request, 'reports.occupancy', 'Unauthorized to view reports.');
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
     */
    public function billingSummary(Request $request): JsonResponse
    {
        if (! AuthorizationService::canViewReports($request->user())) {
            return $this->forbidden($request, 'reports.billingSummary', 'Unauthorized to view reports.');
        }

        $validated = $request->validate(array_merge([
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date'],
            'current_month' => ['nullable', 'boolean'],
        ], PaginationResponse::queryRules()));

        $report = ReportService::billingSummary([
            'start_date' => $validated['start_date'] ?? null,
            'end_date' => $validated['end_date'] ?? null,
            'current_month' => (bool) ($validated['current_month'] ?? false),
        ]);

        $report = $this->finalizeReportForViewer($request, 'billing_summary', $report);

        return response()->json($this->withOptionalRowPagination($report, $request));
    }

    /**
     */
    public function outstandingBalances(Request $request): JsonResponse
    {
        if (! AuthorizationService::canViewReports($request->user())) {
            return $this->forbidden($request, 'reports.outstandingBalances', 'Unauthorized to view reports.');
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

        $report = $this->finalizeReportForViewer($request, 'outstanding_balances', $report);

        return response()->json($this->withOptionalRowPagination($report, $request));
    }

    /**
     */
    public function occupancyExport(Request $request): StreamedResponse
    {
        if (! AuthorizationService::canViewReports($request->user())) {
            $this->forbiddenExport($request, 'reports.occupancyExport', 'Unauthorized to export reports.');
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
     */
    public function occupancyStatus(Request $request): JsonResponse
    {
        if (! AuthorizationService::canViewReports($request->user())) {
            return $this->forbidden($request, 'reports.occupancyStatus', 'Unauthorized to view reports.');
        }

        $validated = $request->validate(array_merge([
            'room_id' => ['nullable', 'integer', 'exists:rooms,room_id'],
            'bed_status' => ['nullable', 'string', 'in:vacant,occupied,maintenance'],
        ], PaginationResponse::queryRules()));

        $report = ReportService::occupancyStatus([
            'room_id' => $validated['room_id'] ?? null,
            'bed_status' => $validated['bed_status'] ?? null,
        ]);

        $report = $this->finalizeReportForViewer($request, 'occupancy_status', $report);

        return response()->json($this->withOptionalRowPagination($report, $request));
    }

    /**
     */
    public function occupancyStatusExport(Request $request): StreamedResponse
    {
        if (! AuthorizationService::canViewReports($request->user())) {
            $this->forbiddenExport($request, 'reports.occupancyStatusExport', 'Unauthorized to export reports.');
        }

        $validated = $request->validate([
            'room_id' => ['nullable', 'integer', 'exists:rooms,room_id'],
            'bed_status' => ['nullable', 'string', 'in:vacant,occupied,maintenance'],
        ]);

        $report = ReportService::occupancyStatus($validated);

        $report = $this->finalizeReportForViewer($request, 'occupancy_status', $report);

        return $this->csvDownload('occupancy-status', $report, 'occupancy-status-report.csv');
    }

    /**
     * Active leases via `vw_active_contracts` (CCR-005).
     */
    public function activeContracts(Request $request): JsonResponse
    {
        if (! AuthorizationService::canViewReports($request->user())) {
            return $this->forbidden($request, 'reports.activeContracts', 'Unauthorized to view reports.');
        }

        $validated = $request->validate(array_merge([
            'room_id' => ['nullable', 'integer', 'exists:rooms,room_id'],
        ], PaginationResponse::queryRules()));

        $report = ReportService::activeContracts([
            'room_id' => $validated['room_id'] ?? null,
        ]);

        $report = $this->finalizeReportForViewer($request, 'active_contracts', $report);

        return response()->json($this->withOptionalRowPagination($report, $request));
    }

    /**
     */
    public function activeContractsExport(Request $request): StreamedResponse
    {
        if (! AuthorizationService::canViewReports($request->user())) {
            $this->forbiddenExport($request, 'reports.activeContractsExport', 'Unauthorized to export reports.');
        }

        $validated = $request->validate([
            'room_id' => ['nullable', 'integer', 'exists:rooms,room_id'],
        ]);

        $report = ReportService::activeContracts($validated);

        $report = $this->finalizeReportForViewer($request, 'active_contracts', $report);

        return $this->csvDownload('active-contracts', $report, 'active-contracts-report.csv');
    }

    /**
     */
    public function billingSummaryExport(Request $request): StreamedResponse
    {
        if (! AuthorizationService::canViewReports($request->user())) {
            $this->forbiddenExport($request, 'reports.billingSummaryExport', 'Unauthorized to export reports.');
        }

        $validated = $request->validate([
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date'],
            'current_month' => ['nullable', 'boolean'],
        ]);

        $report = ReportService::billingSummary($validated);

        $report = $this->finalizeReportForViewer($request, 'billing_summary', $report);

        return $this->csvDownload('billing-summary', $report, 'billing-summary-report.csv');
    }

    /**
     */
    public function outstandingBalancesExport(Request $request): StreamedResponse
    {
        if (! AuthorizationService::canViewReports($request->user())) {
            $this->forbiddenExport($request, 'reports.outstandingBalancesExport', 'Unauthorized to export reports.');
        }

        $validated = $request->validate([
            'tenant_id' => ['nullable', 'integer', 'exists:tenants,tenant_id'],
            'due_from' => ['nullable', 'date'],
            'due_to' => ['nullable', 'date'],
        ]);

        $report = ReportService::outstandingBalances($validated);

        $report = $this->finalizeReportForViewer($request, 'outstanding_balances', $report);

        return $this->csvDownload('outstanding-balances', $report, 'outstanding-balances-report.csv');
    }

    /**
     */
    public function collectionsPerformance(Request $request): JsonResponse
    {
        if (! AuthorizationService::canViewReports($request->user())) {
            return $this->forbidden($request, 'reports.collectionsPerformance', 'Unauthorized to view reports.');
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

        $report = $this->finalizeReportForViewer($request, 'collections_performance', $report);

        return response()->json($this->withOptionalRowPagination($report, $request));
    }

    /**
     */
    public function collectionsPerformanceExport(Request $request): StreamedResponse
    {
        if (! AuthorizationService::canViewReports($request->user())) {
            $this->forbiddenExport($request, 'reports.collectionsPerformanceExport', 'Unauthorized to export reports.');
        }

        $validated = $request->validate([
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date'],
            'payment_method' => ['nullable', 'string'],
        ]);

        $report = ReportService::collectionsPerformance($validated);

        $report = $this->finalizeReportForViewer($request, 'collections_performance', $report);

        return $this->csvDownload('collections-performance', $report, 'collections-performance-report.csv');
    }

    /**
     */
    public function tenantHistory(Request $request): JsonResponse
    {
        if (! AuthorizationService::canViewReports($request->user())) {
            return $this->forbidden($request, 'reports.tenantHistory', 'Unauthorized to view reports.');
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

        $report = $this->finalizeReportForViewer($request, 'tenant_history', $report);

        return response()->json($this->withOptionalRowPagination($report, $request));
    }

    /**
     */
    public function tenantHistoryExport(Request $request): StreamedResponse
    {
        if (! AuthorizationService::canViewReports($request->user())) {
            $this->forbiddenExport($request, 'reports.tenantHistoryExport', 'Unauthorized to export reports.');
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

        $report = $this->finalizeReportForViewer($request, 'tenant_history', $report);

        return $this->csvDownload('tenant-history', $report, 'tenant-history-report.csv');
    }

    /**
     */
    public function tenantLedger(Request $request): JsonResponse
    {
        if (! AuthorizationService::canViewReports($request->user())) {
            return $this->forbidden($request, 'reports.tenantLedger', 'Unauthorized to view reports.');
        }

        $validated = $request->validate(array_merge([
            'tenant_id' => ['required', 'integer', 'exists:tenants,tenant_id'],
        ], PaginationResponse::queryRules()));

        $report = ReportService::tenantLedger((int) $validated['tenant_id']);

        $report = $this->finalizeReportForViewer($request, 'tenant_ledger', $report);

        return response()->json($this->withOptionalRowPagination($report, $request, 'entries'));
    }

    /**
     */
    public function tenantLedgerExport(Request $request): StreamedResponse
    {
        if (! AuthorizationService::canViewReports($request->user())) {
            $this->forbiddenExport($request, 'reports.tenantLedgerExport', 'Unauthorized to export reports.');
        }

        $validated = $request->validate([
            'tenant_id' => ['required', 'integer', 'exists:tenants,tenant_id'],
        ]);

        $report = ReportService::tenantLedger((int) $validated['tenant_id']);

        $report = $this->finalizeReportForViewer($request, 'tenant_ledger', $report);

        $tenantName = str_replace(' ', '_', strtolower($report['tenant']['name'] ?? 'tenant'));

        return $this->csvDownload('tenant-ledger', $report, "ledger-{$tenantName}.csv");
    }

    /**
     * Apply NFR-015 Viewer masking to report payloads (JSON and CSV).
     *
     * @param  array<string, mixed>  $report
     * @return array<string, mixed>
     */
    private function finalizeReportForViewer(Request $request, string $reportKey, array $report): array
    {
        return PiiMaskingService::maskReportForViewer($request->user(), $reportKey, $report);
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
