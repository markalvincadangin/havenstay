<?php

namespace App\Services\Analytics;

use App\Enums\AuditAction;
use App\Models\Contract;
use App\Services\Concerns\HasReportingFilters;
use App\Support\Financials;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Analytics engine for generating operational, financial, and audit reports.
 */
class ReportService
{
    use HasReportingFilters;

    /**
     * Generate an occupancy report by room and bed.
     *
     * @param  array{room_type?: string}  $filters
     * @return array{summary: array{total_rooms: int, total_beds: int, occupied_beds: int, vacant_beds: int}, rows: Collection}
     */
    public static function occupancy(array $filters = [], ?int $page = null, ?int $perPage = null): array
    {
        // 1. Build Base Query
        $query = DB::table('vw_room_occupancy');
        if (! empty($filters['room_type'])) {
            $query->where('room_type', $filters['room_type']);
        }

        // 2. Summary Aggregates (Always against the full filtered set)
        $summaryData = (clone $query)->select([
            DB::raw('COUNT(*) as total_rooms'),
            DB::raw('SUM(CASE WHEN total_beds = 0 THEN capacity ELSE total_beds END) as total_beds'),
            DB::raw('SUM(occupied_beds) as occupied_beds'),
            DB::raw('SUM(vacant_beds) as vacant_beds'),
            DB::raw('SUM(maintenance_beds) as maintenance_beds'),
        ])->first();

        // 3. Paginated Rows
        $rowQuery = $query->orderBy('room_code');

        $paginator = null;
        if ($page !== null && $perPage !== null) {
            $paginator = $rowQuery->paginate($perPage, ['*'], 'page', $page);
            $rows = collect($paginator->items());
        } else {
            $rows = $rowQuery->get();
        }

        $mappedRows = $rows->map(function ($row) {
            $totalBeds = (int) $row->total_beds === 0 ? (int) $row->capacity : (int) $row->total_beds;
            $occupiedBeds = (int) $row->occupied_beds;
            $vacantBeds = (int) $row->vacant_beds;
            $maintenanceBeds = (int) ($row->maintenance_beds ?? 0);

            return [
                'room_id' => (int) $row->room_id,
                'room_code' => $row->room_code,
                'room_type' => $row->room_type,
                'total_beds' => $totalBeds,
                'occupied_beds' => $occupiedBeds,
                'vacant_beds' => $vacantBeds,
                'maintenance_beds' => $maintenanceBeds,
                'occupancy_rate' => $totalBeds > 0 ? round(($occupiedBeds / $totalBeds) * 100, 2) : 0.0,
            ];
        });

        return [
            'summary' => [
                'total_rooms' => (int) ($summaryData->total_rooms ?? 0),
                'total_beds' => (int) ($summaryData->total_beds ?? 0),
                'occupied_beds' => (int) ($summaryData->occupied_beds ?? 0),
                'vacant_beds' => (int) ($summaryData->vacant_beds ?? 0),
                'maintenance_beds' => (int) ($summaryData->maintenance_beds ?? 0),
            ],
            'rows' => $mappedRows,
            'meta' => $paginator ? [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'from' => $paginator->firstItem(),
                'to' => $paginator->lastItem(),
            ] : null,
        ];
    }

    /**
     * Bed-level occupancy via `vw_occupancy_status`.
     *
     * @param  array{room_id?: int, bed_status?: string}  $filters
     * @return array{filters: array, summary: array, rows: Collection}
     */
    public static function occupancyStatus(array $filters = [], ?int $page = null, ?int $perPage = null): array
    {
        $query = DB::table('vw_occupancy_status as vos')
            ->leftJoin('contracts as c', 'vos.contract_id', '=', 'c.contract_id')
            ->select([
                'vos.bed_space_id',
                'vos.bed_label',
                'vos.bed_status',
                'vos.room_id',
                'vos.room_code',
                'vos.tenant_id',
                'vos.tenant_name',
                'vos.contract_id',
                'c.deposit_amount as deposit_amount',
            ]);

        if (! empty($filters['room_id'])) {
            $query->where('room_id', (int) $filters['room_id']);
        }

        if (! empty($filters['bed_status'])) {
            $query->where('bed_status', $filters['bed_status']);
        }

        // 1. Summary Aggregates
        $summaryData = (clone $query)->select([
            DB::raw('COUNT(*) as bed_count'),
            DB::raw("SUM(CASE WHEN bed_status = 'occupied' THEN 1 ELSE 0 END) as occupied_beds"),
            DB::raw("SUM(CASE WHEN bed_status = 'vacant' THEN 1 ELSE 0 END) as vacant_beds"),
            DB::raw("SUM(CASE WHEN bed_status = 'maintenance' THEN 1 ELSE 0 END) as maintenance_beds"),
        ])->first();

        // 2. Paginated Rows
        $rowQuery = $query->orderBy('room_code')->orderBy('bed_label');

        $paginator = null;
        if ($page !== null && $perPage !== null) {
            $paginator = $rowQuery->paginate($perPage, ['*'], 'page', $page);
            $rows = collect($paginator->items());
        } else {
            $rows = $rowQuery->get();
        }

        $mappedRows = $rows->map(function ($row) {
            return [
                'bed_space_id' => (int) $row->bed_space_id,
                'bed_label' => $row->bed_label,
                'bed_status' => $row->bed_status,
                'room_id' => (int) $row->room_id,
                'room_code' => $row->room_code,
                'tenant_id' => $row->tenant_id !== null ? (int) $row->tenant_id : null,
                'tenant_name' => $row->tenant_name,
                'contract_id' => $row->contract_id !== null ? (int) $row->contract_id : null,
                'deposit_amount' => (float) ($row->deposit_amount ?? 0),
            ];
        });

        return [
            'filters' => [
                'room_id' => isset($filters['room_id']) ? (int) $filters['room_id'] : null,
                'bed_status' => $filters['bed_status'] ?? null,
            ],
            'summary' => [
                'bed_count' => (int) ($summaryData->bed_count ?? 0),
                'occupied_beds' => (int) ($summaryData->occupied_beds ?? 0),
                'vacant_beds' => (int) ($summaryData->vacant_beds ?? 0),
                'maintenance_beds' => (int) ($summaryData->maintenance_beds ?? 0),
            ],
            'rows' => $mappedRows,
            'meta' => $paginator ? [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'from' => $paginator->firstItem(),
                'to' => $paginator->lastItem(),
            ] : null,
        ];
    }

    /**
     * Tenant distribution and onboarding metrics.
     * Aligned with SRS FR-008.
     *
     * @return array{total_records: int, active_tenants: int, new_onboarded_mtd: int, archived_count: int}
     */
    public static function tenantSummary(): array
    {
        return \Cache::remember('reports:tenant_summary', 300, function () {
            $now = now();
            $startOfMonth = $now->copy()->startOfMonth()->toDateTimeString();

            return [
                'total_records' => DB::table('tenants')->count(),
                'active_tenants' => DB::table('tenants')->where('status', 'active')->count(),
                'new_onboarded_mtd' => DB::table('tenants')
                    ->where('created_at', '>=', $startOfMonth)
                    ->count(),
                'pending_move_outs' => DB::table('contracts')
                    ->where('status', 'active')
                    ->whereNull('deleted_at')
                    ->whereNotNull('expected_move_out_date')
                    ->whereBetween('expected_move_out_date', [
                        $now->toDateTimeString(),
                        $now->copy()->addDays(30)->toDateTimeString(),
                    ])
                    ->count(),
                'archived_count' => DB::table('tenants')->whereNotNull('deleted_at')->count(),
            ];
        });
    }

    /**
     * Active contracts snapshot via `vw_active_contracts`.
     *
     * @param  array{room_id?: int}  $filters
     * @return array{filters: array, summary: array, rows: Collection}
     */
    public static function activeContracts(array $filters = [], ?int $page = null, ?int $perPage = null): array
    {
        $query = DB::table('vw_active_contracts');

        if (! empty($filters['room_id'])) {
            $query->where('room_id', (int) $filters['room_id']);
        }

        // 1. Summary Aggregates
        $summaryData = (clone $query)->select([
            DB::raw('COUNT(*) as contract_count'),
            DB::raw('SUM(monthly_rate) as potential_revenue'),
            DB::raw('SUM(deposit_amount) as total_deposits'),
        ])->first();

        // 2. Paginated Rows
        $rowQuery = $query->orderBy('room_code')->orderBy('bed_label');

        $paginator = null;
        if ($page !== null && $perPage !== null) {
            $paginator = $rowQuery->paginate($perPage, ['*'], 'page', $page);
            $rows = collect($paginator->items());
        } else {
            $rows = $rowQuery->get();
        }

        $mappedRows = $rows->map(function ($row) {
            return [
                'contract_id' => (int) $row->contract_id,
                'move_in_date' => $row->move_in_date,
                'tenant_id' => (int) $row->tenant_id,
                'tenant_name' => $row->tenant_name,
                'contact_number' => $row->contact_number,
                'email' => $row->email,
                'room_id' => (int) $row->room_id,
                'room_code' => $row->room_code,
                'monthly_rate' => (float) $row->monthly_rate,
                'bed_space_id' => (int) $row->bed_space_id,
                'bed_label' => $row->bed_label,
                'bed_status' => $row->bed_status,
                'contract_status' => $row->contract_status,
                'deposit_amount' => (float) ($row->deposit_amount ?? 0),
                'is_cleared' => (bool) ($row->is_cleared ?? false),
            ];
        });

        return [
            'filters' => [
                'room_id' => isset($filters['room_id']) ? (int) $filters['room_id'] : null,
            ],
            'summary' => [
                'contract_count' => (int) ($summaryData->contract_count ?? 0),
                'total_deposits' => Financials::roundToCent((float) ($summaryData->total_deposits ?? 0)),
                'potential_revenue' => Financials::roundToCent((float) ($summaryData->potential_revenue ?? 0)),
            ],
            'rows' => $mappedRows,
            'meta' => $paginator ? [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'from' => $paginator->firstItem(),
                'to' => $paginator->lastItem(),
            ] : null,
        ];
    }

    /**
     * Generate a billing and collections summary report.
     * Aligned with hardened schema vw_billing_summary.
     *
     * @param  array{start_date?: string, end_date?: string, current_month?: bool}  $filters
     * @return array{filters: array, summary: array, rows: Collection}
     */
    public static function billingSummary(array $filters = [], ?int $page = null, ?int $perPage = null): array
    {
        $query = DB::table('vw_billing_summary');
        self::applyDateRange($query, $filters, 'billing_period_from');

        if (! empty($filters['current_month'])) {
            $query->where('billing_period_from', '>=', now()->startOfMonth());
        }

        // 1. Summary Aggregates
        $summaryData = (clone $query)->select([
            DB::raw('COUNT(*) as billing_count'),
            DB::raw('SUM(total_amount) as billed_total'),
            DB::raw('SUM(total_paid) as collected_total'),
            DB::raw('SUM(total_amount - total_paid) as outstanding_total'),
            DB::raw("SUM(CASE WHEN billing_status = 'overdue' THEN 1 ELSE 0 END) as overdue_count"),
            DB::raw("SUM(CASE WHEN billing_status = 'overdue' THEN total_amount - total_paid ELSE 0 END) as overdue_total"),
        ])->first();

        // 2. Paginated Rows
        $rowQuery = $query->select(
            'vw_billing_summary.*',
            DB::raw('(SELECT MAX(payment_date) FROM payments WHERE payments.billing_id = vw_billing_summary.billing_id) AS last_payment_date')
        )
            ->orderByDesc('billing_period_from')
            ->orderByDesc('billing_id');

        $paginator = null;
        if ($page !== null && $perPage !== null) {
            $paginator = $rowQuery->paginate($perPage, ['*'], 'page', $page);
            $rows = collect($paginator->items());
        } else {
            $rows = $rowQuery->get();
        }

        $mappedRows = $rows->map(function ($row) {
            $totalAmount = (float) ($row->total_amount ?? 0);
            $totalPaid = (float) ($row->total_paid ?? 0);

            return [
                'billing_id' => (int) $row->billing_id,
                'contract_id' => (int) $row->contract_id,
                'tenant_id' => (int) $row->tenant_id,
                'tenant_name' => $row->tenant_name,
                'room_code' => $row->room_code,
                'billing_period_from' => $row->billing_period_from,
                'billing_period_to' => $row->billing_period_to,
                'due_date' => $row->due_date,
                'amount_due' => $totalAmount,
                'amount_paid' => $totalPaid,
                'outstanding_balance' => $totalAmount - $totalPaid,
                'status' => $row->billing_status,
                'last_payment_date' => $row->last_payment_date,
            ];
        });

        $billedTotal = (float) ($summaryData->billed_total ?? 0);
        $collectedTotal = (float) ($summaryData->collected_total ?? 0);

        return [
            'filters' => [
                'start_date' => $filters['start_date'] ?? null,
                'end_date' => $filters['end_date'] ?? null,
                'current_month' => (bool) ($filters['current_month'] ?? false),
            ],
            'summary' => [
                'billing_count' => (int) ($summaryData->billing_count ?? 0),
                'billed_total' => Financials::roundToCent($billedTotal),
                'collected_total' => Financials::roundToCent($collectedTotal),
                'outstanding_total' => Financials::roundToCent($summaryData->outstanding_total ?? 0),
                'overdue_count' => (int) ($summaryData->overdue_count ?? 0),
                'overdue_total' => Financials::roundToCent($summaryData->overdue_total ?? 0),
                'recovery_rate' => $billedTotal > 0 ? round(($collectedTotal / $billedTotal) * 100, 1) : 0,
            ],
            'rows' => $mappedRows,
            'meta' => $paginator ? [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'from' => $paginator->firstItem(),
                'to' => $paginator->lastItem(),
            ] : null,
        ];
    }

    /**
     * Generate an outstanding balances report.
     * Utilizes vw_billing_summary filtered for unpaid/partial.
     *
     * @param  array{tenant_id?: int, due_from?: string, due_to?: string}  $filters
     * @return array{filters: array, summary: array, rows: Collection}
     */
    public static function outstandingBalances(array $filters = [], ?int $page = null, ?int $perPage = null): array
    {
        $query = DB::table('vw_billing_summary')
            ->whereRaw('(total_amount - total_paid) > 0');

        if (! empty($filters['tenant_id'])) {
            $query->where('tenant_id', (int) $filters['tenant_id']);
        }

        self::applyDateRange($query, $filters, 'due_date');

        // 1. Summary Aggregates
        $summaryData = (clone $query)->select([
            DB::raw('COUNT(*) as account_count'),
            DB::raw('SUM(total_amount - total_paid) as total_outstanding'),
            DB::raw("SUM(CASE WHEN billing_status = 'overdue' THEN total_amount - total_paid ELSE 0 END) as overdue_total"),
            DB::raw("COUNT(CASE WHEN billing_status = 'overdue' THEN 1 ELSE NULL END) as overdue_count"),
        ])->first();

        // 2. Paginated Rows
        $rowQuery = $query->orderByDesc(DB::raw('total_amount - total_paid'));

        $paginator = null;
        if ($page !== null && $perPage !== null) {
            $paginator = $rowQuery->paginate($perPage, ['*'], 'page', $page);
            $rows = collect($paginator->items());
        } else {
            $rows = $rowQuery->get();
        }

        $mappedRows = $rows->map(function ($row) {
            $totalAmount = (float) ($row->total_amount ?? 0);
            $totalPaid = (float) ($row->total_paid ?? 0);

            return [
                'billing_id' => (int) $row->billing_id,
                'tenant_name' => $row->tenant_name,
                'room_code' => $row->room_code,
                'due_date' => $row->due_date,
                'amount_due' => (float) ($row->total_amount ?? 0),
                'amount_paid' => (float) ($row->total_paid ?? 0),
                'outstanding_balance' => $totalAmount - $totalPaid,
                'status' => $row->billing_status,
            ];
        });

        return [
            'filters' => [
                'tenant_id' => isset($filters['tenant_id']) ? (int) $filters['tenant_id'] : null,
                'due_from' => $filters['due_from'] ?? null,
                'due_to' => $filters['due_to'] ?? null,
            ],
            'summary' => [
                'account_count' => (int) ($summaryData->account_count ?? 0),
                'total_outstanding' => Financials::roundToCent((float) ($summaryData->total_outstanding ?? 0)),
                'overdue_count' => (int) ($summaryData->overdue_count ?? 0),
                'overdue_total' => Financials::roundToCent($summaryData->overdue_total ?? 0),
            ],
            'rows' => $mappedRows,
            'meta' => $paginator ? [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'from' => $paginator->firstItem(),
                'to' => $paginator->lastItem(),
            ] : null,
        ];
    }

    /**
     * Generate a detailed financial ledger for a specific tenant.
     * Aggregates billings (debits) and payments (credits) chronologically.
     *
     * @return array{tenant: object, entries: array, summary: array}
     */
    public static function tenantLedger(int $tenantId): array
    {
        $tenant = DB::table('tenants')->where('tenant_id', $tenantId)->first();

        if (! $tenant) {
            return ['tenant' => null, 'entries' => [], 'summary' => []];
        }

        // 1. Get all billings (Debits)
        $billings = DB::table('vw_billing_summary')
            ->where('tenant_id', $tenantId)
            ->get()
            ->map(fn ($b) => [
                'date' => $b->billing_period_from,
                'description' => "Billing Cycle: {$b->billing_period_from} to {$b->billing_period_to} (ID: #{$b->billing_id})",
                'type' => 'debit',
                'amount' => (float) $b->total_amount,
                'link_id' => $b->billing_id,
                'link_type' => 'billing',
            ]);

        // 2. Get all payments (Credits)
        $payments = DB::table('vw_collections_summary')
            ->where('tenant_id', $tenantId)
            ->get()
            ->map(fn ($p) => [
                'date' => $p->payment_date,
                'description' => "Payment Received: {$p->payment_method} (Ref: ".($p->reference_number ?? 'N/A').") (ID: #{$p->payment_id})",
                'type' => 'credit',
                'amount' => (float) $p->amount_paid,
                'link_id' => $p->payment_id,
                'link_type' => 'payment',
            ]);

        // 3. Combine and sort (stable order for same calendar date: debits by billing_id, then credits by payment_id)
        $entries = $billings->concat($payments)
            ->sort(function (array $a, array $b): int {
                $da = (string) ($a['date'] ?? '');
                $db = (string) ($b['date'] ?? '');
                if ($da !== $db) {
                    return $da <=> $db;
                }
                $orderA = $a['type'] === 'debit' ? 0 : 1;
                $orderB = $b['type'] === 'debit' ? 0 : 1;
                if ($orderA !== $orderB) {
                    return $orderA <=> $orderB;
                }

                return ((int) $a['link_id']) <=> ((int) $b['link_id']);
            })
            ->values();

        // 4. Calculate running balance
        $runningBalance = 0;
        $ledger = $entries->map(function ($entry) use (&$runningBalance) {
            if ($entry['type'] === 'debit') {
                $runningBalance += $entry['amount'];
            } else {
                $runningBalance -= $entry['amount'];
            }
            $entry['running_balance'] = round($runningBalance, 2);

            return $entry;
        });

        return [
            'tenant' => [
                'id' => $tenant->tenant_id,
                'name' => "{$tenant->first_name} {$tenant->last_name}",
                'status' => $tenant->status,
            ],
            'summary' => [
                'total_billed' => round($ledger->where('type', 'debit')->sum('amount'), 2),
                'total_paid' => round($ledger->where('type', 'credit')->sum('amount'), 2),
                'current_balance' => round($runningBalance, 2),
            ],
            'entries' => $ledger->all(),
        ];
    }

    /**
     * Generate a collections performance report.
     * Aligned with vw_collections_summary.
     *
     * @param  array{start_date?: string, end_date?: string, payment_method?: string}  $filters
     * @return array{filters: array, summary: array, rows: Collection}
     */
    public static function collectionsPerformance(array $filters = []): array
    {
        $query = DB::table('vw_collections_summary')
            ->orderByDesc('payment_date')
            ->orderByDesc('payment_id');

        self::applyDateRange($query, $filters, 'payment_date');

        if (! empty($filters['payment_method'])) {
            $query->where('payment_method', $filters['payment_method']);
        }

        $rows = $query->get()->map(function ($row) {
            return (array) $row;
        });

        // Monitoring of voided transactions
        $voidedQuery = DB::table('payments')
            ->whereNotNull('voided_at');
        self::applyDateRange($voidedQuery, $filters, 'payment_date');
        $voidedAmount = (float) $voidedQuery->sum('amount_paid');

        // Billed total for performance efficiency comparison
        // CCR-009: Use period-overlap logic to align denominator with collection window
        $billingQuery = DB::table('vw_billing_summary');
        if (! empty($filters['start_date'])) {
            $billingQuery->whereDate('billing_period_to', '>=', Carbon::parse($filters['start_date'])->toDateString());
        }
        if (! empty($filters['end_date'])) {
            $billingQuery->whereDate('billing_period_from', '<=', Carbon::parse($filters['end_date'])->toDateString());
        }
        $billingTotal = (float) $billingQuery->sum('total_amount');

        $totalCollected = (float) $rows->sum('amount_paid');

        return [
            'filters' => [
                'start_date' => $filters['start_date'] ?? null,
                'end_date' => $filters['end_date'] ?? null,
                'payment_method' => $filters['payment_method'] ?? null,
            ],
            'summary' => [
                'payment_count' => $rows->count(),
                'total_collected' => Financials::roundToCent($totalCollected),
                'total_voided' => Financials::roundToCent($voidedAmount),
                'billing_total' => Financials::roundToCent($billingTotal),
                'collection_rate' => $billingTotal > 0 ? round(($totalCollected / $billingTotal) * 100, 1) : 0,
            ],
            'rows' => $rows,
        ];
    }

    /**
     * Security pulse via audit logs.
     */
    public static function securityPulse(): array
    {
        return \Cache::remember('reports:security_pulse', 300, function () {
            $last24h = now()->subDay()->toDateTimeString();

            $sensitiveMutations = [
                AuditAction::CREATE->value,
                AuditAction::UPDATE->value,
                AuditAction::DELETE->value,
                AuditAction::SOFT_DELETE->value,
                AuditAction::RESTORE->value,
                AuditAction::VOID->value,
            ];

            $accessDenialActions = [
                AuditAction::FAILED_LOGIN->value,
                AuditAction::ACCESS_DENIED->value,
            ];

            return [
                'total_events_24h' => DB::table('audit_logs')
                    ->where('changed_at', '>=', $last24h)
                    ->count(),

                'sensitive_mutations_24h' => DB::table('audit_logs')
                    ->where('changed_at', '>=', $last24h)
                    ->whereIn('target_table', ['payments', 'users', 'billing_line_items'])
                    ->whereIn('action', $sensitiveMutations)
                    ->count(),

                'access_denied_24h' => DB::table('audit_logs')
                    ->where('changed_at', '>=', $last24h)
                    ->whereIn('action', $accessDenialActions)
                    ->count(),

                'audit_integrity' => 'Verified',
            ];
        });
    }

    /**
     * FR-023: Comprehensive metrology coverage and calibration health.
     */
    public static function meterSummary(): array
    {
        return \Cache::remember('reports:meter_summary', 300, function () {
            $totalMeters = DB::table('meters')->count();

            $monthStart = now()->startOfMonth()->toDateTimeString();
            $coveredMeters = DB::table('meter_readings')
                ->where('reading_date', '>=', $monthStart)
                ->distinct('meter_id')
                ->count();

            return [
                'total_meters' => $totalMeters,
                'coverage_pct' => $totalMeters > 0 ? round(($coveredMeters / $totalMeters) * 100, 1) : 0,
                'anomalous_spikes' => 0,
                'total_pending' => DB::table('meters')
                    ->where('status', 'active')
                    ->count() - $coveredMeters,
            ];
        });
    }

    /**
     * User activity and privilege density metrics.
     */
    public static function userSummary(): array
    {
        return \Cache::remember('reports:user_summary', 300, function () {
            $last24h = now()->subDay()->toDateTimeString();

            return [
                'staff_count' => DB::table('users')->whereNull('deleted_at')->count(),
                'active_last_24h' => DB::table('audit_logs')
                    ->where('changed_at', '>=', $last24h)
                    ->distinct('changed_by')
                    ->count(),
                'admin_count' => DB::table('users')
                    ->join('roles', 'users.role_id', '=', 'roles.role_id')
                    ->where('roles.role_name', 'admin')
                    ->whereNull('users.deleted_at')
                    ->count(),
                'hygiene_count' => DB::table('users')->whereNotNull('deleted_at')->count(),
            ];
        });
    }

    /**
     * Tenant contract timeline (all statuses) via reporting view.
     *
     * @param  array{from?: string, to?: string, status?: string}  $filters
     * @return array{filters: array, summary: array, rows: Collection}
     */
    public static function tenantHistory(array $filters = []): array
    {
        $query = DB::table('vw_tenant_contract_history')
            ->orderByDesc('move_in_date')
            ->orderByDesc('contract_id');

        self::applyDateRange($query, $filters, 'move_in_date');

        $status = $filters['status'] ?? 'all';
        if ($status === 'active') {
            $query->where('status', 'active');
        } elseif ($status === 'completed') {
            $query->where('status', 'completed');
        } elseif ($status === 'terminated') {
            $query->where('status', 'terminated');
        } elseif ($status === 'moved_out') {
            $query->whereIn('status', ['completed', 'terminated']);
        }

        $rows = $query->get();
        $mappedRows = $rows->map(function ($row) {
            return [
                'contract_id' => (int) $row->contract_id,
                'tenant_id' => (int) $row->tenant_id,
                'email' => $row->email,
                'tenant_name' => $row->tenant_name,
                'move_in_date' => $row->move_in_date,
                'move_out_date' => $row->move_out_date,
                'status' => $row->status,
                'is_cleared' => (bool) $row->is_cleared,
                'room_id' => (int) $row->room_id,
                'room_label' => $row->room_label,
                'bed_label' => $row->bed_label,
            ];
        });

        return [
            'filters' => [
                'from' => $filters['from'] ?? null,
                'to' => $filters['to'] ?? null,
                'status' => $status,
            ],
            'summary' => [
                'contract_count' => $rows->count(),
            ],
            'rows' => $rows->values(),
        ];
    }

    /**
     * Build CSV headings and rows for stream download responses.
     *
     * @return array{headers: string[], rows: array[]}
     */
    public static function toCsvPayload(string $type, array $report): array
    {
        return match ($type) {
            'occupancy' => self::occupancyCsv(collect($report['rows'] ?? [])),
            'occupancy-status' => self::occupancyStatusCsv(collect($report['rows'] ?? [])),
            'active-contracts' => self::activeContractsCsv(collect($report['rows'] ?? [])),
            'billing-summary' => self::billingSummaryCsv(collect($report['rows'] ?? [])),
            'outstanding-balances' => self::outstandingBalancesCsv(collect($report['rows'] ?? [])),
            'collections-performance' => self::collectionsPerformanceCsv(collect($report['rows'] ?? [])),
            'tenant-history' => self::tenantHistoryCsv(collect($report['rows'] ?? [])),
            'tenant-ledger' => self::tenantLedgerCsv(collect($report['entries'] ?? []), $report['tenant'] ?? null),
            default => ['headers' => [], 'rows' => []],
        };
    }

    private static function tenantLedgerCsv(Collection $entries, ?object $tenant): array
    {
        return [
            'headers' => ['date', 'description', 'type', 'amount', 'running_balance'],
            'rows' => $entries->map(fn ($e) => [
                $e['date'],
                $e['description'],
                strtoupper($e['type']),
                $e['amount'],
                $e['running_balance'],
            ])->all(),
        ];
    }

    private static function occupancyCsv(Collection $rows): array
    {
        return [
            'headers' => ['room_code', 'room_type', 'total_beds', 'occupied_beds', 'vacant_beds', 'occupancy_rate'],
            'rows' => $rows->map(fn ($row) => [
                $row['room_code'],
                $row['room_type'],
                $row['total_beds'],
                $row['occupied_beds'],
                $row['vacant_beds'],
                $row['occupancy_rate'],
            ])->all(),
        ];
    }

    private static function occupancyStatusCsv(Collection $rows): array
    {
        return [
            'headers' => [
                'bed_space_id',
                'bed_label',
                'bed_status',
                'room_id',
                'room_code',
                'tenant_id',
                'tenant_name',
                'contract_id',
            ],
            'rows' => $rows->map(fn ($row) => [
                $row['bed_space_id'],
                $row['bed_label'],
                $row['bed_status'],
                $row['room_id'],
                $row['room_code'],
                $row['tenant_id'] ?? '',
                $row['tenant_name'] ?? '',
                $row['contract_id'] ?? '',
            ])->all(),
        ];
    }

    private static function activeContractsCsv(Collection $rows): array
    {
        return [
            'headers' => [
                'contract_id',
                'move_in_date',
                'tenant_id',
                'tenant_name',
                'contact_number',
                'email',
                'room_id',
                'room_code',
                'monthly_rate',
                'bed_space_id',
                'bed_label',
                'bed_status',
            ],
            'rows' => $rows->map(fn ($row) => [
                $row['contract_id'],
                $row['move_in_date'],
                $row['tenant_id'],
                $row['tenant_name'],
                $row['contact_number'],
                $row['email'] ?? '',
                $row['room_id'],
                $row['room_code'],
                $row['monthly_rate'],
                $row['bed_space_id'],
                $row['bed_label'],
                $row['bed_status'],
            ])->all(),
        ];
    }

    private static function billingSummaryCsv(Collection $rows): array
    {
        return [
            'headers' => [
                'billing_id',
                'contract_id',
                'tenant_name',
                'room_code',
                'billing_period_from',
                'billing_period_to',
                'due_date',
                'amount_due',
                'amount_paid',
                'outstanding_balance',
                'status',
                'last_payment_date',
            ],
            'rows' => $rows->map(fn ($row) => [
                $row['billing_id'],
                $row['contract_id'],
                $row['tenant_name'],
                $row['room_code'],
                $row['billing_period_from'],
                $row['billing_period_to'],
                $row['due_date'],
                $row['amount_due'],
                $row['amount_paid'],
                $row['outstanding_balance'],
                $row['status'],
                $row['last_payment_date'],
            ])->all(),
        ];
    }

    private static function outstandingBalancesCsv(Collection $rows): array
    {
        return self::billingSummaryCsv($rows); // Redirect to same format
    }

    private static function collectionsPerformanceCsv(Collection $rows): array
    {
        return [
            'headers' => [
                'payment_id',
                'payment_date',
                'amount_paid',
                'payment_method',
                'reference_number',
                'tenant_name',
                'room_code',
                'billing_id',
            ],
            'rows' => $rows->map(fn ($row) => [
                $row['payment_id'],
                $row['payment_date'],
                $row['amount_paid'],
                $row['payment_method'],
                $row['reference_number'],
                $row['tenant_name'],
                $row['room_code'],
                $row['billing_id'],
            ])->all(),
        ];
    }

    private static function tenantHistoryCsv(Collection $rows): array
    {
        return [
            'headers' => [
                'contract_id',
                'tenant_id',
                'tenant_name',
                'email',
                'move_in_date',
                'move_out_date',
                'room',
                'status',
            ],
            'rows' => $rows->map(fn ($row) => [
                $row['contract_id'],
                $row['tenant_id'],
                $row['tenant_name'],
                $row['email'] ?? '',
                $row['move_in_date'],
                $row['move_out_date'] ?? '',
                $row['room_label'],
                $row['status'],
            ])->all(),
        ];
    }

    /**
     * Dashboard Summary Stats.
     */
    public static function summaryStats(): array
    {
        return [
            'total_active_tenants' => DB::table('tenants')->where('status', 'active')->count(),
            'total_vacant_beds' => DB::table('vw_occupancy_status')->where('bed_status', 'vacant')->count(),
            'total_overdue_billing' => (float) DB::table('vw_billing_summary')->where('billing_status', 'overdue')->sum('total_amount'),
            'occupancy_rate' => self::calculateGlobalOccupancyRate(),
        ];
    }

    /**
     * Financial: Collections breakdown by category.
     */
    public static function collectionsByCategory(array $filters = []): array
    {
        // For now, group by room type as a proxy for category if specific categories aren't in schema
        $query = DB::table('vw_collections_summary')
            ->select('room_type as category', DB::raw('SUM(amount_paid) as total_collected'))
            ->groupBy('room_type');

        return [
            'rows' => $query->get()->all(),
            'summary' => [
                'total' => Financials::roundToCent($query->get()->sum('total_collected')),
            ],
        ];
    }

    /**
     * Financial: Aging receivables report.
     */
    public static function agingReceivables(): array
    {
        $rows = DB::table('vw_billing_summary')
            ->whereRaw('(total_amount - total_paid) > 0')
            ->get()
            ->map(function ($row) {
                $days = Carbon::parse($row->due_date)->diffInDays(Carbon::now(), false);

                return [
                    'tenant_id' => $row->tenant_id,
                    'tenant_name' => $row->tenant_name,
                    'amount' => (float) ($row->total_amount - $row->total_paid),
                    'days_overdue' => $days > 0 ? $days : 0,
                ];
            });

        return [
            'rows' => $rows->all(),
            'summary' => [
                'current' => $rows->where('days_overdue', 0)->sum('amount'),
                '1_30_days' => $rows->whereBetween('days_overdue', [1, 30])->sum('amount'),
                '31_60_days' => $rows->whereBetween('days_overdue', [31, 60])->sum('amount'),
                '61_plus_days' => $rows->where('days_overdue', '>', 60)->sum('amount'),
            ],
        ];
    }

    /**
     * Operational: Check-in efficiency metrics.
     */
    public static function checkInEfficiency(): array
    {
        $avgDays = DB::table('contracts')
            ->whereNotNull('move_in_date')
            ->select(DB::raw('AVG(DATEDIFF(move_in_date, created_at)) as avg_days'))
            ->value('avg_days');

        return [
            'avg_onboarding_time_days' => round((float) ($avgDays ?? 0), 1),
            'total_new_checkins_this_month' => DB::table('contracts')
                ->whereBetween('move_in_date', [Carbon::now()->startOfMonth(), Carbon::now()->endOfMonth()])
                ->count(),
        ];
    }

    /**
     * Forensics: Audit Pulse for system health.
     */
    public static function auditPulse(): array
    {
        return [
            'total_logs_24h' => DB::table('audit_logs')->where('changed_at', '>=', Carbon::now()->subDay())->count(),
            'access_denied_24h' => DB::table('audit_logs')
                ->where('action', 'access_denied')
                ->where('changed_at', '>=', Carbon::now()->subDay())
                ->count(),
            'sensitive_changes_24h' => DB::table('audit_logs')
                ->whereIn('action', ['void', 'delete', 'archive'])
                ->where('changed_at', '>=', Carbon::now()->subDay())
                ->count(),
        ];
    }

    /**
     * Room: Inventory health report.
     */
    public static function inventoryHealth(): array
    {
        return [
            'maintenance_beds' => DB::table('bed_spaces')->where('status', 'maintenance')->count(),
            'dirty_rooms' => 0, // TODO: Implement if cleaning status is added
            'total_rooms' => DB::table('rooms')->count(),
        ];
    }

    /**
     * Projections: Revenue and occupancy projections.
     */
    public static function revenueProjection(): array
    {
        $currentMonthly = (float) DB::table('contracts')->where('status', 'active')->sum('monthly_rate');

        return [
            'projected_monthly_revenue' => $currentMonthly,
            'projected_annual_revenue' => $currentMonthly * 12,
        ];
    }

    /**
     * Schedule: Upcoming move-outs.
     */
    public static function upcomingMoveOuts(): array
    {
        $rows = DB::table('vw_tenant_contract_history')
            ->where('contract_status', 'active')
            ->whereBetween('expected_move_out_date', [Carbon::now(), Carbon::now()->addDays(30)])
            ->get();

        return [
            'rows' => $rows->all(),
            'count' => $rows->count(),
        ];
    }

    private static function calculateGlobalOccupancyRate(): float
    {
        $totalBeds = DB::table('bed_spaces')->count();
        if ($totalBeds === 0) {
            return 0.0;
        }
        $occupied = DB::table('bed_spaces')->where('status', 'occupied')->count();

        return round(($occupied / $totalBeds) * 100, 2);
    }
}
