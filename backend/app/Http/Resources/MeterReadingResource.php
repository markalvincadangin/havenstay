<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * MeterReadingResource
 *
 * API transformer for meter readings.
 * Optimized for HavenStay Forensic v5.0.
 */
class MeterReadingResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'reading_id' => $this->reading_id,
            'meter_id' => $this->meter_id,
            'recorded_by' => $this->recorded_by,
            'reading_value' => (float) $this->reading_value,
            'reading_date' => $this->reading_date,
            'is_rollover' => (bool) $this->is_rollover,
            'created_at' => $this->created_at,

            // Relationships
            'meter' => new MeterResource($this->whenLoaded('meter')),
            'recorder' => new UserResource($this->whenLoaded('recorder')),
            'billing' => $this->billing ? [
                'billing_id' => $this->billing->billing_id,
                'period' => $this->billing->billing_period_from.' to '.$this->billing->billing_period_to,
            ] : null,
        ];
    }
}
