<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Analytics\TransactionService;
use App\Services\Identity\AuthorizationService;
use App\Support\Pagination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TransactionController extends Controller
{
    /**
     * List low-level database transactions (Triggers & Audit).
     * Authorized: Admin only.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function index(Request $request): JsonResponse
    {
        AuthorizationService::ensureCanManageUsers($request->user());

        $validated = $request->validate(array_merge([
            'q' => ['sometimes', 'nullable', 'string', 'max:200'],
            'status' => ['sometimes', 'nullable', 'string', 'in:started,committed,rolled_back,failed'],
            'from' => ['sometimes', 'nullable', 'string', 'max:32'],
            'to' => ['sometimes', 'nullable', 'string', 'max:32'],
        ], Pagination::queryRules()));

        $pageParams = Pagination::normalizePageParams($validated);

        $filters = array_filter(
            [
                'q' => isset($validated['q']) ? trim((string) $validated['q']) : '',
                'status' => $validated['status'] ?? '',
                'from' => $validated['from'] ?? '',
                'to' => $validated['to'] ?? '',
            ],
            fn ($v) => $v !== null && $v !== ''
        );

        $paginator = TransactionService::listLogsPaginated($pageParams['page'], $pageParams['per_page'], $filters);
        $stats = TransactionService::getLogStats($filters);

        return Pagination::fromPaginator($paginator, $stats);
    }
}
