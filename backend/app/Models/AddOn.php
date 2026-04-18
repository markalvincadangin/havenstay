<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * AddOn Model (Appliance Registry)
 * 
 * Catalog of billable appliances or additional services.
 * 
 * @property int $add_on_id
 * @property string $item_name
 * @property float $default_monthly_rate
 * @property bool $is_active
 */
class AddOn extends Model
{
    use HasFactory;

    protected $table = 'add_on_registry';

    protected $primaryKey = 'add_on_id';

    public $timestamps = true;

    protected $fillable = [
        'item_name',
        'default_monthly_rate',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'default_monthly_rate' => 'decimal:2',
            'is_active' => 'boolean',
            'created_at' => 'datetime',
        ];
    }

    /**
     * Contracts that currently have or have previously had this add-on assigned.
     */
    public function contracts(): BelongsToMany
    {
        return $this->belongsToMany(Contract::class, 'contract_add_ons', 'add_on_id', 'contract_id')
            ->withPivot('id', 'actual_rate', 'created_at', 'updated_at');
    }
}
