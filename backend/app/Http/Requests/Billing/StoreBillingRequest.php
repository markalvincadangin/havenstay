<?php
 
 namespace App\Http\Requests\Billing;
 
 use App\Services\Core\AuthorizationService;
 use Illuminate\Foundation\Http\FormRequest;
 use Illuminate\Validation\Rule;
 use App\Enums\LineItemType;
 
 /**
  * StoreBillingRequest
  * 
  * Validates data for creating a new billing entry.
  * Optimized for HavenStay Forensic v5.0.
  */
 class StoreBillingRequest extends FormRequest
 {
     public function authorize(): bool
     {
         AuthorizationService::ensureCanManageBilling($this->user());
         return true;
     }
 
     /**
      * Ref: BR-BIL-005
      */
     public function rules(): array
     {
         return [
             'contract_id' => ['required', 'integer', 'exists:contracts,contract_id'],
             'billing_period_from' => ['required', 'date'],
             'billing_period_to' => ['required', 'date', 'after_or_equal:billing_period_from'],
             
             // BR-BIL-005: Due date must be after the billing period end date.
             'due_date' => ['required', 'date', 'after:billing_period_to'],
             
             'line_items' => ['nullable', 'array'],
             'line_items.*.item_type' => ['nullable', Rule::enum(LineItemType::class)],
             'line_items.*.description' => ['required', 'string', 'max:255'],
             'line_items.*.amount' => [
                 'required',
                 'numeric',
                 function ($attribute, $value, $fail) {
                     if ($value < 0 && $this->input(str_replace('.amount', '.item_type', $attribute)) !== LineItemType::ADJUSTMENT->value) {
                         $fail('Only adjustment line items can have negative amounts.');
                     }
                 }
             ],
             'reading_ids' => ['nullable', 'array'],
             'reading_ids.*' => ['integer', 'exists:meter_readings,reading_id'],
         ];
     }
 
     public function withValidator($validator)
     {
         $validator->after(function ($validator) {
             $items = $this->input('line_items', []);
             if (!is_array($items)) return;
             
             $sum = 0;
             foreach ($items as $item) {
                 $sum += (float)($item['amount'] ?? 0);
             }
             
             if ($sum < 0) {
                 $errorKey = 'line_items.' . (count($items) - 1) . '.amount';
                 $validator->errors()->add($errorKey, 'The aggregate sum of manual line items cannot be negative.');
             }
         });
     }
 }
