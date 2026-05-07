<?php

namespace App\Models;

use App\Enums\BillingStatus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Billing Model
 *
 * Monthly billing cycle header. Connects contracts to itemized line items
 * and payment transactions.
 *
 * @property int $billing_id
 * @property int $contract_id
 * @property Carbon $billing_period_from
 * @property Carbon $billing_period_to
 * @property Carbon $due_date
 * @property BillingStatus $status
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
        'idempotency_key',
    ];

    protected function casts(): array
    {
        return [
            'billing_period_from' => 'date',
            'billing_period_to' => 'date',
            'due_date' => 'date',
            'status' => BillingStatus::class,
        ];
    }

    /**
     * Parent contract this billing entry was generated for.
     */
    public function contract(): BelongsTo
    {
        return $this->belongsTo(Contract::class, 'contract_id', 'contract_id')->withTrashed();
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
     * Scope: Enrich query with financial totals using subqueries.
     * This is the industry-standard way to handle aggregates without GROUP BY issues.
     */
    public function scopeWithFinancials(Builder $query): Builder
    {
        return $query->withSum([
            'lineItems as total_amount' => function ($q) {
                $q->select(DB::raw('COALESCE(SUM(amount), 0)'));
            },
        ], 'amount')
        ->withSum([
            'payments as total_paid' => function ($q) {
                $q->select(DB::raw('COALESCE(SUM(amount_paid), 0)'))->whereNull('voided_at');
            },
        ], 'amount_paid');
    }
}
