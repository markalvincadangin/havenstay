<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Services\AuditService;
use App\Services\AuthorizationService;
use App\Services\PaymentService;
use App\Support\PaginationResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PaymentController extends Controller
{
    /**
     * FR-027: View payment history by tenant/contract/billing filters.
     */
    public function index(Request $request): JsonResponse
    {
        if (! AuthorizationService::canViewBilling($request->user())) {
            AuditService::logAccessDenied($request->user(), 'payments.index');

            return response()->json(['message' => 'Unauthorized to view payment history.'], 403);
        }

        $validated = $request->validate(array_merge([
            'tenant_id' => ['nullable', 'integer'],
            'contract_id' => ['nullable', 'integer'],
            'billing_id' => ['nullable', 'integer'],
            'q' => ['nullable', 'string', 'max:200'],
            'payment_from' => ['nullable', 'date'],
            'payment_to' => ['nullable', 'date'],
            'posting_status' => ['nullable', 'string', 'in:posted,voided'],
        ], PaginationResponse::queryRules()));

        $pageParams = PaginationResponse::normalizePageParams($validated);

        $filters = array_filter(
            [
                'tenant_id' => $validated['tenant_id'] ?? null,
                'contract_id' => $validated['contract_id'] ?? null,
                'billing_id' => $validated['billing_id'] ?? null,
                'q' => isset($validated['q']) ? trim((string) $validated['q']) : '',
                'payment_from' => $validated['payment_from'] ?? '',
                'payment_to' => $validated['payment_to'] ?? '',
                'posting_status' => $validated['posting_status'] ?? '',
            ],
            fn ($v) => $v !== null && $v !== ''
        );

        $paginator = PaymentService::listHistoryQuery($filters)
            ->paginate($pageParams['per_page'], ['*'], 'page', $pageParams['page']);

        return PaginationResponse::fromPaginator($paginator);
    }

    /**
     * FR-027: View a single payment (posted or voided) with billing context.
     */
    public function show(Request $request, Payment $payment): JsonResponse
    {
        if (! AuthorizationService::canViewBilling($request->user())) {
            AuditService::logAccessDenied($request->user(), 'payments.show');

            return response()->json(['message' => 'Unauthorized to view payment details.'], 403);
        }

        $payment->load([
            'billing.contract.tenant',
            'billing.contract.bedSpace.room',
            'billing.contract.room',
            'processor',
        ]);

        return response()->json($payment);
    }

    /**
     * FR-024..FR-026, TC-PAYMENT-001/002/003, TC-TX-001/002/003: Record payment.
     */
    public function store(Request $request): JsonResponse
    {
        if (! AuthorizationService::canManageBilling($request->user())) {
            AuditService::logAccessDenied($request->user(), 'payments.store');

            return response()->json(['message' => 'Unauthorized to record payments.'], 403);
        }

        $refRaw = $request->input('reference_number');
        $trimmedRef = is_string($refRaw) ? trim($refRaw) : '';
        $request->merge([
            'reference_number' => $trimmedRef === '' ? null : $trimmedRef,
        ]);

        $validated = $request->validate([
            'billing_id' => ['required', 'integer'],
            'amount_paid' => ['required', 'numeric'],
            'payment_date' => ['required', 'date'],
            'payment_method' => ['sometimes', 'in:cash,gcash,bank_transfer,other'],
            'reference_number' => [
                'nullable',
                'string',
                'max:100',
                Rule::requiredIf(fn () => $request->input('payment_method', 'cash') !== 'cash'),
            ],
            'remarks' => ['nullable', 'string'],
        ]);

        $billing = PaymentService::record($request->user(), $validated);

        return response()->json([
            'message' => 'Payment recorded successfully.',
            'billing' => $billing,
        ], 201);
    }

    /**
     * FR-024..FR-026: Soft void a payment.
     */
    public function destroy(Request $request, Payment $payment): JsonResponse
    {
        if (! AuthorizationService::canManageBilling($request->user())) {
            AuditService::logAccessDenied($request->user(), 'payments.void');

            return response()->json(['message' => 'Unauthorized to void payments.'], 403);
        }

        $reason = $request->input('void_reason');
        PaymentService::void($request->user(), $payment, $reason);

        return response()->json([
            'message' => 'Payment voided successfully.',
        ]);
    }
}
