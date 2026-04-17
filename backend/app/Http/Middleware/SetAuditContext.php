<?php

namespace App\Http\Middleware;

use App\Services\AuditService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SetAuditContext
{
    /**
     * Set the database-level audit user context (@current_user_id).
     * This ensures that database triggers capture the correct actor ID.
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
