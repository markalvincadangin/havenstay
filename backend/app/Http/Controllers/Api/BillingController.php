<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Billing\StoreBillingRequest;
use App\Http\Requests\Billing\UpdateBillingStatusRequest;
use App\Models\Billing;
use App\Services\Identity\AuthorizationService;
use App\Services\Operations\BillingService;
use App\Services\Analytics\PiiMaskingService;
use App\Support\Pagination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BillingController extends Controller
{
    /**
     * List billing records with comprehensive filtering and pagination.
     * Authorized: Admin, Staff.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function index(Request $request): JsonResponse
    {
        AuthorizationService::ensureCanViewBilling($request->user());

        $validated = $request->validate(array_merge([
            'contract_id' => ['nullable', 'integer'],
            'tenant_id' => ['nullable', 'integer'],
            'q' => ['nullable', 'string', 'max:200'],
            'status' => ['nullable', 'string', 'in:unpaid,partial,paid,overdue'],
            'receivable_state' => ['nullable', 'string', 'in:all,current,past_due'],
            'past_due' => ['nullable', 'boolean'],
            'due_date' => ['nullable', 'date'],
        ], Pagination::queryRules()));

        $pageParams = Pagination::normalizePageParams($validated);
        $filters = array_filter([
            'contract_id' => $validated['contract_id'] ?? null,
            'tenant_id' => $validated['tenant_id'] ?? null,
            'q' => isset($validated['q']) ? trim((string) $validated['q']) : '',
            'due_date' => $validated['due_date'] ?? null,
        ], fn ($v) => $v !== null && $v !== '');

        if (! empty($validated['receivable_state']) && $validated['receivable_state'] !== 'all') {
            $filters['receivable_state'] = $validated['receivable_state'];
        } elseif (! empty($validated['past_due'])) {
            $filters['receivable_state'] = 'past_due';
        }

        if (! empty($validated['status'])) {
            $filters['status'] = $validated['status'];
        }

        $query = BillingService::listQueryWithSums($filters);

        $paginator = $query->paginate($pageParams['per_page'], ['*'], 'page', $pageParams['page']);

        $paginator->through(function ($billing) use ($request) {
            BillingService::syncBillingStatusFromAttributes($billing);
            $row = $billing->toArray();
            $row['balance'] = (float) (($row['total_amount'] ?? 0) - ($row['total_paid'] ?? 0));

            return PiiMaskingService::maskBillingNestedTenant($request->user(), $row);
        });

        return Pagination::fromPaginator($paginator);
    }

    /**
     * Create a new manual billing entry.
     * Authorized: Admin, Staff.
     *
     * @param StoreBillingRequest $request
     * @return JsonResponse
     */
    public function store(StoreBillingRequest $request): JsonResponse
    {
        AuthorizationService::ensureCanManageBilling($request->user());

        $validated = $request->validated();

        $billing = BillingService::create($request->user(), $validated);

        return response()->json([
            'message' => 'Billing entry created successfully.',
            'data' => $billing,
        ], 201);
    }

    /**
     * Retrieve detailed billing information with related contract and payments.
     * Authorized: Admin, Staff.
     *
     * @param Request $request
     * @param Billing $billing
     * @return JsonResponse
     */
    public function show(Request $request, Billing $billing): JsonResponse
    {
        AuthorizationService::ensureCanViewBilling($request->user());

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

    public function updateStatus(UpdateBillingStatusRequest $request, Billing $billing): JsonResponse
    {
        AuthorizationService::ensureCanManageBilling($request->user());

        $billing->load(['lineItems', 'payments']);
        BillingService::syncBillingStatusFromAttributes($billing);

        return response()->json([
            'message' => 'Billing status recalculated successfully.',
            'data' => tap(BillingService::getById((int) $billing->billing_id)?->toArray() ?? [], function (&$payload) {
                $payload['balance'] = (float) (($payload['total_amount'] ?? 0) - ($payload['total_paid'] ?? 0));
            }),
        ]);
    }

    /**
     * Initialize the first billing (1+1) for a contract.
     *
     * @param Request $request
     * @param int $contractId
     * @return JsonResponse
     */
    public function initialize(Request $request, int $contractId): JsonResponse
    {
        AuthorizationService::ensureCanManageBilling($request->user());

        $billing = BillingService::initializeContractBilling($request->user(), $contractId);

        return response()->json([
            'message' => 'Initial billing setup (Advance Rent + Deposit) generated successfully.',
            'data' => $billing,
        ], 201);
    }
}
