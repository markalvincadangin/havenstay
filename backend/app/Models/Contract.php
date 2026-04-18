<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\HasOneThrough;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Contract Model
 * 
 * Represents a rental agreement between a tenant and the boarding house.
 * 
 * @property int $contract_id
 * @property int $tenant_id
 * @property int $bed_space_id
 * @property int $created_by
 * @property \Illuminate\Support\Carbon $move_in_date
 * @property \Illuminate\Support\Carbon|null $expected_move_out_date
 * @property \Illuminate\Support\Carbon|null $actual_move_out_date
 * @property float $deposit_amount
 * @property float|null $monthly_rate_override
 * @property string $status
 * @property bool $is_cleared
 */
class Contract extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'contracts';

    protected $primaryKey = 'contract_id';

    protected $fillable = [
        'tenant_id',
        'bed_space_id',
        'created_by',
        'move_in_date',
        'expected_move_out_date',
        'actual_move_out_date',
        'deposit_amount',
        'monthly_rate_override',
        'monthly_rate',
        'status',
        'is_cleared',
        'notes',
    ];

    const STATUS_PENDING_PAYMENT = 'pending_payment';
    const STATUS_ACTIVE = 'active';

    const STATUS_COMPLETED = 'completed';

    const STATUS_TERMINATED = 'terminated';
    const STATUS_VOIDED = 'voided';

    protected $appends = ['monthly_rate', 'unbilled_readings', 'contract_add_ons'];

    protected function casts(): array
    {
        return [
            'move_in_date' => 'date',
            'expected_move_out_date' => 'date',
            'actual_move_out_date' => 'date',
            'deposit_amount' => 'decimal:2',
            'monthly_rate_override' => 'decimal:2',
            'status' => 'string',
            'is_cleared' => 'boolean',
        ];
    }

    /**
     * Virtual attribute: The authoritative monthly rate for this contract.
     * Falls back to the standard room rate if no specific override was recorded.
     */
    public function getMonthlyRateAttribute(): float
    {
        if ($this->monthly_rate_override !== null) {
            return (float) $this->monthly_rate_override;
        }

        return (float) ($this->room?->monthly_rate ?? 0);
    }

    /**
     * Mutator to handle 'monthly_rate' assignment by mapping it to the override column.
     */
    public function setMonthlyRateAttribute($value): void
    {
        $this->attributes['monthly_rate_override'] = $value;
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

    public function addOns(): BelongsToMany
    {
        return $this->belongsToMany(AddOn::class, 'contract_add_ons', 'contract_id', 'add_on_id')
            ->withPivot('id', 'actual_rate', 'created_at', 'updated_at');
    }

    /**
     * Get unbilled meter readings for the room associated with this contract.
     */
    public function unbilledReadings(): HasMany
    {
        return $this->hasMany(RoomMeterReading::class, 'room_id', 'room_id')
            ->whereNull('billing_id');
    }

    /**
     * Virtual attribute for the wizard.
     */
    public function getUnbilledReadingsAttribute()
    {
        // Try to get room_id from bedSpace if room is not loaded
        $roomId = $this->room?->room_id ?? $this->bedSpace?->room_id;
        if (!$roomId) return [];
        
        return RoomMeterReading::where('room_id', $roomId)
            ->whereNull('billing_id')
            ->get();
    }

    /**
     * Virtual attribute for the wizard: Flattens the add-ons and ensures 
     * the rate field exists for the Billing Wizard's calculation logic.
     */
    public function getContractAddOnsAttribute()
    {
        return $this->addOns->map(function($addon) {
            $addon->rate = (float) $addon->pivot->actual_rate;
            $addon->monthly_rate = (float) $addon->pivot->actual_rate;
            return $addon;
        });
    }
}
