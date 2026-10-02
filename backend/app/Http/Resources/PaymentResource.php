<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * PaymentResource
 *
 * API transformer for financial payment records.
 * Optimized for HavenStay Forensic v5.0.
 */
class PaymentResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'payment_id' => $this->payment_id,
            'billing_id' => $this->billing_id,
            'contract_id' => $this->contract_id,
            'payment_category' => $this->payment_category,
            'amount_paid' => (float) $this->amount_paid,
            'payment_date' => $this->payment_date,
            'payment_method' => $this->payment_method,
            'reference_number' => $this->reference_number,
            'remarks' => $this->remarks,
            'notes' => $this->remarks,
            'processed_by' => $this->processed_by,
            'voided_at' => $this->voided_at,
            'voided_by' => $this->voided_by,
            'void_reason' => $this->void_reason,
            'created_at' => $this->created_at,

            // Relationships - Forensic v5.0: Mandatory Resource Wrapping
            'billing' => new BillingResource($this->whenLoaded('billing')),
            'contract' => new ContractResource($this->whenLoaded('contract')),
            'processor' => new UserResource($this->whenLoaded('processor')),
            'voider' => new UserResource($this->whenLoaded('voider')),
        ];
    }
}
