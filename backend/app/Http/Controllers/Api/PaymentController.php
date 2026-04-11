<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Services\AuditService;
use App\Services\AuthorizationService;
use App\Services\PaymentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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

        $payments = PaymentService::listHistory($request->only(['tenant_id', 'contract_id', 'billing_id']));

        return response()->json($payments);
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

        $validated = $request->validate([
            'billing_id' => ['required', 'integer'],
            'amount_paid' => ['required', 'numeric'],
            'payment_date' => ['required', 'date'],
            'payment_method' => ['sometimes', 'in:cash,gcash,bank_transfer,other'],
            'reference_number' => ['nullable', 'string', 'max:100'],
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

        PaymentService::void($request->user(), $payment);

        return response()->json([
            'message' => 'Payment voided successfully.',
        ]);
    }
}
