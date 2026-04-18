<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Payment\StorePaymentRequest;
use App\Http\Requests\Payment\VoidPaymentRequest;
use App\Models\Payment;
use App\Services\Identity\AuthorizationService;
use App\Services\Operations\PaymentService;
use App\Services\Analytics\PiiMaskingService;
use App\Support\Pagination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PaymentController extends Controller
{

    /**
     */
    public function index(Request $request): JsonResponse
    {
        AuthorizationService::ensureCanViewBilling($request->user());

        $validated = $request->validate(array_merge([
            'tenant_id' => ['nullable', 'integer'],
            'contract_id' => ['nullable', 'integer'],
            'billing_id' => ['nullable', 'integer'],
            'q' => ['nullable', 'string', 'max:200'],
            'payment_from' => ['nullable', 'date'],
            'payment_to' => ['nullable', 'date'],
            'posting_status' => ['nullable', 'string', 'in:posted,voided'],
        ], Pagination::queryRules()));

        $pageParams = Pagination::normalizePageParams($validated);

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

        return Pagination::fromPaginator($paginator);
    }

    /**
     */
    public function show(Request $request, Payment $payment): JsonResponse
    {
        AuthorizationService::ensureCanViewBilling($request->user());

        $loadedPayment = PaymentService::getById((int) $payment->payment_id);
        if (! $loadedPayment) {
            return response()->json(['message' => 'Payment not found.'], 404);
        }

        $payload = PiiMaskingService::maskPaymentNestedTenant($request->user(), $loadedPayment->toArray());

        return response()->json([
            'message' => 'Payment retrieved successfully.',
            'data' => $payload,
        ]);
    }

    /**
     */
    public function store(StorePaymentRequest $request): JsonResponse
    {
        AuthorizationService::ensureCanManagePayments($request->user());

        $validated = $request->validated();

        $billing = PaymentService::record($request->user(), $validated);

        return response()->json([
            'message' => 'Payment recorded successfully.',
            'data' => $billing,
        ], 201);
    }

    /**
     */
    public function destroy(VoidPaymentRequest $request, Payment $payment): JsonResponse
    {
        AuthorizationService::ensureCanManagePayments($request->user());

        $reason = $request->validated()['void_reason'] ?? null;
        PaymentService::void($request->user(), $payment, $reason);

        return response()->json([
            'message' => 'Payment voided successfully.',
            'data' => null,
        ]);
    }
}
