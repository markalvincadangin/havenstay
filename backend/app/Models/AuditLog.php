<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AuditLog extends Model
{
    protected $table = 'audit_logs';

    protected $primaryKey = 'audit_log_id';

    public $timestamps = false; // created_at is handled by DB default

    protected $fillable = [
        'user_id',
        'entity_name',
        'entity_id',
        'action',
        'old_values_json',
        'new_values_json',
        'correlation_id',
    ];

    /**
     * The user who performed the action.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id', 'user_id');
    }
}
