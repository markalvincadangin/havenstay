<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Billing Model
 * 
 * Monthly billing cycle header. Connects contracts to itemized line items 
 * and payment transactions.
 * 
 * @property int $billing_id
 * @property int $contract_id
 * @property \Illuminate\Support\Carbon $billing_period_from
 * @property \Illuminate\Support\Carbon $billing_period_to
 * @property \Illuminate\Support\Carbon $due_date
 * @property string $status
 * @property-read float $total_amount
 * @property-read float $total_paid
 * @property-read float $balance
 */
class Billing extends Model
{
    use HasFactory;

    protected $table = 'billing';

    protected $primaryKey = 'billing_id';

    protected $fillable = [
        'contract_id',
        'billing_period_from',
        'billing_period_to',
        'due_date',
        'status',
    ];

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

    /**
     * Parent contract this billing entry was generated for.
     */
    public function contract(): BelongsTo
    {
        return $this->belongsTo(Contract::class, 'contract_id', 'contract_id');
    }

    /**
     * Itemized charges within this billing cycle.
     */
    public function lineItems(): HasMany
    {
        return $this->hasMany(BillingLineItem::class, 'billing_id', 'billing_id');
    }

    /**
     * All payment transactions posted against this billing cycle.
     */
    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class, 'billing_id', 'billing_id');
    }

    /**
     * Dynamically computes the total from line items via a new DB query.
     *
     * N+1 WARNING: Do not call in list/paginated contexts.
     * Use BillingService::listQueryWithSums() which pre-loads via withSum().
     * Only use this accessor for single-record detail views.
     *
     * @see SDD §4.3 "Derived Financial Totals"
     */
    public function getTotalAmountAttribute(): float
    {
        return (float) $this->lineItems()->sum('amount');
    }

    /**
     * Dynamically computes the total from non-voided payments via a new DB query.
     *
     * N+1 WARNING: Do not call in list/paginated contexts.
     * Use BillingService::listQueryWithSums() which pre-loads via withSum().
     * Only use this accessor for single-record detail views.
     *
     * @see SDD §4.3 "Derived Financial Totals" · schema: voided_at IS NULL filter
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
