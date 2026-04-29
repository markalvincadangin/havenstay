<?php

namespace App\Http\Middleware;

use App\Services\Core\AuditService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Security middleware for verifying user authentication and account state.
 * Enforces 'isActive' account status and forensically logs denial events.
 * Optimized for HavenStay Forensic v5.0.
 */
class AuthCheck
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        if (! $request->user()) {
            // Use Core service for audit logging
            AuditService::logAccessDenied(null, $request->path());

            return response()->json([
                'message' => 'Unauthenticated.',
            ], 401);
        }

        if ($request->user() && ! $request->user()->isActive()) {
            AuditService::logAccessDenied($request->user(), $request->path());

            return response()->json([
                'message' => 'Your account has been deactivated.',
            ], 403);
        }

        return $next($request);
    }
}
