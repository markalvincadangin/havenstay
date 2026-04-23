<?php
 
 namespace App\Http\Resources;
 
 use Illuminate\Http\Request;
 use Illuminate\Http\Resources\Json\JsonResource;
 use App\Services\Analytics\PiiMaskingService;
 
 class TenantResource extends JsonResource
 {
     /**
      * Transform the resource into an array.
      *
      * @return array<string, mixed>
      */
     public function toArray(Request $request): array
     {
         $data = [
             'tenant_id' => $this->tenant_id,
             'first_name' => $this->first_name,
             'last_name' => $this->last_name,
             'contact_number' => $this->contact_number,
             'email' => $this->email,
             'emergency_contact_name' => $this->emergency_contact_name,
             'emergency_contact_number' => $this->emergency_contact_number,
             'address' => $this->address,
             'status' => $this->status,
             'created_at' => $this->created_at,
             'updated_at' => $this->updated_at,
         ];
 
         // Forensic v5.0: Relocate PII masking logic into the Resource layer
         if (PiiMaskingService::shouldMaskTenantPii($request->user())) {
             $data['contact_number'] = PiiMaskingService::maskPhone($this->contact_number);
             $data['email'] = PiiMaskingService::maskEmail($this->email);
             $data['emergency_contact_name'] = 'Redacted';
             $data['emergency_contact_number'] = '***';
             $data['address'] = 'Redacted';
         }
 
         return $data;
     }
 }
