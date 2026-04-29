<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Report\ManageReportsRequest;
use App\Services\Analytics\PiiMaskingService;
use App\Services\Analytics\ReportService;
use App\Services\Core\AuthorizationService;
use App\Support\Pagination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * ReportController
 *
 * Orchestrates analytical reporting, including occupancy, financial summaries,
 * and security audit logs.
 */
class ReportController extends Controller
{
    /**
     * FR-028: Room Occupancy Distribution.
     */
    public function occupancy(ManageReportsRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $page = $request->integer('page');
        $perPage = $request->integer('per_page', 25);

        $report = ReportService::occupancy(
            $validated,
            $request->filled('page') ? $page : null,
            $request->filled('per_page') ? $perPage : null
        );

        return $this->success('Occupancy report generated successfully.', $report);
    }

    /**
     * FR-029: Monthly Billing and Revenue Summary.
     */
    public function billingSummary(ManageReportsRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $page = $request->integer('page');
        $perPage = $request->integer('per_page', 25);

        $report = ReportService::billingSummary([
            'start_date' => $validated['start_date'] ?? null,
            'end_date' => $validated['end_date'] ?? null,
            'current_month' => filter_var($validated['current_month'] ?? false, FILTER_VALIDATE_BOOLEAN),
        ],
            $request->filled('page') ? $page : null,
            $request->filled('per_page') ? $perPage : null);

        $report = $this->finalizeReportForViewer($request, 'billing_summary', $report);

        return $this->success('Billing summary report generated successfully.', $report);
    }

    /**
     * FR-030: Tenant Aging and Outstanding Balances.
     */
    public function outstandingBalances(ManageReportsRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $page = $request->integer('page');
        $perPage = $request->integer('per_page', 25);

        $report = ReportService::outstandingBalances(
            $validated,
            $request->filled('page') ? $page : null,
            $request->filled('per_page') ? $perPage : null
        );

        $report = $this->finalizeReportForViewer($request, 'outstanding_balances', $report);

        return $this->success('Outstanding balances report generated successfully.', $report);
    }

    /**
     * FR-031: Asset-level Occupancy Status.
     */
    public function occupancyStatus(ManageReportsRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $page = $request->integer('page');
        $perPage = $request->integer('per_page', 25);

        $report = ReportService::occupancyStatus(
            $validated,
            $request->filled('page') ? $page : null,
            $request->filled('per_page') ? $perPage : null
        );

        $report = $this->finalizeReportForViewer($request, 'occupancy_status', $report);

        return $this->success('Occupancy status report generated successfully.', $report);
    }

    /**
     * FR-032: Active Lease Portfolio.
     */
    public function activeContracts(ManageReportsRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $page = $request->integer('page');
        $perPage = $request->integer('per_page', 25);

        $report = ReportService::activeContracts(
            $validated,
            $request->filled('page') ? $page : null,
            $request->filled('per_page') ? $perPage : null
        );

        $report = $this->finalizeReportForViewer($request, 'active_contracts', $report);

        return $this->success('Active contracts report generated successfully.', $report);
    }

    /**
     * FR-033: Global Collections Performance.
     */
    public function collectionsPerformance(ManageReportsRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $report = ReportService::collectionsPerformance($validated);

        $report = $this->finalizeReportForViewer($request, 'collections_performance', $report);

        return $this->success('Collections performance report generated successfully.', $this->withOptionalRowPagination($report, $request));
    }

    /**
     * FR-034: Historical Tenant Activity Log.
     */
    public function tenantHistory(ManageReportsRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $report = ReportService::tenantHistory($validated);

        $report = $this->finalizeReportForViewer($request, 'tenant_history', $report);

        return $this->success('Tenant history report generated successfully.', $this->withOptionalRowPagination($report, $request));
    }

    /**
     * FR-035: Granular Tenant Financial Ledger.
     */
    public function tenantLedger(ManageReportsRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $report = ReportService::tenantLedger((int) $validated['tenant_id']);

        $report = $this->finalizeReportForViewer($request, 'tenant_ledger', $report);

        return $this->success('Tenant ledger report generated successfully.', $this->withOptionalRowPagination($report, $request, 'entries'));
    }

    /**
     * FR-054: Security Pulse Metrics (Audit Activity).
     */
    public function securityPulse(Request $request): JsonResponse
    {
        AuthorizationService::ensureCanViewAuditLogs($request->user());

        $pulse = ReportService::securityPulse();

        return $this->success('Security pulse retrieved.', $pulse);
    }

    /**
     * FR-023: Meter Asset Management & Usage Summary.
     */
    public function meterCoverage(ManageReportsRequest $request): JsonResponse
    {
        $report = ReportService::meterSummary();

        return $this->success('Meter coverage report generated successfully.', $report);
    }

    /**
     * FR-055: User Governance Summary.
     */
    public function userSummary(Request $request): JsonResponse
    {
        AuthorizationService::ensureCanManageUsers($request->user());

        $summary = ReportService::userSummary();

        return $this->success('User summary retrieved.', $summary);
    }

    /**
     * Summary dashboard statistics.
     */
    public function summaryStats(ManageReportsRequest $request): JsonResponse
    {
        $report = ReportService::summaryStats();

        return $this->success('Summary statistics retrieved successfully.', $report);
    }

    /**
     * CSV Export: Occupancy Distribution.
     */
    public function occupancyExport(ManageReportsRequest $request): StreamedResponse
    {
        $report = ReportService::occupancy($request->validated());

        return $this->csvDownload('occupancy', $report, 'occupancy-report.csv');
    }

    /**
     * CSV Export: Occupancy Status.
     */
    public function occupancyStatusExport(ManageReportsRequest $request): StreamedResponse
    {
        $report = ReportService::occupancyStatus($request->validated());

        return $this->csvDownload('occupancy-status', $report, 'occupancy-status-report.csv');
    }

    /**
     * CSV Export: Active Contracts.
     */
    public function activeContractsExport(ManageReportsRequest $request): StreamedResponse
    {
        $report = ReportService::activeContracts($request->validated());
        $report = $this->finalizeReportForViewer($request, 'active_contracts', $report);

        return $this->csvDownload('active-contracts', $report, 'active-contracts-report.csv');
    }

    /**
     * CSV Export: Billing Summary.
     */
    public function billingSummaryExport(ManageReportsRequest $request): StreamedResponse
    {
        $report = ReportService::billingSummary($request->validated());
        $report = $this->finalizeReportForViewer($request, 'billing_summary', $report);

        return $this->csvDownload('billing-summary', $report, 'billing-summary-report.csv');
    }

    /**
     * CSV Export: Outstanding Balances.
     */
    public function outstandingBalancesExport(ManageReportsRequest $request): StreamedResponse
    {
        $report = ReportService::outstandingBalances($request->validated());
        $report = $this->finalizeReportForViewer($request, 'outstanding_balances', $report);

        return $this->csvDownload('outstanding-balances', $report, 'outstanding-balances-report.csv');
    }

    /**
     * CSV Export: Collections Performance.
     */
    public function collectionsPerformanceExport(ManageReportsRequest $request): StreamedResponse
    {
        $report = ReportService::collectionsPerformance($request->validated());
        $report = $this->finalizeReportForViewer($request, 'collections_performance', $report);

        return $this->csvDownload('collections-performance', $report, 'collections-performance-report.csv');
    }

    /**
     * CSV Export: Tenant History.
     */
    public function tenantHistoryExport(ManageReportsRequest $request): StreamedResponse
    {
        $report = ReportService::tenantHistory($request->validated());
        $report = $this->finalizeReportForViewer($request, 'tenant_history', $report);

        return $this->csvDownload('tenant-history', $report, 'tenant-history-report.csv');
    }

    /**
     * CSV Export: Tenant Ledger.
     */
    public function tenantLedgerExport(ManageReportsRequest $request): StreamedResponse
    {
        $report = ReportService::tenantLedger((int) $request->validated()['tenant_id']);
        $report = $this->finalizeReportForViewer($request, 'tenant_ledger', $report);

        $tenantName = str_replace(' ', '_', strtolower($report['tenant']['name'] ?? 'tenant'));

        return $this->csvDownload('tenant-ledger', $report, "ledger-{$tenantName}.csv");
    }

    /**
     * NFR-015: Apply Viewer masking to report payloads.
     */
    private function finalizeReportForViewer(Request $request, string $reportKey, array $report): array
    {
        return PiiMaskingService::maskReportForViewer($request->user(), $reportKey, $report);
    }

    /**
     * Append meta for row pagination.
     */
    private function withOptionalRowPagination(array $report, Request $request, string $key = 'rows'): array
    {
        if (! $request->filled('page') && ! $request->filled('per_page')) {
            return $report;
        }

        $pageParams = Pagination::normalizePageParams($request->all());

        $rows = Collection::make($report[$key] ?? []);
        $total = $rows->count();
        $perPage = $pageParams['per_page'];
        $page = $pageParams['page'];
        $slice = $rows->forPage($page, $perPage)->values()->all();
        $report[$key] = $slice;

        $report['meta'] = [
            'current_page' => $page,
            'last_page' => max(1, (int) ceil($total / $perPage)),
            'per_page' => $perPage,
            'total' => $total,
            'from' => $total > 0 ? ($page - 1) * $perPage + 1 : 0,
            'to' => min($total, $page * $perPage),
        ];

        return $report;
    }

    /**
     * Standardized CSV stream generator.
     */
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
