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
 use Illuminate\Http\Request;
 
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
 
         return $this->paginated($paginator, [], 'Payment history retrieved successfully.');
     }
 
     /**
      * FR-042a: Retrieve detailed payment forensic trace.
      */
     public function show(ManagePaymentRequest $request, Payment $payment): JsonResponse
     {
         $loadedPayment = PaymentService::getById((int) $payment->payment_id);
         if (!$loadedPayment) {
             return $this->error('Payment not found.', 404);
         }
 
         return $this->success('Payment retrieved successfully.', new PaymentResource($loadedPayment));
     }
 
     /**
      * FR-041: Record a new payment (Atomic XOR targeting).
      */
     public function store(StorePaymentRequest $request): JsonResponse
     {
         $payment = PaymentService::record($request->user(), $request->validated());
 
         return $this->created('Payment recorded successfully.', new PaymentResource($payment));
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
