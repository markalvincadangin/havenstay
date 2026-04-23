<?php
 
 namespace App\Http\Requests\Contract;
 
 use App\Services\Core\AuthorizationService;
 use Illuminate\Foundation\Http\FormRequest;
 
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
      * Ref: BR-CON-001, BR-CON-003
      */
     public function rules(): array
     {
         return [
             'tenant_id' => ['required', 'integer', 'exists:tenants,tenant_id'],
             'room_id' => ['nullable', 'integer', 'exists:rooms,room_id'],
             'bed_space_id' => ['nullable', 'integer', 'exists:bed_spaces,bed_space_id'],
             
             // BR-CON-003: Move-in date must be today or future.
             'move_in_date' => ['required', 'date', 'after_or_equal:today'],
             
             'expected_move_out' => ['nullable', 'date', 'after:move_in_date'],
             'deposit_amount' => ['nullable', 'numeric', 'min:0'],
             'monthly_rate_override' => ['nullable', 'numeric', 'min:0'],
             'monthly_rate' => ['nullable', 'numeric', 'min:0'],
             'initialize_billing' => ['nullable', 'boolean'],
             'notes' => ['nullable', 'string'],
         ];
     }
 }
