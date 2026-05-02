<?php

namespace App\Services\Core;

use App\Enums\AuditAction;
use App\Enums\EventCategory;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Audit Service
 *
 * Handles database session context injection and manual application-level
 * audit events. This is the foundation of the HavenStay auditing system.
 */
class AuditService
{
    /**
     * Set the current operator ID in the database session.
     * Required for MySQL triggers to capture the 'changed_by' attribute.
     */
    public static function setAuditUserContext(int $userId): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement('SET @current_user_id = ?', [$userId]);
        }
    }

    /**
     * Set the correlation ID for the current thread of execution.
     * Links high-level business workflows to low-level audit log mutations.
     */
    public static function setCorrelationContext(?string $correlationId): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement('SET @current_correlation_id = ?', [$correlationId]);
        }
    }



    /**
     * Set the request-level forensic context.
     */
    public static function setRequestContext(?string $requestId, ?string $endpoint, ?string $method, ?string $ip = null): void
    {
        if (DB::getDriverName() === 'mysql') {
            $sql = 'SET @current_request_id = ?, @current_endpoint = ?, @current_http_method = ?';
            $params = [$requestId, $endpoint, $method];

            if ($ip !== null) {
                $sql .= ', @current_ip_address = ?';
                $params[] = $ip;
            }

            DB::statement($sql, $params);
        }
    }

    /**
     * Set a system-level context for Artisan commands, seeders, or background jobs.
     * Defaults to the Admin user (ID: 1) and generates a system-prefixed correlation ID.
     */
    public static function setSystemContext(string $origin = 'system'): void
    {
        $correlationId = sprintf('sys_%s_%s', $origin, bin2hex(random_bytes(4)));
        $requestId = sprintf('req_sys_%s', bin2hex(random_bytes(4)));

        self::setAuditUserContext(1); // Default to System Administrator
        self::setCorrelationContext($correlationId);
        self::setRequestContext($requestId, "system::$origin", "CLI", "127.0.0.1");
    }


    /**
     * Clean up the forensic context after a workflow completes.
     */
    public static function clearCorrelationContext(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement('SET @current_user_id = NULL, @current_correlation_id = NULL, @current_ip_address = NULL, @current_request_id = NULL, @current_endpoint = NULL, @current_http_method = NULL');
        }
    }

    /**
     * Log a manual application-layer event that isn't captured by DB triggers.
     * Used for security events (login, logout, access denied).
     */
    public static function logManualAction(
        int $userId, 
        AuditAction $action, 
        string $targetTable, 
        ?string $recordId = null,
        EventCategory $category = EventCategory::DATA,
        bool $isSuccess = true,
        ?string $errorMessage = null,
        array $metadata = []
    ): void {
        // High-Fidelity Capture: Try to get context from MySQL session first
        $requestId = null;
        $ipAddress = null;
        $correlationId = null;

        $endpoint = null;
        $httpMethod = null;

        if (DB::getDriverName() === 'mysql') {
            $context = DB::selectOne('SELECT @current_request_id as rid, @current_ip_address as ip, @current_correlation_id as cid, @current_endpoint as endpoint, @current_http_method as method');
            $requestId = $context->rid ?? null;
            $ipAddress = $context->ip ?? null;
            $correlationId = $context->cid ?? null;
            $endpoint = $context->endpoint ?? null;
            $httpMethod = $context->method ?? null;
        }

        // Fallback: Check request attributes (useful for SQLite/Testing)
        $request = request();
        if ($request) {
            $requestId ??= $request->attributes->get('request_id');
            $ipAddress ??= $request->ip();
            $correlationId ??= $request->attributes->get('correlation_id');
            $endpoint ??= $request->fullUrl();
            $httpMethod ??= $request->method();
        }

        AuditLog::create([
            'action' => $action,
            'event_category' => $category,
            'target_table' => $targetTable,
            'record_id' => $recordId ?? 0,
            'changed_by' => $userId,
            'is_success' => $isSuccess,
            'error_message' => $errorMessage,
            'request_id' => $requestId,
            'ip_address' => $ipAddress,
            'correlation_id' => $correlationId,
            'endpoint' => $endpoint,
            'http_method' => $httpMethod,
            'execution_time_ms' => ($request && $request->attributes->has('start_time')) 
                ? (int) ((microtime(true) - $request->attributes->get('start_time')) * 1000) 
                : null,
            'metadata' => array_merge([
                'origin' => app()->runningInConsole() ? 'cli' : 'web',
                'captured_via' => DB::getDriverName() === 'mysql' ? 'session' : 'request'
            ], $metadata),
            'changed_at' => now(),
        ]);
    }

    /**
     * Specialized: Log a user login event.
     */
    public static function logLogin(User $user, array $metadata = []): void
    {
        self::logManualAction(
            (int) $user->user_id, 
            AuditAction::LOGIN, 
            'users', 
            (string) $user->user_id,
            EventCategory::AUTH,
            true,
            null,
            $metadata
        );
    }

    /**
     * Specialized: Log a user logout event.
     */
    public static function logLogout(?User $user): void
    {
        if ($user) {
            self::logManualAction(
                (int) $user->user_id, 
                AuditAction::LOGOUT, 
                'users', 
                (string) $user->user_id,
                EventCategory::AUTH
            );
        }
    }

    /**
     * Specialized: Access Denied entry for unauthorized RBAC attempts.
     */
    public static function logAccessDenied(?User $user, string $targetTable): void
    {
        $userId = $user?->user_id ?? 0;

        self::logManualAction(
            $userId, 
            AuditAction::ACCESS_DENIED, 
            $targetTable, 
            '0',
            EventCategory::SECURITY,
            false,
            'Unauthorized RBAC attempt'
        );
    }
    /**
     * Specialized: Log a failed or blocked OAuth attempt.
     * Used when an OAuth callback is received but access is denied
     * (deactivated account, provider error, or unknown failure).
     */
    public static function logFailedOAuth(
        string $provider,
        ?string $email,
        ?string $reason,
        ?string $ipAddress = null
    ): void {
        $request = request();
        $resolvedIp = $ipAddress ?? $request?->ip();

        AuditLog::create([
            'action'          => AuditAction::FAILED_LOGIN,
            'event_category'  => EventCategory::SECURITY,
            'target_table'    => 'users',
            'record_id'       => 0,
            'changed_by'      => 0,
            'is_success'      => false,
            'error_message'   => $reason,
            'request_id'      => $request?->attributes->get('request_id'),
            'ip_address'      => $resolvedIp,
            'correlation_id'  => $request?->attributes->get('correlation_id'),
            'endpoint'        => $request?->fullUrl(),
            'http_method'     => $request?->method(),
            'metadata'        => [
                'origin'   => 'web',
                'provider' => $provider,
                'email'    => $email,
            ],
            'changed_at'      => now(),
        ]);
    }
}
