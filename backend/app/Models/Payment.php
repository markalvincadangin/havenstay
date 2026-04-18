<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Payment Model
 * 
 * Represents a financial transaction posted against a billing cycle.
 * Payments are immutable; state changes are handled via voiding.
 * 
 * @property int $payment_id
 * @property int $billing_id
 * @property int $processed_by
 * @property float $amount_paid
 * @property \Illuminate\Support\Carbon $payment_date
 * @property string $payment_method
 * @property string|null $reference_number
 * @property string|null $remarks
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

    /**
     * Payments are immutable financial records — once posted they are never
     * updated in place, only voided via the voided_at timestamp.
     * Disabling updated_at enforces this at the Eloquent layer.
     *
     * @see SDD §4.3 "Forensic Lock" · schema payments table comment
     */
    const UPDATED_AT = null;

    protected function casts(): array
    {
        return [
            'amount_paid' => 'decimal:2',
            'payment_date' => 'date',
            'payment_method' => 'string',
            'voided_at' => 'datetime',
        ];
    }

    /**
     * Parent billing statement this payment satisfies.
     */
    public function billing(): BelongsTo
    {
        return $this->belongsTo(Billing::class, 'billing_id', 'billing_id');
    }

    /**
     * Staff member who processed the payment intake.
     */
    public function processor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'processed_by', 'user_id');
    }

    /**
     * Staff member who authorized the voiding of this payment, if any.
     */
    public function voider(): BelongsTo
    {
        return $this->belongsTo(User::class, 'voided_by', 'user_id');
    }

    /**
     * Check if payment has been voided.
     */
    public function isVoided(): bool
    {
        return !is_null($this->voided_at);
    }
}
