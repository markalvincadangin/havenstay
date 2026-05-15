<?php

namespace App\Http\Middleware;

use App\Services\Core\AuditService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Forensic context middleware. Propagates the authenticated user ID
 * and a unique correlation ID to the database session for trigger-based auditing.
 * Optimized for HavenStay Forensic v5.0.
 */
class SetAuditContext
{
    /**
     * Set the database-level audit context (@current_user_id and @current_correlation_id).
     * This ensures that database triggers capture the correct actor and request context.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $correlationId = $request->header('X-Correlation-ID') ?? 'req_'.bin2hex(random_bytes(8));
        $requestId = 'trace_'.bin2hex(random_bytes(12));
        $endpoint = $request->path();
        $method = $request->method();
        $ip = $request->ip();
        $startTime = microtime(true);

        $request->attributes->set('correlation_id', $correlationId);
        $request->attributes->set('request_id', $requestId);
        $request->attributes->set('start_time', $startTime);

        $userId = 0;
        if ($user = $request->user()) {
            $userId = (int) $user->user_id;
        }

        // Optimized Batch Context Injection (SOC 2 Forensic Standard)
        AuditService::setFullForensicContext($userId, $correlationId, $requestId, $endpoint, $method, $ip);

        $response = $next($request);

        $response->headers->set('X-Correlation-ID', $correlationId);
        $response->headers->set('X-Request-ID', $requestId);

        return $response;
    }

    /**
     * Defense in depth: clear DB session variables after the response is sent.
     * This prevents context leakage in persistent connection environments.
     */
    public function terminate(Request $request, Response $response): void
    {
        AuditService::clearCorrelationContext();
    }
}
