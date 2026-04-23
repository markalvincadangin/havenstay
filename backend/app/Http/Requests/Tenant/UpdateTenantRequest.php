<?php
 
 namespace App\Http\Requests\Tenant;
 
 use App\Services\Core\AuthorizationService;
 use Illuminate\Foundation\Http\FormRequest;
 use Illuminate\Validation\Rule;
 use App\Enums\TenantStatus;
 
 /**
  * UpdateTenantRequest
  * 
  * Validates data for updating an existing tenant profile.
  * Optimized for HavenStay Forensic v5.0.
  */
 class UpdateTenantRequest extends FormRequest
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
      * Validation rules for tenant updates.
      * 
      * Ref: BR-TEN-002, BR-GEN-003
      */
     public function rules(): array
     {
         $tenantId = $this->route('tenant')?->tenant_id ?? $this->route('id');
 
         return [
             'first_name' => ['required', 'string', 'max:100'],
             'last_name' => ['required', 'string', 'max:100'],
             'contact_number' => ['required', 'string', 'max:20'],
             
             // BR-TEN-002: Email must be unique.
             // BR-GEN-003: Uniqueness only enforced among non-deleted records.
             'email' => [
                 'required', 
                 'email', 
                 'max:150', 
                 Rule::unique('tenants')
                     ->ignore($tenantId, 'tenant_id')
                     ->whereNull('deleted_at')
             ],
             
             'emergency_contact_name' => ['required', 'string', 'max:200'],
             'emergency_contact_number' => ['required', 'string', 'max:20'],
             'address' => ['required', 'string'],
             'status' => ['sometimes', Rule::enum(TenantStatus::class)],
         ];
     }
 }
