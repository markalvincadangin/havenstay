<?php

namespace App\Http\Controllers\Api;

use App\Http\Concerns\HandlesAuthorization;
use App\Http\Controllers\Controller;
use App\Http\Requests\Billing\StoreBillingRequest;
use App\Http\Requests\Billing\UpdateBillingStatusRequest;
use App\Models\Billing;
use App\Services\AuthorizationService;
use App\Services\BillingService;
use App\Services\PiiMaskingService;
use App\Support\PaginationResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BillingController extends Controller
{
    use HandlesAuthorization;

    /**
     */
    public function index(Request $request): JsonResponse
    {
        if (! AuthorizationService::canViewBilling($request->user())) {
            return $this->forbidden($request, 'billing.view', 'Unauthorized: you do not have permission to view billing.');
        }

        $validated = $request->validate(array_merge([
            'contract_id' => ['nullable', 'integer'],
            'tenant_id' => ['nullable', 'integer'],
            'q' => ['nullable', 'string', 'max:200'],
            'status' => ['nullable', 'string', 'in:unpaid,partial,paid,overdue'],
            'receivable_state' => ['nullable', 'string', 'in:all,current,past_due'],
            'past_due' => ['nullable', 'boolean'],
            'due_date' => ['nullable', 'date'],
        ], PaginationResponse::queryRules()));

        $pageParams = PaginationResponse::normalizePageParams($validated);
        $filters = array_filter([
            'contract_id' => $validated['contract_id'] ?? null,
            'tenant_id' => $validated['tenant_id'] ?? null,
            'q' => isset($validated['q']) ? trim((string) $validated['q']) : '',
            'due_date' => $validated['due_date'] ?? null,
        ], fn ($v) => $v !== null && $v !== '');

        if (! empty($validated['receivable_state']) && $validated['receivable_state'] !== 'all') {
            $filters['receivable_state'] = $validated['receivable_state'];
        } elseif (! empty($validated['past_due'])) {
            // Backward compatibility for older clients.
            $filters['receivable_state'] = 'past_due';
        }

        if (! empty($validated['status'])) {
            $filters['status'] = $validated['status'];
        }

        $query = BillingService::listQueryWithSums($filters);

        $paginator = $query->paginate($pageParams['per_page'], ['*'], 'page', $pageParams['page']);

        $paginator->through(function ($billing) use ($request) {
            BillingService::quietAutoUpdateStatus($billing);
            $row = $billing->toArray();
            $row['balance'] = (float) (($row['total_amount'] ?? 0) - ($row['total_paid'] ?? 0));

            return PiiMaskingService::maskBillingNestedTenant($request->user(), $row);
        });

        return PaginationResponse::fromPaginator($paginator);
    }

    /**
     */
    public function store(StoreBillingRequest $request): JsonResponse
    {
        if (! AuthorizationService::canManageBilling($request->user())) {
            return $this->forbidden($request, 'billing.create', 'Unauthorized: only Admin or Staff can create billing entries.');
        }

        $validated = $request->validated();

        $billing = BillingService::create($request->user(), $validated);

        return response()->json([
            'message' => 'Billing entry created successfully.',
            'data' => $billing,
        ], 201);
    }

    /**
     */
    public function show(Request $request, Billing $billing): JsonResponse
    {
        if (! AuthorizationService::canViewBilling($request->user())) {
            return $this->forbidden($request, 'billing.view', 'Unauthorized: you do not have permission to view billing.');
        }

        $loaded = BillingService::getById((int) $billing->billing_id);
        if (! $loaded) {
            return response()->json(['message' => 'Billing record not found.'], 404);
        }

        $payload = $loaded->toArray();
        $payload['balance'] = (float) (($payload['total_amount'] ?? 0) - ($payload['total_paid'] ?? 0));
        $payload = PiiMaskingService::maskBillingNestedTenant($request->user(), $payload);

        return response()->json([
            'message' => 'Billing record retrieved successfully.',
            'data' => $payload,
        ]);
    }

    /**
     */
    public function updateStatus(UpdateBillingStatusRequest $request, Billing $billing): JsonResponse
    {
        if (! AuthorizationService::canManageBilling($request->user())) {
            return $this->forbidden($request, 'billing.update_status', 'Unauthorized: only Admin or Staff can recalculate billing status.');
        }

        $billing->load(['lineItems', 'payments']);
        $updated = BillingService::autoUpdateStatus($billing);

        return response()->json([
            'message' => 'Billing status recalculated successfully.',
            'data' => tap(BillingService::getById((int) $updated->billing_id)?->toArray() ?? [], function (&$payload) {
                $payload['balance'] = (float) (($payload['total_amount'] ?? 0) - ($payload['total_paid'] ?? 0));
            }),
        ]);
    }
}
