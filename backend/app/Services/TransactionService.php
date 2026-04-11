<?php

namespace App\Services;

use App\Models\TransactionLog;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class TransactionService
{
    /**
     * Start a business process log entry.
     * CCR-007: Transaction log entry
     */
    public static function logStarted(string $txName, int $userId, string $entity, string $id): int
    {
        return DB::table('transaction_logs')->insertGetId([
            'tx_name' => $txName,
            'started_at' => now(),
            'status' => 'started',
            'initiated_by' => $userId,
            'reference_entity' => $entity,
            'reference_id' => $id,
        ]);
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

    /**
     * List transaction logs with humanized context.
     */
    public static function listLogs(): Collection
    {
        return TransactionLog::with(['user' => function ($q) {
            $q->select('user_id', 'username', 'first_name', 'last_name');
        }])
            ->orderByDesc('started_at')
            ->limit(200)
            ->get()
            ->map(function ($log) {
                $log->user_username = $log->user?->username;
                $log->user_first_name = $log->user?->first_name;
                $log->user_last_name = $log->user?->last_name;

                return $log;
            });
    }
}
