<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AuditService;
use App\Services\AuthorizationService;
use App\Services\ReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
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

        return response()->json(ReportService::occupancy());
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

        $validated = $request->validate([
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date'],
        ]);

        return response()->json(ReportService::billingSummary($validated));
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

        $validated = $request->validate([
            'tenant_id' => ['nullable', 'integer', 'exists:tenants,tenant_id'],
            'due_from' => ['nullable', 'date'],
            'due_to' => ['nullable', 'date'],
        ]);

        return response()->json(ReportService::outstandingBalances($validated));
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

        $report = ReportService::occupancy();

        return $this->csvDownload('occupancy', $report, 'occupancy-report.csv');
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

        $validated = $request->validate([
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date'],
            'payment_method' => ['nullable', 'string'],
        ]);

        return response()->json(ReportService::collectionsPerformance($validated));
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

        return response()->json(ReportService::tenantHistory($filters));
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

        $validated = $request->validate([
            'tenant_id' => ['required', 'integer', 'exists:tenants,tenant_id'],
        ]);

        return response()->json(ReportService::tenantLedger((int) $validated['tenant_id']));
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
