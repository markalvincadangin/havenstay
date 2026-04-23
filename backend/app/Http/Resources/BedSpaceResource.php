<?php
 
 namespace App\Http\Resources;
 
 use Illuminate\Http\Request;
 use Illuminate\Http\Resources\Json\JsonResource;
 
 /**
  * BedSpaceResource
  * 
  * API transformer for BedSpace entities.
  * Optimized for HavenStay Forensic v5.0.
  */
 class BedSpaceResource extends JsonResource
 {
     /**
      * Transform the resource into an array.
      *
      * @return array<string, mixed>
      */
     public function toArray(Request $request): array
     {
         return [
             'bed_space_id' => $this->bed_space_id,
             'room_id' => $this->room_id,
             'bed_label' => $this->bed_label,
             'status' => $this->status,
             
             // Relationships
             'room' => new RoomResource($this->whenLoaded('room')),
         ];
     }
 }
