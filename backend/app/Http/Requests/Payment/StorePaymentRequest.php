<?php
 
 namespace App\Http\Requests\Payment;
 
 use App\Services\Core\AuthorizationService;
 use Illuminate\Foundation\Http\FormRequest;
 use Illuminate\Validation\Rule;
 use App\Enums\PaymentMethod;
 use App\Enums\PaymentCategory;
 
 /**
  * StorePaymentRequest
  * 
  * Validates data for recording a new payment.
  * Optimized for HavenStay Forensic v5.0.
  */
 class StorePaymentRequest extends FormRequest
 {
     public function authorize(): bool
     {
         AuthorizationService::ensureCanManagePayments($this->user());
         return true;
     }
 
     protected function prepareForValidation(): void
     {
         $reference = $this->input('reference_number');
         $trimmed = is_string($reference) ? trim($reference) : '';
 
         $this->merge([
             'reference_number' => $trimmed === '' ? null : $trimmed,
         ]);
     }
 
     /**
      * Ref: BR-PAY-003, BR-PAY-010
      */
     public function rules(): array
     {
         return [
             'billing_id' => ['nullable', 'integer', 'exists:billing,billing_id'],
             'contract_id' => ['nullable', 'integer', 'exists:contracts,contract_id'],
             
             // Mandatory Category Enum
             'payment_category' => ['required', Rule::enum(PaymentCategory::class)],
             
             'amount_paid' => ['required', 'numeric', 'min:0.01'],
             
             // BR-PAY-003: Payment date cannot be in the future.
             'payment_date' => ['required', 'date', 'before_or_equal:today'],
             
             'payment_method' => ['sometimes', Rule::enum(PaymentMethod::class)],
             'reference_number' => [
                 'nullable',
                 'string',
                 'max:100',
                 Rule::requiredIf(fn () => $this->input('payment_method', 'cash') !== 'cash' && $this->input('payment_method') !== null),
             ],
             'remarks' => ['nullable', 'string'],
         ];
     }
 }
