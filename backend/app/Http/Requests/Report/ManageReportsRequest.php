<?php
 
 namespace App\Http\Requests\Report;
 
 use App\Services\Core\AuthorizationService;
 use Illuminate\Foundation\Http\FormRequest;
 use App\Support\Pagination;
 
 /**
  * ManageReportsRequest
  * 
  * Standardized gatekeeper for all analytical and reporting endpoints.
  * Optimized for HavenStay Forensic v5.0.
  */
 class ManageReportsRequest extends FormRequest
 {
     /**
      * Authorized: Admin, Staff.
      */
     public function authorize(): bool
     {
         AuthorizationService::ensureCanViewReports($this->user());
         return true;
     }
 
     public function rules(): array
     {
         // Default rules for reporting endpoints (pagination)
         return array_merge([
             'room_type' => ['nullable', 'string', 'in:private,shared'],
             'room_id' => ['nullable', 'integer', 'exists:rooms,room_id'],
             'tenant_id' => ['nullable', 'integer', 'exists:tenants,tenant_id'],
             'start_date' => ['nullable', 'date'],
             'end_date' => ['nullable', 'date'],
             'from' => ['nullable', 'date'],
             'to' => ['nullable', 'date'],
             'due_from' => ['nullable', 'date'],
             'due_to' => ['nullable', 'date'],
             'bed_status' => ['nullable', 'string', 'in:vacant,occupied,maintenance'],
             'status' => ['nullable', 'string'],
             'payment_method' => ['nullable', 'string'],
             'current_month' => ['nullable'],
         ], Pagination::queryRules());
     }
 }
