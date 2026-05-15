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

        // Optimized Context Check: Only re-inject if we are running in Console
        // Web requests are already hardened by the SetAuditContext middleware.
        if (app()->runningInConsole()) {
            $requestId = 'cli_' . bin2hex(random_bytes(8));
            AuditService::setFullForensicContext(
                $actorId,
                $correlationId,
                $requestId,
                'cli_workflow::' . $action,
                'CLI',
                '127.0.0.1'
            );
        } else {
            // High-Performance Sync: Propagate specific actorId into the existing forensic JSON context.
            // This ensures that service-level overrides are captured by the DB triggers.
            AuditService::setFullForensicContext(
                $actorId,
                request()->attributes->get('correlation_id') ?? (string) Str::uuid(),
                request()->attributes->get('request_id') ?? 'req_' . bin2hex(random_bytes(8)),
                request()->path(),
                request()->method(),
                request()->ip() ?? '127.0.0.1'
            );
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
