<?php

namespace App\Models;

use App\Enums\MeterStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Meter Model
 *
 * @property int $meter_id
 * @property int $utility_id
 * @property string $serial_number
 * @property MeterStatus $status
 */
class Meter extends Model
{
    use HasFactory;

    protected $primaryKey = 'meter_id';

    protected $fillable = [
        'utility_id',
        'serial_number',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'status' => MeterStatus::class,
        ];
    }

    public function utility(): BelongsTo
    {
        return $this->belongsTo(Utility::class, 'utility_id', 'utility_id');
    }

    public function assignments(): HasMany
    {
        return $this->hasMany(MeterAssignment::class, 'meter_id', 'meter_id');
    }

    public function readings(): HasMany
    {
        return $this->hasMany(MeterReading::class, 'meter_id', 'meter_id');
    }
}
