<?php

namespace App\Http\Middleware;

use App\Services\AuditService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SetAuditContext
{
    /**
     * Set the database-level audit user context (@app_user_id).
     * This ensures that database triggers capture the correct actor ID.
     */
    public function handle(Request $request, Closure $next): Response
    {
        if ($user = $request->user()) {
            AuditService::setAuditUserContext($user->user_id);
        }

        return $next($request);
    }
}
