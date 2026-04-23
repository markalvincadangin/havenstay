<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * UtilityRate Model
 * 
 * @property int $rate_id
 * @property int $utility_id
 * @property float $base_rate
 * @property \Illuminate\Support\Carbon $effective_from
 */
class UtilityRate extends Model
{
    use HasFactory;

    protected $primaryKey = 'rate_id';

    protected $fillable = [
        'utility_id',
        'base_rate',
        'effective_from',
    ];

    protected function casts(): array
    {
        return [
            'base_rate' => 'decimal:2',
            'effective_from' => 'date',
        ];
    }

    public function utility(): BelongsTo
    {
        return $this->belongsTo(Utility::class, 'utility_id', 'utility_id');
    }
}
