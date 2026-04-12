<?php

namespace App\Support;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\JsonResponse;

final class PaginationResponse
{
    /** Merge into `$request->validate([...])` for list endpoints. */
    public static function queryRules(): array
    {
        return [
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ];
    }

    /**
     * @param  array<string, mixed>  $validated
     * @return array{page: int, per_page: int}
     */
    public static function normalizePageParams(array $validated): array
    {
        return [
            'page' => max(1, (int) ($validated['page'] ?? 1)),
            'per_page' => min(100, max(1, (int) ($validated['per_page'] ?? 25))),
        ];
    }

    /**
     * Standard list envelope: { data: T[], meta: { current_page, last_page, per_page, total, from, to, ... } }.
     *
     * @param  array<string, int|float|string|bool|null>  $extraMeta
     */
    public static function fromPaginator(LengthAwarePaginator $paginator, array $extraMeta = []): JsonResponse
    {
        return response()->json([
            'data' => $paginator->items(),
            'meta' => array_merge([
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'from' => $paginator->firstItem(),
                'to' => $paginator->lastItem(),
            ], $extraMeta),
        ]);
    }
}
