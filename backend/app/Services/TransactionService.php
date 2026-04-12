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
     * CCR-007: Transaction log entry
     *
     * @return array{tx_log_id: int, correlation_id: string}
     */
    public static function logStarted(string $txName, int $userId, string $entity, string $id): array
    {
        $correlationId = (string) Str::uuid();

        $txLogId = (int) DB::table('transaction_logs')->insertGetId([
            'tx_name' => $txName,
            'started_at' => now(),
            'status' => 'started',
            'initiated_by' => $userId,
            'reference_entity' => $entity,
            'reference_id' => $id,
            'correlation_id' => $correlationId,
        ]);

        return ['tx_log_id' => $txLogId, 'correlation_id' => $correlationId];
    }

    /**
     * Mark a business process as committed.
     * CCR-007: Success state
     */
    public static function logCommitted(int $txLogId, ?array $details = null): void
    {
        DB::table('transaction_logs')
            ->where('tx_log_id', $txLogId)
            ->update([
                'completed_at' => now(),
                'status' => 'committed',
                'details_json' => $details ? json_encode($details) : null,
            ]);
    }

    /**
     * Mark a business process as failed (no DB::transaction rollback involved).
     * CCR-007: Use for simple workflows that do not wrap writes in `DB::transaction()`
     * (e.g. `TenantService::create` / `update`), where failure is not a rolled-back SQL transaction.
     */
    public static function logFailed(int $txLogId, string $reason, ?array $additionalDetails = null): void
    {
        self::finalizeWithStatus($txLogId, 'failed', $reason, $additionalDetails);
    }

    /**
     * Mark a workflow as rolled back after `DB::transaction()` failed or threw.
     * CCR-007: Persists `transaction_logs.status = rolled_back` (schema enum).
     */
    public static function logRolledBack(int $txLogId, string $reason, ?array $additionalDetails = null): void
    {
        self::finalizeWithStatus($txLogId, 'rolled_back', $reason, $additionalDetails);
    }

    /**
     * @param  'failed'|'rolled_back'  $status
     */
    private static function finalizeWithStatus(int $txLogId, string $status, string $reason, ?array $additionalDetails = null): void
    {
        $details = array_merge(['reason' => $reason], $additionalDetails ?? []);

        DB::table('transaction_logs')
            ->where('tx_log_id', $txLogId)
            ->update([
                'completed_at' => now(),
                'status' => $status,
                'details_json' => json_encode($details),
            ]);
    }

    /** Default cap for transaction log listing (`transaction_logs` — CCR-007). */
    public const DEFAULT_LIST_LIMIT = 200;

    public const MAX_LIST_LIMIT = 200;

    /**
     * Paginated transaction logs with humanized context.
     */
    /**
     * @param  array{q?: string, status?: string, from?: string, to?: string}  $filters  `q` matches tx name, reference, initiator username, or `correlation_id`.
     */
    public static function listLogsPaginated(int $page, int $perPage, array $filters = []): LengthAwarePaginator
    {
        $base = TransactionLog::with(['user' => function ($q) {
            $q->select('user_id', 'username', 'first_name', 'last_name');
        }]);

        if (! empty($filters['status'])) {
            $base->where('status', $filters['status']);
        }

        if (! empty($filters['from'])) {
            $base->where('started_at', '>=', $filters['from'].' 00:00:00');
        }

        if (! empty($filters['to'])) {
            $base->where('started_at', '<=', $filters['to'].' 23:59:59');
        }

        if (! empty($filters['q'])) {
            $needle = $filters['q'];
            $base->where(function ($w) use ($needle): void {
                $w->where('tx_name', 'like', "%{$needle}%")
                    ->orWhere('reference_id', 'like', "%{$needle}%")
                    ->orWhere('reference_entity', 'like', "%{$needle}%")
                    ->orWhere('correlation_id', 'like', "%{$needle}%")
                    ->orWhereHas('user', function ($u) use ($needle): void {
                        $u->where('username', 'like', "%{$needle}%");
                    });
            });
        }

        $paginator = $base->orderByDesc('started_at')
            ->paginate($perPage, ['*'], 'page', $page);

        $paginator->getCollection()->transform(function ($log) {
            $log->user_username = $log->user?->username;
            $log->user_first_name = $log->user?->first_name;
            $log->user_last_name = $log->user?->last_name;

            return $log;
        });

        return $paginator;
    }

    /**
     * List transaction logs with humanized context (legacy limit-based list).
     */
    public static function listLogs(?int $limit = null): Collection
    {
        $cap = $limit ?? self::DEFAULT_LIST_LIMIT;
        $cap = max(1, min($cap, self::MAX_LIST_LIMIT));

        return TransactionLog::with(['user' => function ($q) {
            $q->select('user_id', 'username', 'first_name', 'last_name');
        }])
            ->orderByDesc('started_at')
            ->limit($cap)
            ->get()
            ->map(function ($log) {
                $log->user_username = $log->user?->username;
                $log->user_first_name = $log->user?->first_name;
                $log->user_last_name = $log->user?->last_name;

                return $log;
            });
    }
}
