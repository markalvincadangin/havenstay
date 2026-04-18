<?php

namespace App\Services\Analytics;

use App\Services\Concerns\HasReportingFilters;
use App\Support\Financials;
use App\Models\Contract;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Analytics engine for generating operational, financial, and forensic reports.
 * Interfaces with hardened database views for performance and reliability.
 */
class ReportService
{
    use HasReportingFilters;
    /**
     * Generate an occupancy report by room and bed.
     * Aligned with hardened schema vw_room_occupancy.
     *
     * @param  array{room_type?: string}  $filters
     * @return array{summary: array{total_rooms: int, total_beds: int, occupied_beds: int, vacant_beds: int}, rows: Collection}
     */
    public static function occupancy(array $filters = []): array
    {
        // vw_room_occupancy counts bed_space rows for total_beds.
        $query = DB::table('vw_room_occupancy');

        if (! empty($filters['room_type'])) {
            $query->where('room_type', $filters['room_type']);
        }

        $rows = $query->orderBy('room_code')
            ->get()
            ->map(function ($row) {
                // For solo rooms with no bed_space rows, COUNT returns 0 — fall back to capacity
                if ((int) $row->total_beds === 0 && (int) $row->capacity > 0) {
                    $row->total_beds = (int) $row->capacity;
                }

                $totalBeds = (int) $row->total_beds;
                $occupiedBeds = (int) $row->occupied_beds;
                $roomStatus = strtolower((string) ($row->room_status ?? ''));
                $isBookable = in_array($roomStatus, ['vacant', 'partially_occupied'], true);
                $vacantBeds = $isBookable ? (int) $row->vacant_beds : 0;

                return [
                    'room_id' => (int) $row->room_id,
                    'room_code' => $row->room_code,
                    'room_type' => $row->room_type,
                    'total_beds' => $totalBeds,
                    'occupied_beds' => $occupiedBeds,
                    'vacant_beds' => $vacantBeds,
                    'occupancy_rate' => $totalBeds > 0
                        ? round(($occupiedBeds / $totalBeds) * 100, 2)
                        : 0.0,
                ];
            });

        return [
            'summary' => [
                'total_rooms' => $rows->count(),
                'total_beds' => $rows->sum('total_beds'),
                'occupied_beds' => $rows->sum('occupied_beds'),
                'vacant_beds' => $rows->sum('vacant_beds'),
            ],
            'rows' => $rows->values(),
        ];
    }

    /**
     * Bed-level occupancy via `vw_occupancy_status`.
     *
     * @param  array{room_id?: int, bed_status?: string}  $filters
     * @return array{filters: array, summary: array, rows: Collection}
     */
    public static function occupancyStatus(array $filters = []): array
    {
        $query = DB::table('vw_occupancy_status')
            ->orderBy('room_code')
            ->orderBy('bed_label');

        if (! empty($filters['room_id'])) {
            $query->where('room_id', (int) $filters['room_id']);
        }

        if (! empty($filters['bed_status'])) {
            $query->where('bed_status', $filters['bed_status']);
        }

        $rows = $query->get()->map(function ($row) {
            return [
                'bed_space_id' => (int) $row->bed_space_id,
                'bed_label' => $row->bed_label,
                'bed_status' => $row->bed_status,
                'room_id' => (int) $row->room_id,
                'room_code' => $row->room_code,
                'tenant_id' => $row->tenant_id !== null ? (int) $row->tenant_id : null,
                'tenant_name' => $row->tenant_name,
                'contract_id' => $row->contract_id !== null ? (int) $row->contract_id : null,
            ];
        });

        return [
            'filters' => [
                'room_id' => isset($filters['room_id']) ? (int) $filters['room_id'] : null,
                'bed_status' => $filters['bed_status'] ?? null,
            ],
            'summary' => [
                'bed_count' => $rows->count(),
                'occupied_beds' => $rows->where('bed_status', 'occupied')->count(),
                'vacant_beds' => $rows->where('bed_status', 'vacant')->count(),
                'maintenance_beds' => $rows->where('bed_status', 'maintenance')->count(),
            ],
            'rows' => $rows->values(),
        ];
    }

    /**
     * Active contracts snapshot via `vw_active_contracts`.
     *
     * @param  array{room_id?: int}  $filters
     * @return array{filters: array, summary: array, rows: Collection}
     */
    public static function activeContracts(array $filters = []): array
    {
        $query = DB::table('vw_active_contracts')
            ->orderBy('room_code')
            ->orderBy('bed_label');

        if (! empty($filters['room_id'])) {
            $query->where('room_id', (int) $filters['room_id']);
        }

        $rows = $query->get()->map(function ($row) {
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
                'deposit_amount' => (float) ($row->deposit_amount ?? 0),
            ];
        });

        // Business Rule: Escrowed Deposits include Active, Pending, and Terminated-but-not-cleared contracts
        $escrowQuery = DB::table('contracts')
            ->whereNull('contracts.deleted_at')
            ->where(function($q) {
                $q->whereIn('contracts.status', [Contract::STATUS_ACTIVE, Contract::STATUS_PENDING_PAYMENT])
                  ->orWhere(function($sub) {
                      $sub->whereIn('contracts.status', [Contract::STATUS_TERMINATED, Contract::STATUS_COMPLETED])
                          ->where('contracts.is_cleared', false);
                  });
            });

        $totalDepositsHeld = (float) $escrowQuery->sum('deposit_amount');

        // Business Rule: Projected Revenue includes Active and Pending move-ins
        $revenueQuery = DB::table('contracts')
            ->whereNull('contracts.deleted_at')
            ->whereIn('contracts.status', [Contract::STATUS_ACTIVE, Contract::STATUS_PENDING_PAYMENT]);
        
        // Use the same COALESCE logic as the view for consistency
        $potentialRevenue = (float) $revenueQuery->join('bed_spaces', 'contracts.bed_space_id', '=', 'bed_spaces.bed_space_id')
            ->join('rooms', 'bed_spaces.room_id', '=', 'rooms.room_id')
            ->sum(DB::raw('COALESCE(contracts.monthly_rate_override, rooms.monthly_rate)'));

        return [
            'filters' => [
                'room_id' => isset($filters['room_id']) ? (int) $filters['room_id'] : null,
            ],
            'summary' => [
                'contract_count' => $rows->count(),
                'total_deposits' => Financials::roundToCent($totalDepositsHeld),
                'potential_revenue' => Financials::roundToCent($potentialRevenue),
            ],
            'rows' => $rows->values(),
        ];
    }

    /**
     * Generate a billing and collections summary report.
     * Aligned with hardened schema vw_billing_summary.
     *
     * @param  array{start_date?: string, end_date?: string, current_month?: bool}  $filters
     * @return array{filters: array, summary: array, rows: Collection}
     */
    public static function billingSummary(array $filters = []): array
    {
        $query = DB::table('vw_billing_summary')
            ->select(
                'vw_billing_summary.*',
                DB::raw('(SELECT MAX(payment_date) FROM payments WHERE payments.billing_id = vw_billing_summary.billing_id) AS last_payment_date')
            )
            ->orderByDesc('billing_period_from')
            ->orderByDesc('billing_id');

        self::applyCurrentMonthDefault($query, $filters, 'billing_period_from');
        self::applyDateFilters($query, $filters, 'billing_period_from', 'start_date', 'end_date');

        $rows = $query->get()->map(function ($row) {
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

        $currentMonthOnly = (bool) ($filters['current_month'] ?? false);
        return [
            'filters' => [
                'start_date' => $filters['start_date'] ?? null,
                'end_date' => $filters['end_date'] ?? null,
                'current_month' => $currentMonthOnly,
            ],
            'summary' => [
                'billing_count' => $rows->count(),
                'billed_total' => Financials::roundToCent($rows->sum('amount_due')),
                'collected_total' => Financials::roundToCent($rows->sum('amount_paid')),
                'outstanding_total' => Financials::roundToCent($rows->sum('outstanding_balance')),
                'overdue_count' => $rows->where('status', 'overdue')->count(),
                'overdue_total' => Financials::roundToCent($rows->where('status', 'overdue')->sum('outstanding_balance')),
            ],
            'rows' => $rows->values(),
        ];
    }

    /**
     * Generate an outstanding balances report.
     * Utilizes vw_billing_summary filtered for unpaid/partial.
     *
     * @param  array{tenant_id?: int, due_from?: string, due_to?: string}  $filters
     * @return array{filters: array, summary: array, rows: Collection}
     */
    public static function outstandingBalances(array $filters = []): array
    {
        $query = DB::table('vw_billing_summary')
            ->whereRaw('(total_amount - total_paid) > 0');

        if (! empty($filters['tenant_id'])) {
            $query->where('tenant_id', (int) $filters['tenant_id']);
        }

        self::applyDateFilters($query, $filters, 'due_date', 'due_from', 'due_to');

        $rows = $query->orderByDesc('due_date')
            ->orderByDesc('billing_id')
            ->get()
            ->map(function ($row) {
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
                ];
            });

        $today = Carbon::today()->startOfDay();
        $pastDueRows = $rows->filter(function (array $row) use ($today) {
            $bal = (float) ($row['outstanding_balance'] ?? 0);
            if ($bal <= 0 || empty($row['due_date'])) {
                return false;
            }
            $due = Carbon::parse($row['due_date'])->startOfDay();

            return $due->lt($today);
        });

        $oldestPastDueDays = 0;
        if ($pastDueRows->isNotEmpty()) {
            $oldestPastDueDays = (int) $pastDueRows->map(function (array $row) use ($today) {
                $due = Carbon::parse($row['due_date'])->startOfDay();
                if ($due->gte($today)) {
                    return 0;
                }

                return $due->diffInDays($today);
            })->max();
        }

        $overdueRows = $rows->filter(fn($r) => strtolower($r['status'] ?? '') === 'overdue');

        return [
            'filters' => [
                'tenant_id' => isset($filters['tenant_id']) ? (int) $filters['tenant_id'] : null,
                'due_from' => $filters['due_from'] ?? null,
                'due_to' => $filters['due_to'] ?? null,
            ],
            'summary' => [
                'account_count' => $rows->count(),
                'total_outstanding' => Financials::roundToCent($rows->sum('outstanding_balance')),
                'past_due_count' => $pastDueRows->count(), // Retain for legacy/diff logic
                'past_due_amount' => Financials::roundToCent($pastDueRows->sum('outstanding_balance')),
                'overdue_count' => $overdueRows->count(), // Strictly by status
                'overdue_total' => Financials::roundToCent($overdueRows->sum('outstanding_balance')),
                'oldest_past_due_days' => $oldestPastDueDays,
            ],
            'rows' => $rows->values(),
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

        self::applyDateFilters($query, $filters, 'payment_date', 'start_date', 'end_date');

        if (! empty($filters['payment_method'])) {
            $query->where('payment_method', $filters['payment_method']);
        }

        $rows = $query->get()->map(function ($row) {
            return (array) $row;
        });

        return [
            'filters' => [
                'start_date' => $filters['start_date'] ?? null,
                'end_date' => $filters['end_date'] ?? null,
                'payment_method' => $filters['payment_method'] ?? null,
            ],
            'summary' => [
                'payment_count' => $rows->count(),
                'total_collected' => Financials::roundToCent($rows->sum('amount_paid')),
            ],
            'rows' => $rows,
        ];
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

        self::applyDateFilters($query, $filters, 'move_in_date', 'from', 'to');

        $status = $filters['status'] ?? 'all';
        if ($status === 'active') {
            $query->where('contract_status', 'active');
        } elseif ($status === 'completed') {
            $query->where('contract_status', 'completed');
        } elseif ($status === 'terminated') {
            $query->where('contract_status', 'terminated');
        } elseif ($status === 'moved_out') {
            $query->whereIn('contract_status', ['completed', 'terminated']);
        }

        $rows = $query->get()->map(function ($row) {
            $moveOut = $row->actual_move_out_date ?? $row->expected_move_out_date;

            return [
                'contract_id' => (int) $row->contract_id,
                'tenant_id' => (int) $row->tenant_id,
                'tenant_name' => $row->tenant_name,
                'email' => $row->email ?? null,
                'move_in_date' => $row->move_in_date,
                'move_out_date' => $moveOut,
                'room_label' => $row->room_code.' / '.$row->bed_label,
                'status' => $row->contract_status,
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
            ]
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
            ]
        ];
    }

    /**
     * Operational: Check-in efficiency metrics.
     */
    public static function checkInEfficiency(): array
    {
        return [
            'avg_onboarding_time_days' => 2.5, // TODO: Implement calculation based on created_at vs move_in_date
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
            'total_logs_24h' => DB::table('audit_logs')->where('created_at', '>=', Carbon::now()->subDay())->count(),
            'access_denied_24h' => DB::table('audit_logs')
                ->where('event_type', 'access_denied')
                ->where('created_at', '>=', Carbon::now()->subDay())
                ->count(),
            'sensitive_changes_24h' => DB::table('audit_logs')
                ->whereIn('event_type', ['void', 'delete', 'archive'])
                ->where('created_at', '>=', Carbon::now()->subDay())
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
        if ($totalBeds === 0) return 0.0;
        $occupied = DB::table('bed_spaces')->where('status', 'occupied')->count();
        return round(($occupied / $totalBeds) * 100, 2);
    }
}
