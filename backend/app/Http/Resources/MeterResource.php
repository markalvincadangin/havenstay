<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * MeterResource
 *
 * API transformer for utility meters.
 * Optimized for HavenStay Forensic v5.0.
 */
class MeterResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'meter_id' => $this->meter_id,
            'utility_id' => $this->utility_id,
            'serial_number' => $this->serial_number,
            'status' => $this->status,
            'created_at' => $this->created_at,

            // Relationships
            'utility' => new UtilityResource($this->whenLoaded('utility')),
            'readings' => MeterReadingResource::collection($this->whenLoaded('readings')),
        ];
    }
}
