<?php

namespace App\Http\Middleware;

use App\Services\Analytics\AuditService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Forensic context middleware. Propagates the authenticated user ID
 * to the database session for trigger-based auditing.
 */
class SetAuditContext
{
    /**
     * Set the database-level audit user context (@current_user_id).
     * This ensures that database triggers capture the correct actor ID.
     *
     * @param Request $request
     * @param Closure $next
     * @return Response
     */
    public function handle(Request $request, Closure $next): Response
    {
        if ($user = $request->user()) {
            AuditService::setAuditUserContext($user->user_id);
        }

        return $next($request);
    }

    /**
     * Defense in depth: clear DB session vars after the response is sent.
     */
    public function terminate(Request $request, Response $response): void
    {
        AuditService::clearCorrelationContext();
    }
}
