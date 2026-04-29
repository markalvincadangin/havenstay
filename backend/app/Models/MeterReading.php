<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * MeterReading Model
 *
 * @property int $reading_id
 * @property int $meter_id
 * @property Carbon $reading_date
 * @property float $reading_value
 * @property bool $is_rollover
 * @property int $recorded_by
 * @property int|null $billing_id
 */
class MeterReading extends Model
{
    use HasFactory;

    protected $primaryKey = 'reading_id';

    protected $fillable = [
        'meter_id',
        'reading_date',
        'reading_value',
        'is_rollover',
        'recorded_by',
    ];

    protected function casts(): array
    {
        return [
            'reading_date' => 'date',
            'reading_value' => 'decimal:4',
            'is_rollover' => 'boolean',
        ];
    }

    public function meter(): BelongsTo
    {
        return $this->belongsTo(Meter::class, 'meter_id', 'meter_id');
    }

    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by', 'user_id');
    }

    public function billing(): BelongsTo
    {
        return $this->belongsTo(Billing::class, 'billing_id', 'billing_id');
    }
}
