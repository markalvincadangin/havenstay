<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * AuditLogResource
 *
 * Specialized transformer for forensic audit trails.
 * Optimized for HavenStay Forensic v5.0.
 */
class AuditLogResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'action' => $this->action,
            'target_table' => $this->target_table,
            'record_id' => $this->record_id,
            'old_value' => $this->old_value, // JSON blob for Diff Modal
            'new_value' => $this->new_value, // JSON blob for Diff Modal
            'changed_by' => $this->changed_by,
            'actor_name' => $this->user ? ($this->user->first_name.' '.$this->user->last_name) : 'SYSTEM',
            'actor_email' => $this->user?->email,
            'correlation_id' => $this->correlation_id,
            'changed_at' => $this->changed_at->toDateTimeString(),
        ];
    }
}
