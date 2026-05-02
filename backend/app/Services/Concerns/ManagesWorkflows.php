<?php

namespace App\Services\Concerns;

use App\Services\Core\AuditService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Throwable;

/**
 * ManagesWorkflows
 *
 * Provides forensic transaction orchestration for Tier 5 hardened services.
 * Ensures every state mutation is linked to a correlation ID for DB trigger
 * traceability.
 *
 * Note: Legacy transaction_logs have been decommissioned. Forensic integrity
 * is now handled via unified audit_logs and correlation contexts.
 */
trait ManagesWorkflows
{
    /**
     * Execute a forensic write workflow with transaction safety and correlation tracking.
     *
     * @param  int  $actorId  The ID of the user performing the action.
     * @param  string  $action  The name of the action (e.g., 'CREATE_TENANT').
     * @param  array  $payload  Context for the transaction (for forensic trace).
     * @param  callable  $operation  The core DB operation.
     * @param  callable|null  $resultDetails  Optional callback (kept for signature compatibility).
     * @return mixed The result of the operation.
     *
     * @throws Throwable
     */
    protected static function runWriteWorkflow(
        int $actorId,
        string $action,
        array $payload,
        callable $operation,
        ?callable $resultDetails = null
    ): mixed {
        $correlationId = request()->attributes->get('correlation_id') ?? (string) Str::uuid();

        // Set context for DB triggers (Forensic Integrity)
        AuditService::setAuditUserContext($actorId);
        AuditService::setCorrelationContext($correlationId);
        
        // IP Context is already handled by SetAuditContext middleware. 
        // We only re-set it if we are in console mode (where middleware is bypassed).
        if (app()->runningInConsole()) {
            AuditService::setRequestContext(null, null, null, '127.0.0.1');
        }

        try {
            return DB::transaction($operation);
        } finally {
            // Context is cleared by SetAuditContext middleware for web requests.
            // We only clear it here for console/Artisan jobs to prevent leakage.
            if (app()->runningInConsole()) {
                AuditService::clearCorrelationContext();
            }
        }
    }
}
