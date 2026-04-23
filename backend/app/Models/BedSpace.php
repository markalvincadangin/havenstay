<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Enums\BedSpaceStatus;
use App\Enums\ContractStatus;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * BedSpace Model
 * 
 * Represents a specific bed within a room.
 * 
 * @property int $bed_space_id
 * @property int $room_id
 * @property string $bed_label
 * @property \App\Enums\BedSpaceStatus $status
 */
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


    protected function casts(): array
    {
        return [
            'status' => BedSpaceStatus::class,
        ];
    }

    /**
     * Parent room containing this bed space.
     */
    public function room(): BelongsTo
    {
        return $this->belongsTo(Room::class, 'room_id', 'room_id');
    }

    /**
     * Contract history for this bed space.
     */
    public function contracts(): HasMany
    {
        return $this->hasMany(Contract::class, 'bed_space_id', 'bed_space_id');
    }

    /**
     * The active contract currently occupying this bed space, if any.
     */
    public function activeContract(): HasOne
    {
        return $this->hasOne(Contract::class, 'bed_space_id', 'bed_space_id')
            ->where('status', ContractStatus::ACTIVE)
            ->whereNull('deleted_at');
    }
}
