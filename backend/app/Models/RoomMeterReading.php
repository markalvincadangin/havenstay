<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * RoomMeterReading Model
 * 
 * Records sub-meter utility readings for electric and water consumption per room.
 * 
 * @property int $reading_id
 * @property int $room_id
 * @property int|null $billing_id
 * @property string $utility_type
 * @property \Illuminate\Support\Carbon $reading_date
 * @property float $reading_value
 * @property int $recorded_by
 */
class RoomMeterReading extends Model
{
    use HasFactory;

    protected $table = 'room_meter_readings';

    protected $primaryKey = 'reading_id';

    public $timestamps = true;

    protected $fillable = [
        'room_id',
        'billing_id',
        'utility_type',
        'reading_date',
        'reading_value',
        'recorded_by',
    ];

    const UTILITY_ELECTRIC = 'electric';

    const UTILITY_WATER = 'water';

    protected function casts(): array
    {
        return [
            'reading_date' => 'date',
            'reading_value' => 'decimal:4',
            'created_at' => 'datetime',
        ];
    }

    protected $appends = ['calculated_amount', 'consumption_delta'];

    public function getCalculatedAmountAttribute()
    {
        $delta = $this->consumption_delta;
        $rate = $this->utility_type === self::UTILITY_ELECTRIC ? 15.00 : 50.00;
        return round($delta * $rate, 2);
    }

    public function getConsumptionDeltaAttribute()
    {
        $prev = RoomMeterReading::where('room_id', $this->room_id)
            ->where('utility_type', $this->utility_type)
            ->where('reading_date', '<', $this->reading_date)
            ->orderByDesc('reading_date')
            ->first();
            
        return $prev ? max(0, $this->reading_value - $prev->reading_value) : 0;
    }

    /**
     * Physical room this reading was recorded for.
     */
    public function room(): BelongsTo
    {
        return $this->belongsTo(Room::class, 'room_id', 'room_id');
    }

    /**
     * Staff member who performed the physical reading.
     */
    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by', 'user_id');
    }

    /**
     * Billing cycle this reading was incorporated into, if any.
     */
    public function billing(): BelongsTo
    {
        return $this->belongsTo(Billing::class, 'billing_id', 'billing_id');
    }
}
