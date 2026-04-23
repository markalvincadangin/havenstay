<?php
 
 namespace App\Http\Resources;
 
 use Illuminate\Http\Request;
 use Illuminate\Http\Resources\Json\JsonResource;
 
 /**
  * RoleResource
  * 
  * API transformer for system RBAC roles.
  * Optimized for HavenStay Forensic v5.0.
  */
 class RoleResource extends JsonResource
 {
     /**
      * Transform the resource into an array.
      *
      * @return array<string, mixed>
      */
     public function toArray(Request $request): array
     {
         return [
             'role_id' => $this->role_id,
             'role_name' => $this->role_name,
             'description' => $this->description,
         ];
     }
 }
