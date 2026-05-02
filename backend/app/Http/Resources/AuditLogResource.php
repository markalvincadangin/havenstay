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
            'event_category' => $this->event_category,
            'target_table' => $this->target_table,
            'record_id' => $this->record_id,
            'old_value' => $this->old_value,
            'new_value' => $this->new_value,
            'changed_fields' => $this->changed_fields,
            'is_success' => $this->is_success,
            'error_message' => $this->error_message,
            'changed_by' => $this->changed_by,
            'user' => $this->user ? [
                'user_id' => $this->user->user_id,
                'username' => $this->user->username,
                'first_name' => $this->user->first_name,
                'last_name' => $this->user->last_name,
            ] : null,
            'actor_name' => $this->user ? ($this->user->first_name.' '.$this->user->last_name) : 'SYSTEM',
            'actor_email' => $this->user?->email,
            'actor_snapshot' => $this->actor_snapshot,
            'correlation_id' => $this->correlation_id,
            'request_id' => $this->request_id,
            'ip_address' => $this->ip_address,
            'user_agent' => $this->user_agent,
            'endpoint' => $this->endpoint,
            'http_method' => $this->http_method,
            'metadata' => $this->metadata,
            'changed_at' => $this->changed_at->toDateTimeString(),
        ];
    }
}
