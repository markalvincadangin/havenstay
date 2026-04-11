<?php

namespace App\Http\Middleware;

use App\Services\AuditService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AuthCheck
{
    public function handle(Request $request, Closure $next): Response
    {
        // FR-001: Require authentication
        if (! $request->user()) {
            AuditService::logAccessDenied(null, $request->path());

            return response()->json([
                'message' => 'Unauthenticated.',
            ], 401);
        }

        // FR-002/FR-004: Check if user is active
        if ($request->user() && ! $request->user()->isActive()) {
            AuditService::logAccessDenied($request->user(), $request->path());

            return response()->json([
                'message' => 'Your account has been deactivated.',
            ], 403);
        }

        return $next($request);
    }
}
