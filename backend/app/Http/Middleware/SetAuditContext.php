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
      *
      * @param Request $request
      * @param Closure $next
      * @return Response
      */
     public function handle(Request $request, Closure $next): Response
     {
         if ($user = $request->user()) {
             // 1. Set the Actor Context
             AuditService::setAuditUserContext((int) $user->user_id);
 
             // 2. Resolve or Generate Correlation ID
             // If the frontend provides one, we preserve it; otherwise, we generate a forensic trace.
             $correlationId = $request->header('X-Correlation-ID') 
                 ?? 'req_' . bin2hex(random_bytes(8));
             
             AuditService::setCorrelationContext($correlationId);
 
             // 3. Attach to request for downstream consumption (logging/response headers)
             $request->attributes->set('correlation_id', $correlationId);
         }
 
         return $next($request);
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
