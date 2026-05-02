<?php

namespace App\Http\Resources;

use App\Services\Analytics\PiiMaskingService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

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

            // Computed/Join fields
            'room_code' => $this->room_code,
            'bed_label' => $this->bed_label,
            'outstanding_balance' => (float) $this->outstanding_balance,
        ];

        // Forensic v5.0: Relocate PII masking logic into the Resource layer
        if (PiiMaskingService::shouldMaskTenantPii($request->user())) {
            $data = PiiMaskingService::maskTenantArray($data);
        }

        return $data;
    }
}
