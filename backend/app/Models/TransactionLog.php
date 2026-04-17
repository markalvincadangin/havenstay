<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TransactionLog extends Model
{
    protected $table = 'transaction_logs';

    protected $primaryKey = 'id';

    public $timestamps = false;

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

    /**
     * The attributes that should be cast.
     */
    protected $casts = [
        'details' => 'array',
        'created_at' => 'datetime',
    ];

    /**
     * The user who initiated the transaction.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'initiated_by', 'user_id');
    }
}
