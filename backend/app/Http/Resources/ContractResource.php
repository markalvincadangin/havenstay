<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * ContractResource
 *
 * API transformer for lease agreements.
 * Optimized for HavenStay Forensic v5.0.
 */
class ContractResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'contract_id' => $this->contract_id,
            'tenant_id' => $this->tenant_id,
            'bed_space_id' => $this->bed_space_id,
            'created_by' => $this->created_by,
            'contract_type' => $this->contract_type,
            'move_in_date' => $this->move_in_date,
            'expected_move_out_date' => $this->expected_move_out_date,
            'actual_move_out_date' => $this->actual_move_out_date,
            'monthly_rate' => (float) $this->monthly_rate,
            'monthly_rate_override' => $this->monthly_rate_override ? (float) $this->monthly_rate_override : null,
            'deposit_amount' => (float) $this->deposit_amount,
            'is_cleared' => (bool) $this->is_cleared,
            'status' => $this->status,
            'notes' => $this->notes,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,

            // Relationships - Forensic v5.0: Mandatory Resource Wrapping
            'tenant' => new TenantResource($this->whenLoaded('tenant')),
            'room' => new RoomResource($this->whenLoaded('room')),
            'bed_space' => new BedSpaceResource($this->whenLoaded('bedSpace')),
            'creator' => new UserResource($this->whenLoaded('creator')),
            'latest_billing' => new BillingResource($this->whenLoaded('latestBilling')),
        ];
    }
}
