<?php
 
 namespace App\Http\Requests\Tenant;
 
 use App\Services\Core\AuthorizationService;
 use Illuminate\Foundation\Http\FormRequest;
 use Illuminate\Validation\Rule;
 
 /**
  * StoreTenantRequest
  * 
  * Validates data for creating a new tenant profile.
  * Optimized for HavenStay Forensic v5.0.
  */
 class StoreTenantRequest extends FormRequest
 {
     /**
      * Authorized: Admin, Staff.
      */
     public function authorize(): bool
     {
         AuthorizationService::ensureCanManageTenants($this->user());
         return true;
     }
 
     /**
      * Validation rules for tenant creation.
      * 
      * Ref: BR-TEN-002, BR-GEN-003
      */
     public function rules(): array
     {
         return [
             'first_name' => ['required', 'string', 'max:100'],
             'last_name' => ['required', 'string', 'max:100'],
             'contact_number' => ['required', 'string', 'max:20', 'regex:/^(09\d{9}|(\+639)\d{9})$/'],
             
             // BR-TEN-002: Email must be unique.
             // BR-GEN-003: Uniqueness only enforced among non-deleted records.
             'email' => [
                 'required', 
                 'email', 
                 'max:150', 
                 Rule::unique('tenants')->whereNull('deleted_at')
             ],
             
             'emergency_contact_name' => ['required', 'string', 'max:200'],
             'emergency_contact_number' => ['required', 'string', 'max:20', 'regex:/^(09\d{9}|(\+639)\d{9})$/'],
             'address' => ['required', 'string'],
         ];
     }
 }
