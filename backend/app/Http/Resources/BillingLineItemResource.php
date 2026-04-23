<?php
 
 namespace App\Http\Resources;
 
 use Illuminate\Http\Request;
 use Illuminate\Http\Resources\Json\JsonResource;
 
 /**
  * BillingLineItemResource
  * 
  * API transformer for individual billing charges.
  * Optimized for HavenStay Forensic v5.0.
  */
 class BillingLineItemResource extends JsonResource
 {
     /**
      * Transform the resource into an array.
      *
      * @return array<string, mixed>
      */
     public function toArray(Request $request): array
     {
         return [
             'line_item_id' => $this->line_item_id,
             'billing_id' => $this->billing_id,
             'utility_id' => $this->utility_id,
             'reading_id' => $this->reading_id,
             'item_type' => $this->item_type,
             'item_description' => $this->item_description,
             'amount' => (float) $this->amount,
             
             // Relationships - Forensic v5.0: Mandatory Resource Wrapping
             'utility' => new UtilityResource($this->whenLoaded('utility')),
             'reading' => new MeterReadingResource($this->whenLoaded('reading')),
         ];
     }
 }
