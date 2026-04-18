<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * ContractAddOn Model
 * 
 * Represents an active appliance assignment for a specific contract.
 * Captures the actual_rate at the time of assignment.
 * 
 * @property int $id
 * @property int $contract_id
 * @property int $add_on_id
 * @property float $actual_rate
 */
class ContractAddOn extends Model
{
    use HasFactory;

    protected $table = 'contract_add_ons';

    // The USER added id as surrogate PK in v3.0
    protected $primaryKey = 'id';

    public $timestamps = true;

    protected $fillable = [
        'contract_id',
        'add_on_id',
        'actual_rate',
    ];

    protected function casts(): array
    {
        return [
            'actual_rate' => 'decimal:2',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    public function contract(): BelongsTo
    {
        return $this->belongsTo(Contract::class, 'contract_id', 'contract_id');
    }

    public function addOn(): BelongsTo
    {
        return $this->belongsTo(AddOn::class, 'add_on_id', 'add_on_id');
    }
}
