<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Utility Model
 *
 * @property int $utility_id
 * @property string $name
 * @property string $unit_of_measurement
 */
class Utility extends Model
{
    use HasFactory, SoftDeletes;

    protected $primaryKey = 'utility_id';

    protected $fillable = [
        'name',
        'unit_of_measurement',
    ];

    public function meters(): HasMany
    {
        return $this->hasMany(Meter::class, 'utility_id', 'utility_id');
    }

    public function rates(): HasMany
    {
        return $this->hasMany(UtilityRate::class, 'utility_id', 'utility_id');
    }

    /**
     * Get the currently active rate based on the effective_from date.
     * Aligned with BR-MET-007.
     */
    public function getActiveRateAttribute(): ?UtilityRate
    {
        return $this->rates()
            ->where('effective_from', '<=', now()->startOfDay())
            ->orderByDesc('effective_from')
            ->first();
    }
}
