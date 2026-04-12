<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Billing;
use App\Services\AuditService;
use App\Services\AuthorizationService;
use App\Services\BillingService;
use App\Support\PaginationResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BillingController extends Controller
{
    /**
     * FR-020..FR-023, FR-027: List billing entries.
     */
    public function index(Request $request): JsonResponse
    {
        if (! AuthorizationService::canViewBilling($request->user())) {
            AuditService::logAccessDenied($request->user(), 'billing.view');

            return response()->json([
                'message' => 'Unauthorized: you do not have permission to view billing.',
            ], 403);
        }

        // User PK is user_id (schema); triggers need @app_user_id before billing UPDATEs.
        AuditService::setAuditUserContext($request->user()->user_id);

        $validated = $request->validate(array_merge([
            'contract_id' => ['nullable', 'integer'],
            'tenant_id' => ['nullable', 'integer'],
            'q' => ['nullable', 'string', 'max:200'],
            'status' => ['nullable', 'string', 'in:unpaid,partial,paid,overdue'],
            'past_due' => ['nullable', 'boolean'],
        ], PaginationResponse::queryRules()));

        $pageParams = PaginationResponse::normalizePageParams($validated);
        $filters = array_filter([
            'contract_id' => $validated['contract_id'] ?? null,
            'tenant_id' => $validated['tenant_id'] ?? null,
            'q' => isset($validated['q']) ? trim((string) $validated['q']) : '',
        ], fn ($v) => $v !== null && $v !== '');

        if (! empty($validated['past_due'])) {
            $filters['past_due'] = true;
        } elseif (! empty($validated['status'])) {
            $filters['status'] = $validated['status'];
        }

        $paginator = BillingService::listQuery($filters)
            ->paginate($pageParams['per_page'], ['*'], 'page', $pageParams['page']);

        $paginator->getCollection()->transform(function ($billing) {
            BillingService::autoUpdateStatus($billing);

            return $billing;
        });

        return PaginationResponse::fromPaginator($paginator);
    }

    /**
     * FR-020..FR-023, TC-BILLING-001/002/004: Create billing cycle.
     */
    public function store(Request $request): JsonResponse
    {
        if (! AuthorizationService::canManageBilling($request->user())) {
            AuditService::logAccessDenied($request->user(), 'billing.create');

            return response()->json([
                'message' => 'Unauthorized: only Admin or Staff can create billing entries.',
            ], 403);
        }

        $validated = $request->validate([
            'contract_id' => ['required', 'integer', 'exists:contracts,contract_id'],
            'billing_period_from' => ['required', 'date'],
            'billing_period_to' => ['required', 'date'],
            'due_date' => ['required', 'date'],
            'line_items' => ['required', 'array', 'min:1'],
            'line_items.*.item_type' => ['required', 'in:base_rent,utility,add_on,penalty,adjustment'],
            'line_items.*.item_description' => ['nullable', 'string', 'max:255'],
            'line_items.*.amount' => ['required', 'numeric'],
        ]);

        $billing = BillingService::create($validated);

        return response()->json([
            'message' => 'Billing entry created successfully.',
            'billing' => $billing,
        ], 201);
    }

    /**
     * FR-027: View billing details including line items and payment history.
     */
    public function show(Request $request, Billing $billing): JsonResponse
    {
        if (! AuthorizationService::canViewBilling($request->user())) {
            AuditService::logAccessDenied($request->user(), 'billing.view');

            return response()->json([
                'message' => 'Unauthorized: you do not have permission to view billing.',
            ], 403);
        }

        AuditService::setAuditUserContext($request->user()->user_id);

        return response()->json(BillingService::getById((int) $billing->billing_id));
    }

    /**
     * FR-023, FR-025, BR-008: Recalculate billing status from line items and payments (no manual override).
     */
    public function updateStatus(Request $request, Billing $billing): JsonResponse
    {
        if (! AuthorizationService::canManageBilling($request->user())) {
            AuditService::logAccessDenied($request->user(), 'billing.update_status');

            return response()->json([
                'message' => 'Unauthorized: only Admin or Staff can recalculate billing status.',
            ], 403);
        }

        $billing->load(['lineItems', 'payments']);
        $updated = BillingService::autoUpdateStatus($billing);

        return response()->json([
            'message' => 'Billing status recalculated successfully.',
            'billing' => BillingService::getById((int) $updated->billing_id),
        ]);
    }
}
