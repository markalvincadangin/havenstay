<?php
 
 namespace App\Http\Requests\Tenant;
 
 use App\Services\Core\AuthorizationService;
 use Illuminate\Foundation\Http\FormRequest;
 
 /**
  * ManageTenantRequest
  * 
  * Basic gatekeeper for tenant management actions requiring Admin/Staff privileges.
  * Optimized for HavenStay Forensic v5.0.
  */
 class ManageTenantRequest extends FormRequest
 {
     /**
      * Authorized: Admin, Staff.
      */
     public function authorize(): bool
     {
         AuthorizationService::ensureCanManageTenants($this->user());
         return true;
     }
 
     public function rules(): array
     {
         return [];
     }
 }
