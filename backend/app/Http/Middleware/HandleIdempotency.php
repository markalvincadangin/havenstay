<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\HttpFoundation\Response;

/**
 * HandleIdempotency — Forensic integrity guard for state-changing requests.
 * 
 * Ensures that requests with the same Idempotency-Key are processed exactly once.
 * Replays the original successful response for subsequent identical requests.
 */
class HandleIdempotency
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $key = $request->header('Idempotency-Key');

        // Only apply to state-changing methods with a key
        if (!$key || !$request->isMethodSafe() === false) {
            return $next($request);
        }

        $cacheKey = "idempotency_res_{$key}";
        $lockKey = "idempotency_lock_{$key}";
        $requestFingerprint = md5($request->getContent());

        // 1. Check for cached response
        if ($cached = Cache::get($cacheKey)) {
            $data = json_decode($cached, true);
            
            // Forensic Payload Validation: Ensure the intent hasn't changed for this key
            if (($data['fingerprint'] ?? null) !== $requestFingerprint) {
                return response()->json([
                    'message' => 'Idempotency Key reused with different payload.',
                    'code' => 'IDEMPOTENCY_PAYLOAD_MISMATCH'
                ], 422);
            }

            return response()->json($data['content'], $data['status'], [
                'X-Idempotency-Replay' => 'true',
                'X-Idempotency-Original-Timestamp' => $data['timestamp']
            ]);
        }

        // 2. Atomic Lock to prevent race conditions (Double-tap)
        $lock = Cache::lock($lockKey, 30); // 30s timeout

        if (!$lock->get()) {
            return response()->json([
                'message' => 'Conflict: This transaction is already being processed.',
                'code' => 'IDEMPOTENCY_CONFLICT'
            ], 409);
        }

        try {
            /** @var Response $response */
            $response = $next($request);

            // 3. Cache only successful responses (2xx)
            if ($response->isSuccessful()) {
                Cache::put($cacheKey, json_encode([
                    'content' => json_decode($response->getContent(), true),
                    'status' => $response->getStatusCode(),
                    'fingerprint' => $requestFingerprint,
                    'timestamp' => now()->toIso8601String()
                ]), 3600); // Cache for 1 hour
            }

            return $response;
        } finally {
            $lock->release();
        }
    }
}
