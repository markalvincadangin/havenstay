<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AuditLog extends Model
{
    protected $table = 'audit_logs';

    protected $primaryKey = 'id';

    public $timestamps = false; // changed_at is handled by DB default

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
     * The attributes that should be cast.
     * Required for forensic JSON serialization.
     */
    protected $casts = [
        'old_value' => 'array',
        'new_value' => 'array',
        'changed_at' => 'datetime',
    ];

    /**
     * The user who performed the action.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'changed_by', 'user_id');
    }
}
