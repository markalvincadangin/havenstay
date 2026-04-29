<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * BillingResource
 *
 * API transformer for billing cycle records.
 * Optimized for HavenStay Forensic v5.0.
 */
class BillingResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'billing_id' => $this->billing_id,
            'contract_id' => $this->contract_id,
            'billing_period_from' => $this->billing_period_from,
            'billing_period_to' => $this->billing_period_to,
            'due_date' => $this->due_date,
            'status' => $this->status,

            // Forensic Rule: Use pre-computed sums or explicit relations.
            // Resources must not execute direct database sum() queries.
            'total_amount' => (float) ($this->total_amount ?? 0),
            'total_paid' => (float) ($this->total_paid ?? 0),
            'balance' => (float) (($this->total_amount ?? 0) - ($this->total_paid ?? 0)),
            'created_at' => $this->created_at,

            // Relationships
            'contract' => new ContractResource($this->whenLoaded('contract')),
            'line_items' => BillingLineItemResource::collection($this->whenLoaded('lineItems')),
            'payments' => PaymentResource::collection($this->whenLoaded('payments')),
        ];
    }
}
