<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * AuditLog Model
 * 
 * Forensic ledger entry for row-level database mutations and application-layer
 * security events. Entries are predominantly written by DB triggers.
 * 
 * @property int $id
 * @property string $action
 * @property string $target_table
 * @property int $record_id
 * @property array|null $old_value
 * @property array|null $new_value
 * @property int|null $changed_by
 * @property string|null $correlation_id
 * @property \Illuminate\Support\Carbon $changed_at
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
        'target_table',
        'record_id',
        'old_value',
        'new_value',
        'changed_by',
        'correlation_id',
        'changed_at',
    ];

    /**
     * System actions and DB operations.
     */
    const ACTION_INSERT        = 'INSERT';
    const ACTION_UPDATE        = 'UPDATE';
    const ACTION_DELETE        = 'DELETE';
    const ACTION_LOGIN         = 'login';
    const ACTION_LOGOUT        = 'logout';
    const ACTION_ACCESS_DENIED = 'access_denied';
    const ACTION_STATUS_CHANGE = 'status_change';
    const ACTION_ARCHIVE       = 'archive';
    const ACTION_RESTORE       = 'restore';

    protected function casts(): array
    {
        return [
            'old_value'  => 'array',
            'new_value'  => 'array',
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
}
