<?php
 
 namespace App\Http\Resources;
 
 use Illuminate\Http\Request;
 use Illuminate\Http\Resources\Json\JsonResource;
 
 /**
  * UtilityResource
  * 
  * API transformer for utility types (Electricity, Water).
  * Optimized for HavenStay Forensic v5.0.
  */
 class UtilityResource extends JsonResource
 {
     /**
      * Transform the resource into an array.
      *
      * @return array<string, mixed>
      */
     public function toArray(Request $request): array
     {
         return [
             'utility_id' => $this->utility_id,
             'name' => $this->name,
             'unit_of_measurement' => $this->unit_of_measurement,
             
             // Relationships
             'rates' => UtilityRateResource::collection($this->whenLoaded('rates')),
             'active_rate' => new UtilityRateResource($this->whenLoaded('rates', function () {
                 return $this->active_rate;
             })),
             'meters' => $this->whenLoaded('meters'),
         ];
     }
 }
