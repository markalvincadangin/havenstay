<?php

namespace App\Http\Controllers\Api;

use App\Models\Room;
use App\Models\RoomMeterReading;
use App\Http\Controllers\Controller;
use App\Services\Identity\AuthorizationService;
use App\Services\Analytics\PiiMaskingService;
use App\Services\Analytics\ReportService;
use App\Support\Pagination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends Controller
{
    /**
     */
    public function occupancy(Request $request): JsonResponse
    {
        AuthorizationService::ensureCanViewReports($request->user());

        $validated = $request->validate(array_merge([
            'room_type' => ['nullable', 'string', 'in:solo,shared'],
        ], Pagination::queryRules()));

        $report = ReportService::occupancy([
            'room_type' => $validated['room_type'] ?? null,
        ]);

        return response()->json($this->withOptionalRowPagination($report, $request));
    }

    /**
     */
    public function billingSummary(Request $request): JsonResponse
    {
        AuthorizationService::ensureCanViewReports($request->user());

        $validated = $request->validate(array_merge([
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date'],
            'current_month' => ['nullable', 'boolean'],
        ], Pagination::queryRules()));

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
        AuthorizationService::ensureCanViewReports($request->user());

        $validated = $request->validate(array_merge([
            'tenant_id' => ['nullable', 'integer', 'exists:tenants,tenant_id'],
            'due_from' => ['nullable', 'date'],
            'due_to' => ['nullable', 'date'],
        ], Pagination::queryRules()));

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
        AuthorizationService::ensureCanViewReports($request->user());

        $validated = $request->validate([
            'room_type' => ['nullable', 'string', 'in:solo,shared'],
        ]);

        $report = ReportService::occupancy([
            'room_type' => $validated['room_type'] ?? null,
        ]);

        return $this->csvDownload('occupancy', $report, 'occupancy-report.csv');
    }

    public function occupancyStatus(Request $request): JsonResponse
    {
        AuthorizationService::ensureCanViewReports($request->user());

        $validated = $request->validate(array_merge([
            'room_id' => ['nullable', 'integer', 'exists:rooms,room_id'],
            'bed_status' => ['nullable', 'string', 'in:vacant,occupied,maintenance'],
        ], Pagination::queryRules()));

        $report = ReportService::occupancyStatus($validated);

        $report = $this->finalizeReportForViewer($request, 'occupancy_status', $report);

        return response()->json($this->withOptionalRowPagination($report, $request));
    }

    /**
     */
    public function occupancyStatusExport(Request $request): StreamedResponse
    {
        AuthorizationService::ensureCanViewReports($request->user());

        $validated = $request->validate([
            'room_id' => ['nullable', 'integer', 'exists:rooms,room_id'],
            'bed_status' => ['nullable', 'string', 'in:vacant,occupied,maintenance'],
        ]);

        $report = ReportService::occupancyStatus($validated);

        return $this->csvDownload('occupancy-status', $report, 'occupancy-status-report.csv');
    }

    /**
     */
    public function activeContracts(Request $request): JsonResponse
    {
        AuthorizationService::ensureCanViewReports($request->user());

        $validated = $request->validate(array_merge([
            'room_id' => ['nullable', 'integer', 'exists:rooms,room_id'],
        ], Pagination::queryRules()));

        $report = ReportService::activeContracts($validated);

        $report = $this->finalizeReportForViewer($request, 'active_contracts', $report);

        return response()->json($this->withOptionalRowPagination($report, $request));
    }

    /**
     */
    public function summaryStats(Request $request): JsonResponse
    {
        AuthorizationService::ensureCanViewReports($request->user());

        $report = ReportService::summaryStats();

        return response()->json($report);
    }

    /**
     */
    public function activeContractsExport(Request $request): StreamedResponse
    {
        AuthorizationService::ensureCanViewReports($request->user());

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
        AuthorizationService::ensureCanViewReports($request->user());

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
        AuthorizationService::ensureCanViewReports($request->user());

        $validated = $request->validate([
            'tenant_id' => ['nullable', 'integer', 'exists:tenants,tenant_id'],
            'due_from' => ['nullable', 'date'],
            'due_to' => ['nullable', 'date'],
        ]);

        $report = ReportService::outstandingBalances($validated);

        $report = $this->finalizeReportForViewer($request, 'outstanding_balances', $report);

        return $this->csvDownload('outstanding-balances', $report, 'outstanding-balances-report.csv');
    }

    public function collectionsPerformance(Request $request): JsonResponse
    {
        AuthorizationService::ensureCanViewReports($request->user());

        $validated = $request->validate(array_merge([
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date'],
            'payment_method' => ['nullable', 'string'],
        ], Pagination::queryRules()));

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
        AuthorizationService::ensureCanViewReports($request->user());

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
    public function collectionsByCategory(Request $request): JsonResponse
    {
        AuthorizationService::ensureCanViewReports($request->user());

        $validated = $request->validate(array_merge([
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date'],
        ], Pagination::queryRules()));

        $report = ReportService::collectionsByCategory($validated);

        return response()->json($this->withOptionalRowPagination($report, $request));
    }

    /**
     */
    public function tenantHistory(Request $request): JsonResponse
    {
        AuthorizationService::ensureCanViewReports($request->user());

        $validated = $request->validate(array_merge([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'status' => ['nullable', 'string', 'in:all,active,moved_out,completed,terminated'],
        ], Pagination::queryRules()));

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
    public function agingReceivables(Request $request): JsonResponse
    {
        AuthorizationService::ensureCanViewReports($request->user());

        $report = ReportService::agingReceivables();

        return response()->json($report);
    }

    /**
     */
    public function tenantHistoryExport(Request $request): StreamedResponse
    {
        AuthorizationService::ensureCanViewReports($request->user());

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
        AuthorizationService::ensureCanViewReports($request->user());

        $validated = $request->validate(array_merge([
            'tenant_id' => ['required', 'integer', 'exists:tenants,tenant_id'],
        ], Pagination::queryRules()));

        $report = ReportService::tenantLedger((int) $validated['tenant_id']);

        $report = $this->finalizeReportForViewer($request, 'tenant_ledger', $report);

        return response()->json($this->withOptionalRowPagination($report, $request, 'entries'));
    }

    /**
     */
    public function tenantLedgerExport(Request $request): StreamedResponse
    {
        AuthorizationService::ensureCanViewReports($request->user());

        $validated = $request->validate([
            'tenant_id' => ['required', 'integer', 'exists:tenants,tenant_id'],
        ]);

        $report = ReportService::tenantLedger((int) $validated['tenant_id']);

        $report = $this->finalizeReportForViewer($request, 'tenant_ledger', $report);

        $tenantName = str_replace(' ', '_', strtolower($report['tenant']['name'] ?? 'tenant'));

        return $this->csvDownload('tenant-ledger', $report, "ledger-{$tenantName}.csv");
    }

    /**
     */
    public function revenueProjection(Request $request): JsonResponse
    {
        AuthorizationService::ensureCanViewReports($request->user());

        $report = ReportService::revenueProjection();

        return response()->json($report);
    }
    
    /**
     */
    public function checkInEfficiency(Request $request): JsonResponse
    {
        AuthorizationService::ensureCanViewReports($request->user());

        $report = ReportService::checkInEfficiency();

        return response()->json($report);
    }

    /**
     */
    public function auditPulse(Request $request): JsonResponse
    {
        AuthorizationService::ensureCanViewReports($request->user());

        $report = ReportService::auditPulse();

        return response()->json($report);
    }

    /**
     */
    public function inventoryHealth(Request $request): JsonResponse
    {
        AuthorizationService::ensureCanViewReports($request->user());

        $report = ReportService::inventoryHealth();

        return response()->json($report);
    }

    /**
     */
    public function upcomingMoveOuts(Request $request): JsonResponse
    {
        AuthorizationService::ensureCanViewReports($request->user());

        $report = ReportService::upcomingMoveOuts();

        return response()->json($report);
    }

    /**
     * FR-023: Compliance summary for utility metering coverage.
     * Aligned with Tier-1 Forensic Audit: Pending reading filters for active billing cycle.
     */
    public function meterCoverage(Request $request): JsonResponse
    {
        AuthorizationService::ensureCanViewReports($request->user());

        $totalRooms = Room::count();
        if ($totalRooms === 0) {
            return response()->json([
                'electric_coverage' => 0,
                'water_coverage' => 0,
                'high_delta_alerts' => 0,
                'electric_pending_count' => 0,
                'water_pending_count' => 0,
            ]);
        }

        $currentMonthStart = Carbon::now()->startOfMonth()->toDateString();
        $currentMonthEnd = Carbon::now()->endOfMonth()->toDateString();
        
        // Coverage: Rooms with at least one reading recorded in the current billing month
        $elecRoomsCount = RoomMeterReading::where('utility_type', 'electric')
            ->whereBetween('reading_date', [$currentMonthStart, $currentMonthEnd])
            ->distinct('room_id')
            ->count('room_id');
            
        $waterRoomsCount = RoomMeterReading::where('utility_type', 'water')
            ->whereBetween('reading_date', [$currentMonthStart, $currentMonthEnd])
            ->distinct('room_id')
            ->count('room_id');

        // High-Delta Alerts: Current consumption reflects a spike (> 100 units as a forensic threshold for the KPI)
        // Simplified to prevent SQL execution errors in complex subqueries while maintaining forensic visibility.
        $highDeltaCount = RoomMeterReading::whereBetween('reading_date', [$currentMonthStart, $currentMonthEnd])
            ->whereRaw('reading_value - (SELECT r2.reading_value FROM room_meter_readings r2 WHERE r2.room_id = room_meter_readings.room_id AND r2.utility_type = room_meter_readings.utility_type AND r2.reading_date < room_meter_readings.reading_date ORDER BY r2.reading_date DESC LIMIT 1) > 100')
            ->count();

        return response()->json([
            'total_rooms' => $totalRooms,
            'electric_coverage' => round(($elecRoomsCount / $totalRooms) * 100, 1),
            'water_coverage' => round(($waterRoomsCount / $totalRooms) * 100, 1),
            'high_delta_alerts' => $highDeltaCount,
            'electric_pending_count' => max(0, $totalRooms - $elecRoomsCount),
            'water_pending_count' => max(0, $totalRooms - $waterRoomsCount),
        ]);
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

        $pageParams = Pagination::normalizePageParams(
            $request->validate(Pagination::queryRules())
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
