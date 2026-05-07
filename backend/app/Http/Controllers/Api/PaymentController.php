<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Payment\IndexPaymentRequest;
use App\Http\Requests\Payment\ManagePaymentRequest;
use App\Http\Requests\Payment\StorePaymentRequest;
use App\Http\Requests\Payment\VoidPaymentRequest;
use App\Http\Resources\PaymentResource;
use App\Models\Payment;
use App\Services\Operations\PaymentService;
use App\Support\Pagination;
use Illuminate\Http\JsonResponse;

/**
 * PaymentController
 *
 * Orchestrates financial transactions, XOR targeting, and void workflows.
 * Optimized for HavenStay Forensic v5.0 with API Resource serialization.
 */
class PaymentController extends Controller
{
    /**
     * FR-042: List payment history with forensic filters.
     */
    public function index(IndexPaymentRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $pageParams = Pagination::normalizePageParams($validated);

        $paginator = PaymentService::listPaginated($validated, $pageParams['page'], $pageParams['per_page']);

        return $this->paginated($paginator, [], 'Payment history retrieved successfully.', PaymentResource::class);
    }

    /**
     * FR-042a: Retrieve detailed payment forensic trace.
     */
    public function show(ManagePaymentRequest $request, Payment $payment): JsonResponse
    {
        $loadedPayment = PaymentService::getById((int) $payment->payment_id);
        if (! $loadedPayment) {
            return $this->error('Payment not found.', 404);
        }

        return $this->success('Payment retrieved successfully.', new PaymentResource($loadedPayment));
    }

    public function store(StorePaymentRequest $request): JsonResponse
    {
        $data = $request->validated();

        // The HandleIdempotency middleware manages the lock and replay.
        // We just pass the key to the service for DB record-keeping.
        $data['idempotency_key'] = $request->header('Idempotency-Key');

        $payment = PaymentService::record($request->user(), $data);

        return $this->created('Payment recorded successfully.', new PaymentResource($payment));
    }

    /**
     * FR-024c: Record a combined (Rent + Deposit) onboarding payment.
     */
    public function storeComposite(\App\Http\Requests\Payment\StoreCompositePaymentRequest $request): JsonResponse
    {
        $data = $request->validated();
        $data['idempotency_key'] = $request->header('Idempotency-Key');

        $results = PaymentService::recordCompositeInitial($request->user(), $data);

        return $this->created('Initial settlement recorded successfully.', [
            'rent' => new PaymentResource($results['rent']),
            'deposit' => new PaymentResource($results['deposit']),
        ]);
    }

    /**
     * FR-043: Void a payment and reverse impacts.
     */
    public function void(VoidPaymentRequest $request, Payment $payment): JsonResponse
    {
        $reason = $request->validated()['void_reason'];
        $voided = PaymentService::void($request->user(), $payment, $reason);

        return $this->success('Payment voided successfully.', new PaymentResource($voided));
    }
}
