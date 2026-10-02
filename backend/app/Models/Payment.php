<?php

namespace App\Models;

use App\Enums\PaymentCategory;
use App\Enums\PaymentMethod;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Payment Model
 *
 * @property int $payment_id
 * @property int|null $billing_id
 * @property int|null $contract_id
 * @property PaymentCategory $payment_category
 * @property float $amount_paid
 * @property Carbon $payment_date
 * @property PaymentMethod $payment_method
 * @property string|null $reference_number
 * @property int $processed_by
 * @property Carbon|null $voided_at
 * @property int|null $voided_by
 * @property string|null $void_reason
 * @property string|null $remarks
 */
class Payment extends Model
{
    use HasFactory;

    protected $table = 'payments';

    protected $primaryKey = 'payment_id';

    protected $fillable = [
        'billing_id',
        'contract_id',
        'payment_category',
        'amount_paid',
        'payment_date',
        'payment_method',
        'reference_number',
        'remarks',
        'processed_by',
        'voided_at',
        'voided_by',
        'void_reason',
        'idempotency_key',
    ];

    /**
     * Payments are immutable financial records — once posted they are never
     * updated in place, only voided via the voided_at timestamp.
     */
    const UPDATED_AT = null;

    protected function casts(): array
    {
        return [
            'amount_paid' => 'decimal:2',
            'payment_date' => 'date',
            'payment_method' => PaymentMethod::class,
            'payment_category' => PaymentCategory::class,
            'voided_at' => 'datetime',
        ];
    }

    public function billing(): BelongsTo
    {
        return $this->belongsTo(Billing::class, 'billing_id', 'billing_id');
    }

    public function contract(): BelongsTo
    {
        return $this->belongsTo(Contract::class, 'contract_id', 'contract_id')->withTrashed();
    }

    public function processor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'processed_by', 'user_id');
    }

    public function voider(): BelongsTo
    {
        return $this->belongsTo(User::class, 'voided_by', 'user_id');
    }

    public function isVoided(): bool
    {
        return ! is_null($this->voided_at);
    }

    /**
     * Scope: Resolve tenant name context whether linked to bill or contract.
     */
    public function scopeWithTenantContext(Builder $query): Builder
    {
        return $query->addSelect([
            'tenant_name' => Tenant::select(DB::raw('CONCAT(last_name, ", ", first_name)'))
                ->join('contracts', 'tenants.tenant_id', '=', 'contracts.tenant_id')
                ->where(function($q) {
                    $q->whereColumn('contracts.contract_id', 'payments.contract_id')
                      ->orWhereColumn('contracts.contract_id', function($sub) {
                          $sub->select('contract_id')->from('billing')->whereColumn('billing.billing_id', 'payments.billing_id');
                      });
                })
                ->limit(1)
        ]);
    }
}
