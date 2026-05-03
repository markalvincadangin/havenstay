<?php

namespace App\Support;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\JsonResponse;

final class Pagination
{
    public static function queryRules(): array
    {
        return [
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
            'sort_by' => ['sometimes', 'string', 'max:50'],
            'sort_dir' => ['sometimes', 'string', 'in:asc,desc'],
        ];
    }

    /**
     * @param  array<string, mixed>  $validated
     * @return array{page: int, per_page: int, sort_by: string|null, sort_dir: string}
     */
    public static function normalizePageParams(array $validated): array
    {
        return [
            'page' => max(1, (int) ($validated['page'] ?? 1)),
            'per_page' => min(100, max(1, (int) ($validated['per_page'] ?? 25))),
            'sort_by' => $validated['sort_by'] ?? null,
            'sort_dir' => $validated['sort_dir'] ?? 'asc',
        ];
    }

    /**
     * Standard list envelope: { data: T[], meta: { current_page, last_page, per_page, total, from, to, ... } }.
     *
     * @param  array<string, int|float|string|bool|null>  $extraMeta
     */
    public static function fromPaginator(LengthAwarePaginator $paginator, array $extraMeta = [], string $message = 'Records retrieved successfully.'): JsonResponse
    {
        return response()->json([
            'message' => $message,
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
