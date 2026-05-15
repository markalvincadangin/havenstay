<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * RoomResource
 *
 * API transformer for Room entities.
 * Optimized for HavenStay Forensic v5.0.
 */
class RoomResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'room_id' => $this->room_id,
            'room_code' => $this->room_code,
            'room_type' => $this->room_type,
            'capacity' => $this->capacity,
            'monthly_rate' => (float) $this->monthly_rate,
            'status' => $this->status,
            'amenities' => $this->amenities,
            'description' => $this->description,
            'is_metered' => (bool) $this->is_metered,
            'active_meters_count' => (int) ($this->active_meters_count ?? 0),
            'meter_serials' => $this->whenLoaded('meterAssignments', function() {
                return $this->meterAssignments
                    ->filter(fn($ma) => is_null($ma->valid_to))
                    ->map(fn($ma) => $ma->meter?->serial_number)
                    ->filter()
                    ->values();
            }),

            // Relationships
            'bed_spaces' => BedSpaceResource::collection($this->whenLoaded('bedSpaces')),
        ];
    }
}
