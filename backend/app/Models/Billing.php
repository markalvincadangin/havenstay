<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'contract_id',
    'billing_period_from',
    'billing_period_to',
    'due_date',
    'status',
])]
class Billing extends Model
{
    use HasFactory;

    protected $table = 'billing';

    protected $primaryKey = 'billing_id';

    const STATUS_UNPAID = 'unpaid';

    const STATUS_PARTIAL = 'partial';

    const STATUS_PAID = 'paid';

    const STATUS_OVERDUE = 'overdue';

    protected function casts(): array
    {
        return [
            'billing_period_from' => 'date',
            'billing_period_to' => 'date',
            'due_date' => 'date',
            'status' => 'string',
        ];
    }

    protected $appends = [
        'total_amount',
        'total_paid',
        'balance',
    ];

    public function contract(): BelongsTo
    {
        return $this->belongsTo(Contract::class, 'contract_id', 'contract_id');
    }

    public function lineItems(): HasMany
    {
        return $this->hasMany(BillingLineItem::class, 'billing_id', 'billing_id');
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class, 'billing_id', 'billing_id');
    }

    /**
     * Accessor: Dynamically sum the total from line items.
     */
    public function getTotalAmountAttribute(): float
    {
        return (float) $this->lineItems()->sum('amount');
    }

    /**
     * Accessor: Dynamically sum the total from payments.
     * Only counts non-voided payments (voided_at IS NULL).
     */
    public function getTotalPaidAttribute(): float
    {
        return (float) $this->payments()->whereNull('voided_at')->sum('amount_paid');
    }

    /**
     * Accessor: Balance remaining.
     */
    public function getBalanceAttribute(): float
    {
        return $this->total_amount - $this->total_paid;
    }
}
