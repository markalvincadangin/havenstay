<?php
 
 namespace App\Http\Requests\Contract;
 
 use App\Enums\ContractType;
 use App\Services\Core\AuthorizationService;
 use Illuminate\Foundation\Http\FormRequest;
 use Illuminate\Validation\Rule;
 
 /**
  * StoreContractRequest
  *
  * Validates data for creating a new tenant lease/contract.
  * Optimized for HavenStay Forensic v5.0.
  */
 class StoreContractRequest extends FormRequest
 {
     /**
      * Authorized: Admin, Staff.
      */
     public function authorize(): bool
     {
         AuthorizationService::ensureCanManageContracts($this->user());
         return true;
     }
 
     /**
      * Validation rules for contract creation.
      *
      * Ref: BR-CON-001, BR-CON-003, BR-CON-004
      */
     public function rules(): array
     {
         $isFixedTerm = $this->input('contract_type') === ContractType::FIXED_TERM->value;

         return [
             'tenant_id'    => ['required', 'integer', 'exists:tenants,tenant_id'],
             'room_id'      => ['nullable', 'integer', 'exists:rooms,room_id'],
             'bed_space_id' => ['nullable', 'integer', 'exists:bed_spaces,bed_space_id'],

             // BR-CON-004: contract_type must be one of the valid enum values.
             'contract_type' => ['required', Rule::enum(ContractType::class)],

             // BR-CON-003: Move-in date must be today or in the future.
             'move_in_date' => ['required', 'date', 'after_or_equal:today'],

             // BR-CON-004: expected_move_out is REQUIRED for fixed_term, OPTIONAL for month_to_month.
             'expected_move_out' => $isFixedTerm
                 ? ['required', 'date', 'after:move_in_date']
                 : ['nullable', 'date', 'after:move_in_date'],

             'deposit_amount'        => ['nullable', 'numeric', 'min:0'],
             'monthly_rate_override' => ['nullable', 'numeric', 'min:0'],
             'monthly_rate'          => ['nullable', 'numeric', 'min:0'],
             'initialize_billing'    => ['nullable', 'boolean'],
             'notes'                 => ['nullable', 'string'],
         ];
     }

     /**
      * Human-readable validation error messages.
      */
     public function messages(): array
     {
         return [
             'contract_type.required' => 'Agreement type is required.',
             'contract_type.enum'     => 'Invalid agreement type. Must be fixed_term or month_to_month.',
             'expected_move_out.required' => 'Expected move-out date is required for fixed-term contracts (BR-CON-004).',
             'expected_move_out.after'    => 'Expected move-out date must be after the move-in date.',
         ];
     }
 }
