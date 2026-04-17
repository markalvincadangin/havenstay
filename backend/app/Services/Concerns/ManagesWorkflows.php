<?php

namespace App\Services\Concerns;

use App\Services\AuditService;
use App\Services\TransactionService;
use Illuminate\Support\Facades\DB;
use Throwable;

trait ManagesWorkflows
{
    protected static function buildTxnReference(string $prefix): string
    {
        return sprintf('%s-%s-%d', $prefix, now()->format('YmdHis'), random_int(100, 999));
    }

    /**
     * Execute a forensic write workflow with transaction safety and correlation tracking.
     *
     * @param  int  $actorId  The ID of the user performing the action.
     * @param  string  $action  The name of the action (e.g., 'CREATE_TENANT').
     * @param  string  $txnReference  A unique reference for the transaction log.
     * @param  array  $payload  Initial context for the transaction log.
     * @param  callable  $operation  The core DB operation.
     * @param  callable|null  $resultDetails  Optional callback to derive result details from operation output.
     * @return mixed The result of the operation.
     *
     * @throws Throwable
     */
    protected static function runWriteWorkflow(
        int $actorId,
        string $action,
        string $txnReference,
        array $payload,
        callable $operation,
        ?callable $resultDetails = null
    ): mixed {
        $tx = TransactionService::logStarted($action, $txnReference, $actorId, $payload);

        // Set context for DB triggers (Forensic Integrity)
        AuditService::setAuditUserContext($actorId);
        AuditService::setCorrelationContext($tx['correlation_id']);

        try {
            $result = DB::transaction($operation);

            TransactionService::logCommitted(
                $tx['tx_log_id'],
                $resultDetails ? $resultDetails($result) : []
            );

            return $result;
        } catch (Throwable $e) {
            TransactionService::logRolledBack($tx['tx_log_id'], $e->getMessage(), $payload);
            throw $e;
        } finally {
            AuditService::clearCorrelationContext();
        }
    }
}
