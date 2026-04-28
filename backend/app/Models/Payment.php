<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Enums\PaymentMethod;
use App\Enums\PaymentCategory;

/**
 * Payment Model
 * 
 * @property int $payment_id
 * @property int|null $billing_id
 * @property int|null $contract_id
 * @property \App\Enums\PaymentCategory $payment_category
 * @property float $amount_paid
 * @property \Illuminate\Support\Carbon $payment_date
 * @property \App\Enums\PaymentMethod $payment_method
 * @property string|null $reference_number
 * @property int $processed_by
 * @property \Illuminate\Support\Carbon|null $voided_at
 * @property int|null $voided_by
 * @property string|null $void_reason
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
        return $this->belongsTo(Contract::class, 'contract_id', 'contract_id');
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
        return !is_null($this->voided_at);
    }
}
