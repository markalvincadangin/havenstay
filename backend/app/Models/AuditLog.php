<?php

namespace App\Models;

use App\Enums\AuditAction;
use App\Enums\EventCategory;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * AuditLog Model
 *
 * Forensic ledger entry for row-level database mutations and application-layer
 * security events. Entries are predominantly written by DB triggers.
 *
 * @property int $id
 * @property AuditAction $action
 * @property string $target_table
 * @property int $record_id
 * @property array|null $old_value
 * @property array|null $new_value
 * @property int|null $changed_by
 * @property string|null $correlation_id
 * @property Carbon $changed_at
 */
class AuditLog extends Model
{
    protected $table = 'audit_logs';

    protected $primaryKey = 'id';

    /**
     * Audit logs are append-only. changed_at is managed by DB defaults.
     */
    public $timestamps = false;

    protected $fillable = [
        'action',
        'event_category',
        'target_table',
        'record_id',
        'old_value',
        'new_value',
        'changed_fields',
        'is_success',
        'error_message',
        'changed_by',
        'actor_snapshot',
        'correlation_id',
        'request_id',
        'ip_address',
        'user_agent',
        'endpoint',
        'http_method',
        'execution_time_ms',
        'metadata',
        'changed_at',
    ];

    /**
     * Defense-in-Depth: Automatically populate forensic context for 
     * application-layer events (manual logs).
     */
    protected static function booted(): void
    {
        static::creating(function (AuditLog $log) {
            $request = request();
            $log->correlation_id ??= $request->attributes->get('correlation_id');
            $log->request_id ??= $request->attributes->get('request_id');
            $log->ip_address ??= $request->ip();
            if (!app()->runningInConsole()) {
                $log->user_agent ??= $request->userAgent();
                $log->endpoint ??= $request->fullUrl();
                $log->http_method ??= $request->method();
            }
            $log->changed_at ??= now();

            // Snapshot the actor for forensic independence (SOC 2 Standard)
            if (auth()->check()) {
                $user = auth()->user();
                $log->actor_snapshot = [
                    'user_id' => $user->user_id,
                    'name' => "{$user->first_name} {$user->last_name}",
                    'role' => $user->role->role_name ?? 'staff',
                ];
                $log->changed_by ??= $user->user_id;
            }

            $log->metadata ??= [
                'origin' => app()->runningInConsole() ? 'cli' : 'web',
            ];
        });
    }

    protected function casts(): array
    {
        return [
            'action' => AuditAction::class,
            'event_category' => EventCategory::class,
            'old_value' => 'array',
            'new_value' => 'array',
            'changed_fields' => 'array',
            'actor_snapshot' => 'array',
            'is_success' => 'boolean',
            'metadata' => 'array',
            'changed_at' => 'datetime',
        ];
    }

    /**
     * Actor profile responsible for the event.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'changed_by', 'user_id');
    }

    /**
     * Forensic Timestamp Normalization:
     * DB triggers operate in UTC (system time), but the administrative UI requires
     * localization to Asia/Manila for operational clarity.
     */
    protected function changedAt(): Attribute
    {
        return Attribute::make(
            get: fn($value) => $value ? Carbon::parse($value, 'UTC')->tz(config('app.timezone')) : null,
        );
    }
}
