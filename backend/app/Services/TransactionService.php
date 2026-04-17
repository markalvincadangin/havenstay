<?php

namespace App\Services;

use App\Models\TransactionLog;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class TransactionService
{
    /**
     * Start a business process log entry.
     *
     * @return array{tx_log_id: int, correlation_id: string} 
     */
    public static function logStarted(string $action, string $txnReference, ?int $userId = null, ?array $details = null): array
    {
        $correlationId = (string) Str::uuid();

        // Bind correlation ID for audit triggers
        AuditService::setCorrelationContext($correlationId);

        $id = (int) DB::table('transaction_logs')->insertGetId([
            'txn_reference'  => $txnReference,
            'action'         => $action,
            'status'         => 'started',
            'initiated_by'   => $userId,
            'details'        => $details ? json_encode($details) : null,
            'correlation_id' => $correlationId,
            'created_at'     => now(),
        ]);

        return [
            'tx_log_id' => $id,
            'correlation_id' => $correlationId,
        ];
    }

    /**
     * Mark a business process as committed.
     */
    public static function logCommitted(int $id, ?array $details = null): void
    {
        DB::table('transaction_logs')
            ->where('id', $id)
            ->update([
                'status' => 'committed',
                'details' => $details ? json_encode($details) : null,
            ]);
    }

    /**
     * Mark a business process as failed (logic error before/outside transaction).
     */
    public static function logFailed(int $id, string $errorMessage, ?array $details = null): void
    {
        self::finalizeWithStatus($id, 'failed', $errorMessage, $details);
    }

    /**
     * Mark a workflow as rolled back after `DB::transaction()` threw an exception.
     */
    public static function logRolledBack(int $id, string $errorMessage, ?array $details = null): void
    {
        self::finalizeWithStatus($id, 'rolled_back', $errorMessage, $details);
    }

    /**
     * @param 'failed'|'rolled_back' $status
     */
    private static function finalizeWithStatus(int $id, string $status, string $errorMessage, ?array $details = null): void
    {
        DB::table('transaction_logs')
            ->where('id', $id)
            ->update([
                'status' => $status,
                'error_message' => $errorMessage,
                'details' => $details ? json_encode($details) : null,
            ]);
    }

    /** Default cap for transaction log listing. */
    public const DEFAULT_LIST_LIMIT = 200;

    public const MAX_LIST_LIMIT = 200;

    /**
     * Apply common filters for transaction log queries.
     *
     * @param  \Illuminate\Database\Eloquent\Builder  $query
     * @param  array{q?: string, status?: string, from?: string, to?: string}  $filters
     */
    private static function applyFilters($query, array $filters)
    {
        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (! empty($filters['from'])) {
            $query->where('created_at', '>=', $filters['from'].' 00:00:00');
        }

        if (! empty($filters['to'])) {
            $query->where('created_at', '<=', $filters['to'].' 23:59:59');
        }

        if (! empty($filters['q'])) {
            $needle = $filters['q'];
            $query->where(function ($w) use ($needle): void {
                $w->where('action', 'like', "%{$needle}%")
                    ->orWhere('txn_reference', 'like', "%{$needle}%")
                    ->orWhereHas('user', function ($u) use ($needle): void {
                        $u->where('username', 'like', "%{$needle}%");
                    });
            });
        }

        return $query;
    }

    public static function listLogsPaginated(int $page, int $perPage, array $filters = []): LengthAwarePaginator
    {
        $base = TransactionLog::with(['user' => function ($q) {
            $q->select('user_id', 'username', 'first_name', 'last_name');
        }]);

        self::applyFilters($base, $filters);

        $paginator = $base->orderByDesc('created_at')
            ->paginate($perPage, ['*'], 'page', $page);

        $paginator->getCollection()->transform(function ($log) {
            $log->user_username = $log->user?->username;
            $log->user_first_name = $log->user?->first_name;
            $log->user_last_name = $log->user?->last_name;

            return $log;
        });

        return $paginator;
    }

    public static function getLogStats(array $filters = []): array
    {
        $base = TransactionLog::query();
        self::applyFilters($base, $filters);

        $counts = $base->select('status', DB::raw('count(*) as count'))
            ->groupBy('status')
            ->pluck('count', 'status')
            ->toArray();

        return [
            'committed_count' => (int) ($counts['committed'] ?? 0),
            'failed_count' => (int) ($counts['failed'] ?? 0),
            'rolled_back_count' => (int) ($counts['rolled_back'] ?? 0),
        ];
    }
}
