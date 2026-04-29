<?php

namespace App\Http\Concerns;

use App\Support\Pagination;
use Illuminate\Http\JsonResponse;
use Illuminate\Pagination\LengthAwarePaginator;

/**
 * RespondsWithJsonTrait
 *
 * Standardizes API envelopes for the HavenStay ecosystem.
 * Ensures all successful responses include the 'message' and 'data' keys
 * for frontend consistency and forensic traceability.
 */
trait RespondsWithJson
{
    /**
     * Generic success response (HTTP 200).
     */
    protected function success(string $message, mixed $data = [], int $status = 200): JsonResponse
    {
        return response()->json([
            'message' => $message,
            'data' => $data,
        ], $status);
    }

    /**
     * Resource creation response (HTTP 201).
     */
    protected function created(string $message, mixed $data = []): JsonResponse
    {
        return $this->success($message, $data, 201);
    }

    /**
     * Standard success with no special message (HTTP 200).
     */
    protected function ok(mixed $data = []): JsonResponse
    {
        return $this->success('Operation successful.', $data);
    }

    /**
     * Error response envelope (HTTP 4xx/5xx).
     */
    protected function error(string $message, int $status = 400, mixed $errors = []): JsonResponse
    {
        $payload = ['message' => $message];

        if (! empty($errors)) {
            $payload['errors'] = $errors;
        }

        return response()->json($payload, $status);
    }

    /**
     * Paginated list response envelope.
     */
    protected function paginated(LengthAwarePaginator $paginator, array $extraMeta = [], string $message = 'Records retrieved successfully.', ?string $resourceClass = null): JsonResponse
    {
        if ($resourceClass && class_exists($resourceClass)) {
            $paginator->setCollection(
                collect($resourceClass::collection($paginator->getCollection()))
            );
        }

        return Pagination::fromPaginator($paginator, $extraMeta, $message);
    }
}
