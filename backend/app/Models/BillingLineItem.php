<?php

namespace App\Models;

use App\Enums\LineItemType;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * BillingLineItem Model
 *
 * @property int $line_item_id
 * @property int $billing_id
 * @property int|null $utility_id
 * @property int|null $reading_id
 * @property LineItemType $item_type
 * @property string $item_description
 * @property float $amount
 */
class BillingLineItem extends Model
{
    use HasFactory;

    protected $table = 'billing_line_items';

    protected $primaryKey = 'line_item_id';

    protected $fillable = [
        'billing_id',
        'utility_id',
        'reading_id',
        'item_type',
        'item_description',
        'amount',
    ];

    protected function casts(): array
    {
        return [
            'item_type' => LineItemType::class,
            'amount' => 'decimal:2',
        ];
    }

    public function billing(): BelongsTo
    {
        return $this->belongsTo(Billing::class, 'billing_id', 'billing_id');
    }

    public function utility(): BelongsTo
    {
        return $this->belongsTo(Utility::class, 'utility_id', 'utility_id');
    }

    public function reading(): BelongsTo
    {
        return $this->belongsTo(MeterReading::class, 'reading_id', 'reading_id');
    }
}
