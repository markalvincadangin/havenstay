<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * BillingLineItem Model
 * 
 * Represents an itemized charge within a monthly billing cycle.
 * Includes base rent, utilities, add-ons, and penalties.
 * 
 * @property int $billing_line_item_id
 * @property int $billing_id
 * @property string $item_type
 * @property string $item_description
 * @property float $amount
 */
class BillingLineItem extends Model
{
    use HasFactory;

    protected $table = 'billing_line_items';

    protected $primaryKey = 'billing_line_item_id';

    protected $fillable = [
        'billing_id',
        'item_type',
        'item_description',
        'amount',
    ];

    const TYPE_BASE_RENT = 'base_rent';

    const TYPE_UTILITY = 'utility';

    const TYPE_ADD_ON = 'add_on';

    const TYPE_PENALTY = 'penalty';

    const TYPE_ADJUSTMENT = 'adjustment';

    protected function casts(): array
    {
        return [
            'item_type' => 'string',
            'amount' => 'decimal:2',
        ];
    }

    /**
     * Parent billing header this line item belongs to.
     */
    public function billing(): BelongsTo
    {
        return $this->belongsTo(Billing::class, 'billing_id', 'billing_id');
    }
}
