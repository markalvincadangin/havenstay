<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\HasOneThrough;

#[Fillable([
    'tenant_id',
    'bed_space_id',
    'created_by',
    'move_in_date',
    'expected_move_out_date',
    'actual_move_out_date',
    'deposit_amount',
    'monthly_rate',
    'status',
    'notes',
])]
class Contract extends Model
{
    use HasFactory;

    protected $table = 'contracts';

    protected $primaryKey = 'contract_id';

    const STATUS_ACTIVE = 'active';

    const STATUS_COMPLETED = 'completed';

    const STATUS_TERMINATED = 'terminated';

    protected function casts(): array
    {
        return [
            'move_in_date' => 'date',
            'expected_move_out_date' => 'date',
            'actual_move_out_date' => 'date',
            'deposit_amount' => 'decimal:2',
            'monthly_rate' => 'decimal:2',
            'status' => 'string',
        ];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class, 'tenant_id', 'tenant_id');
    }

    public function room(): HasOneThrough
    {
        return $this->hasOneThrough(
            Room::class,
            BedSpace::class,
            'bed_space_id',
            'room_id',
            'bed_space_id',
            'room_id'
        );
    }

    public function bedSpace(): BelongsTo
    {
        return $this->belongsTo(BedSpace::class, 'bed_space_id', 'bed_space_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by', 'user_id');
    }

    public function billings(): HasMany
    {
        return $this->hasMany(Billing::class, 'contract_id', 'contract_id');
    }

    /**
     * Get the most recent billing record for continuity tracking.
     */
    public function latestBilling(): HasOne
    {
        return $this->hasOne(Billing::class, 'contract_id', 'contract_id')
            ->latest('billing_period_to');
    }
}
