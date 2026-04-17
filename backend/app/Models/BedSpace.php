<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;


class BedSpace extends Model
{
    use HasFactory;

    protected $table = 'bed_spaces';

    protected $primaryKey = 'bed_space_id';

    protected $fillable = [
        'room_id',
        'bed_label',
        'status',
    ];

    const STATUS_VACANT = 'vacant';

    const STATUS_OCCUPIED = 'occupied';

    const STATUS_MAINTENANCE = 'maintenance';

    protected function casts(): array
    {
        return [
            'status' => 'string',
        ];
    }

    public function room(): BelongsTo
    {
        return $this->belongsTo(Room::class, 'room_id', 'room_id');
    }
}
