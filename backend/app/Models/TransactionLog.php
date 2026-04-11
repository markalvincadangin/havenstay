<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TransactionLog extends Model
{
    protected $table = 'transaction_logs';

    protected $primaryKey = 'tx_log_id';

    public $timestamps = false;

    protected $fillable = [
        'tx_name',
        'started_at',
        'completed_at',
        'status',
        'initiated_by',
        'reference_entity',
        'reference_id',
        'details_json',
    ];

    /**
     * The user who initiated the transaction.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'initiated_by', 'user_id');
    }
}
