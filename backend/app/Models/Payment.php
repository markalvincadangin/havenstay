<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Payment extends Model
{
    use HasFactory;

    protected $table = 'payments';

    protected $primaryKey = 'payment_id';

    protected $fillable = [
        'billing_id',
        'processed_by',
        'amount_paid',
        'payment_date',
        'payment_method',
        'reference_number',
        'remarks',
        'voided_at',
        'voided_by',
        'void_reason',
    ];

    const METHOD_CASH = 'cash';

    const METHOD_GCASH = 'gcash';

    const METHOD_BANK_TRANSFER = 'bank_transfer';

    const METHOD_OTHER = 'other';

    const UPDATED_AT = null;

    protected function casts(): array
    {
        return [
            'amount_paid' => 'decimal:2',
            'payment_date' => 'date',
            'payment_method' => 'string',
        ];
    }

    public function billing(): BelongsTo
    {
        return $this->belongsTo(Billing::class, 'billing_id', 'billing_id');
    }

    public function processor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'processed_by', 'user_id');
    }
}
