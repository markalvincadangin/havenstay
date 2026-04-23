<?php
 
 namespace App\Http\Requests\Payment;
 
 use App\Services\Core\AuthorizationService;
 use Illuminate\Foundation\Http\FormRequest;
 
 /**
  * Validates request to void an existing payment.
  * Optimized for HavenStay Forensic v5.0.
  */
 class VoidPaymentRequest extends FormRequest
 {
     /**
      * Authorized: Admin, Staff.
      */
     public function authorize(): bool
     {
         AuthorizationService::ensureCanManagePayments($this->user());
         return true;
     }
 
 
     public function rules(): array
     {
         return [
             'void_reason' => ['required', 'string', 'min:5', 'max:255'],
         ];
     }
 }
