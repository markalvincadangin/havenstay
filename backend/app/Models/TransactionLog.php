<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * TransactionLog Model
 * 
 * Workflow-level log for multi-step database transactions. Tracks the lifecycle
 * of an operation (started, committed, rolled_back) for forensic reconciliation.
 * 
 * @property int $id
 * @property string $txn_reference
 * @property string $action
 * @property string $status
 * @property int|null $initiated_by
 * @property array|null $details
 * @property string|null $error_message
 * @property string|null $correlation_id
 * @property \Illuminate\Support\Carbon $created_at
 */
class TransactionLog extends Model
{
    protected $table = 'transaction_logs';

    protected $primaryKey = 'id';

    /**
     * Transaction logs are append-only.
     */
    public $timestamps = false;

    const STATUS_STARTED     = 'started';
    const STATUS_COMMITTED   = 'committed';
    const STATUS_ROLLED_BACK = 'rolled_back';
    const STATUS_FAILED      = 'failed';

    protected $fillable = [
        'txn_reference',
        'action',
        'status',
        'initiated_by',
        'details',
        'error_message',
        'correlation_id',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'details'    => 'array',
            'created_at' => 'datetime',
        ];
    }

    /**
     * Staff member who initiated the transaction workflow.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'initiated_by', 'user_id');
    }
}
