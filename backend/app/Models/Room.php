<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\HasMany;
use App\Enums\RoomStatus;
use App\Enums\RoomType;

/**
 * Room Model
 * 
 * Represents a physical room in the boarding house.
 * 
 * @property int $room_id
 * @property string $room_code
 * @property \App\Enums\RoomType $room_type
 * @property int $capacity
 * @property float $monthly_rate
 * @property \App\Enums\RoomStatus $status
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
        'is_metered',
    ];

    protected function casts(): array
    {
        return [
            'room_code' => 'string',
            'room_type' => RoomType::class,
            'capacity' => 'integer',
            'monthly_rate' => 'decimal:2',
            'status' => RoomStatus::class,
            'amenities' => 'array',
            'description' => 'string',
            'is_metered' => 'boolean',
        ];
    }

    public function bedSpaces(): HasMany
    {
        return $this->hasMany(BedSpace::class, 'room_id', 'room_id');
    }

    /**
     * Meter assignments for this room.
     */
    public function meterAssignments(): HasMany
    {
        return $this->hasMany(MeterAssignment::class, 'room_id', 'room_id')
            ->whereNull('valid_to')
            ->orWhere('valid_to', '>', now()->toDateString());
    }
}
