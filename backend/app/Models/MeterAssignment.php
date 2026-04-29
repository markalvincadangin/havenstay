<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * MeterAssignment Model
 *
 * @property int $assignment_id
 * @property int $meter_id
 * @property int $room_id
 * @property Carbon $valid_from
 * @property Carbon|null $valid_to
 */
class MeterAssignment extends Model
{
    use HasFactory;

    protected $primaryKey = 'assignment_id';

    protected $fillable = [
        'meter_id',
        'room_id',
        'valid_from',
        'valid_to',
    ];

    protected function casts(): array
    {
        return [
            'valid_from' => 'date',
            'valid_to' => 'date',
        ];
    }

    public function meter(): BelongsTo
    {
        return $this->belongsTo(Meter::class, 'meter_id', 'meter_id');
    }

    public function room(): BelongsTo
    {
        return $this->belongsTo(Room::class, 'room_id', 'room_id');
    }
}
