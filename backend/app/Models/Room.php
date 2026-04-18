<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Room Model
 * 
 * Represents a physical room in the boarding house.
 * 
 * @property int $room_id
 * @property string $room_code
 * @property string $room_type
 * @property int $capacity
 * @property float $monthly_rate
 * @property string $status
 * @property array|null $amenities
 */
class Room extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'rooms';

    protected $primaryKey = 'room_id';

    protected $fillable = [
        'room_code',
        'room_type',
        'capacity',
        'monthly_rate',
        'status',
        'amenities',
        'description',
    ];

    /**
     * Appended forensic attributes.
     */
    protected $appends = ['last_meter_readings'];

    const TYPE_SOLO = 'solo';

    const TYPE_SHARED = 'shared';

    const STATUS_VACANT = 'vacant';

    const STATUS_PARTIALLY_OCCUPIED = 'partially_occupied';

    const STATUS_FULLY_OCCUPIED = 'fully_occupied';

    const STATUS_MAINTENANCE = 'maintenance';
    const STATUS_ARCHIVED = 'archived';

    protected function casts(): array
    {
        return [
            'room_code' => 'string',
            'room_type' => 'string',
            'capacity' => 'integer',
            'monthly_rate' => 'decimal:2',
            'status' => 'string',
            'amenities' => 'array',
            'description' => 'string',
        ];
    }

    public function bedSpaces(): HasMany
    {
        return $this->hasMany(BedSpace::class, 'room_id', 'room_id');
    }

    /**
     * Utility meter readings for this room.
     */
    public function meterReadings(): HasMany
    {
        return $this->hasMany(RoomMeterReading::class, 'room_id', 'room_id');
    }

    /**
     * Forensic Accessor: Latest utility readings for billing cycle verification.
     */
    public function getLastMeterReadingsAttribute(): array
    {
        // Note: For performance, ensure 'meterReadings' is eager loaded in controllers.
        $readings = $this->relationLoaded('meterReadings') 
            ? $this->meterReadings 
            : $this->meterReadings()->orderByDesc('reading_date')->orderByDesc('created_at')->get();

        $elec = $readings->where('utility_type', RoomMeterReading::UTILITY_ELECTRIC)->first();
        $water = $readings->where('utility_type', RoomMeterReading::UTILITY_WATER)->first();

        return [
            'electric' => $elec ? [
                'value' => (float) $elec->reading_value,
                'date' => $elec->reading_date->toDateString(),
            ] : null,
            'water' => $water ? [
                'value' => (float) $water->reading_value,
                'date' => $water->reading_date->toDateString(),
            ] : null,
        ];
    }
}
