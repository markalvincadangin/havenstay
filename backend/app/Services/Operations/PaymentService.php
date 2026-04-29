<?php
 
 namespace App\Services\Operations;
 
 use App\Services\Concerns\ManagesWorkflows;
 use App\Models\Billing;
 use App\Models\Contract;
 use App\Models\Payment;
 use App\Models\User;
 use App\Enums\ContractStatus;
 use App\Support\Financials;
 use Illuminate\Database\Eloquent\Builder;
 use Illuminate\Validation\ValidationException;
 
 /**
  * Handles the recording, validation, and voiding of financial transactions.
  * Supports targeting either a specific billing cycle or a contract (for deposits).
  */
 class PaymentService
 {
     use ManagesWorkflows;
 
     /**
      * Retrieve a payment by ID with full relationship context.
      * 
      * @param int $paymentId
      * @return Payment|null
      */
     public static function getById(int $paymentId): ?Payment
     {
         return Payment::with(['billing.contract.tenant', 'billing.contract.room', 'billing.contract.bedSpace', 'contract.tenant', 'contract.room', 'contract.bedSpace', 'processor'])->find($paymentId);
     }
 
     /**
      * Record a new payment.
      * 
      * Implementation details:
      * - Ensures payment targets either a billing_id OR contract_id.
      * - Triggers contract activation if the total paid (Rent + Deposit) meets requirements.
      * 
      * @param User $actor The staff member recording the payment.
      * @param array $data Input details (amount, category, method, targets).
      * @return Payment
      * @throws ValidationException
      */
     public static function record(User $actor, array $data): Payment
     {
         $category = $data['payment_category'] ?? 'billing';
         $billingId = $data['billing_id'] ?? null;
         $contractId = $data['contract_id'] ?? null;
         $amount = round((float)($data['amount_paid'] ?? 0), 2);
         $method = $data['payment_method'] ?? 'cash';
 
         // Validation
         if ($billingId && $contractId) {
             throw ValidationException::withMessages(['billing_id' => ['Payment cannot target both a bill and a contract directly.']]);
         }
         if (!$billingId && !$contractId) {
             throw ValidationException::withMessages(['billing_id' => ['Target (billing or contract) is required.']]);
         }
 
         return self::runWriteWorkflow(
             actorId: $actor->user_id,
             action: 'POST_PAYMENT',
             payload: [
                 'billing_id' => $billingId, 
                 'contract_id' => $contractId, 
                 'category' => $category,
                 'amount_fact' => $amount,
                 'method_fact' => $method,
             ],
             operation: function () use ($actor, $data, $category, $billingId, $contractId, $amount, $method): Payment {
                 
                 // If targeting a bill, resolve the contract context for the payment record
                 if ($billingId) {
                     $billing = Billing::findOrFail($billingId);
                     $contractId = $billing->contract_id;
                 }
 
                 $payment = Payment::create([
                     'billing_id' => $billingId,
                     'contract_id' => $billingId ? null : $contractId,
                     'payment_category' => $category,
                     'processed_by' => $actor->user_id,
                     'amount_paid' => $amount,
                     'payment_date' => $data['payment_date'],
                     'payment_method' => $method,
                     'reference_number' => $data['reference_number'] ?? null,
                     'remarks' => $data['remarks'] ?? null,
                     'idempotency_key' => $data['idempotency_key'] ?? null,
                 ]);
 
                 // 1. Reconcile Billing Status if applicable
                 if ($billingId) {
                     $billing = Billing::find($billingId);
                     BillingService::syncBillingStatus($actor, $billing);
                 }
 
                 // Auto-activate contract if pending_payment and required amount is reached
                 $contract = Contract::find($contractId);
                 if ($contract) {
                     // Set deposit as cleared if this is a refund or rollover
                     if (in_array($category, ['refund', 'rollover'])) {
                         $contract->update(['is_cleared' => true]);
                     }
 
                     if ($contract->status === ContractStatus::PENDING_PAYMENT) {
                         $totalPaid = Financials::getTotalPaid((int) $contract->contract_id);
                         $minRequired = $contract->monthly_rate + $contract->deposit_amount;
                         
                         if ($totalPaid >= ($minRequired - 0.01)) {
                             ContractService::activate($actor, $contract);
                         }
                     }
                 }
 
                 return $payment;
             }
         );
     }
 
     /**
      * Void a payment and reverse financial impacts.
      * 
      * @param User $actor The staff member voiding the payment.
      * @param Payment $payment
      * @param string|null $reason
      * @return Payment
      * @throws ValidationException
      */
     public static function void(User $actor, Payment $payment, ?string $reason = null): Payment
     {
         return self::runWriteWorkflow(
             actorId: $actor->user_id,
             action: 'VOID_PAYMENT',
             payload: [
                 'payment_id' => $payment->payment_id,
                 'void_amount_fact' => $payment->amount_paid,
                 'reason_fact' => $reason ?: 'N/A'
             ],
             operation: function () use ($actor, $payment, $reason): Payment {
                 if ($payment->voided_at !== null) {
                     throw ValidationException::withMessages(['payment_id' => ['Payment is already voided.']]);
                 }
 
                 $payment->update([
                     'voided_at' => now(),
                     'voided_by' => $actor->user_id,
                     'void_reason' => $reason ?: 'User requested void',
                 ]);
 
                 // Re-sync billing if was linked to one
                 if ($payment->billing_id) {
                     BillingService::syncBillingStatus($actor, $payment->billing);
                 }
 
                 return $payment->fresh();
             }
         );
     }
 
     /**
      * List payments with pagination.
      */
     public static function listPaginated(array $filters = [], int $page = 1, int $perPage = 15)
     {
         return self::listHistoryQuery($filters)->paginate($perPage, ['*'], 'page', $page);
     }
 
     /**
      * List payment history with forensic filters.
      * 
      * @param array $filters
      * @return Builder<\App\Models\Payment>
      */
     public static function listHistoryQuery(array $filters = []): Builder
     {
         $query = Payment::query()
             ->with(['billing.contract.tenant', 'billing.contract.room', 'billing.contract.bedSpace', 'contract.tenant', 'contract.room', 'contract.bedSpace', 'processor'])
             ->orderByDesc('payment_date')
             ->orderByDesc('payment_id');
 
         if (! empty($filters['contract_id'])) {
             $query->where('contract_id', (int) $filters['contract_id']);
         }
 
         if (! empty($filters['billing_id'])) {
             $query->where('billing_id', (int) $filters['billing_id']);
         }
 
         if (! empty($filters['tenant_id'])) {
             $query->whereHas('contract', fn($q) => $q->where('tenant_id', $filters['tenant_id']));
         }
 
         if (! empty($filters['payment_category'])) {
             $query->where('payment_category', $filters['payment_category']);
         }
 
         if (! empty($filters['q'])) {
             $needle = trim($filters['q']);
             $query->where(function ($w) use ($needle): void {
                 $w->where('payment_id', 'like', "%{$needle}%")
                     ->orWhere('reference_number', 'like', "%{$needle}%")
                     ->orWhereHas('contract.tenant', function ($t) use ($needle): void {
                         $t->where('first_name', 'like', "%{$needle}%")
                             ->orWhere('last_name', 'like', "%{$needle}%");
                     });
             });
         }
 
         /** @var Builder $query */
         return $query;
     }
 }
