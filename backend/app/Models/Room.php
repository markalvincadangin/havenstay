<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'room_code',
    'room_type',
    'capacity',
    'monthly_rate',
    'status', 'amenities',
    'description',
])]
class Room extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'rooms';

    protected $primaryKey = 'room_id';

    const TYPE_SOLO = 'solo';

    const TYPE_SHARED = 'shared';

    const STATUS_AVAILABLE = 'available';

    const STATUS_UNAVAILABLE = 'unavailable';

    const STATUS_MAINTENANCE = 'maintenance';

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
}
