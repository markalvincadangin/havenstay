<?php

namespace App\Models;

use App\Enums\ContractStatus;
use App\Enums\ContractType;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\HasOneThrough;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;

/**
 * Contract Model
 *
 * @property int $contract_id
 * @property int $tenant_id
 * @property int $bed_space_id
 * @property int $created_by
 * @property ContractType $contract_type
 * @property Carbon $move_in_date
 * @property Carbon|null $expected_move_out_date
 * @property Carbon|null $actual_move_out_date
 * @property float $monthly_rate
 * @property float|null $monthly_rate_override
 * @property float $deposit_amount
 * @property bool $is_cleared
 * @property ContractStatus $status
 * @property string|null $notes
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
        'contract_type',
        'move_in_date',
        'expected_move_out_date',
        'actual_move_out_date',
        'monthly_rate',
        'monthly_rate_override',
        'deposit_amount',
        'is_cleared',
        'status',
        'notes',
        'idempotency_key',
    ];

    protected function casts(): array
    {
        return [
            'move_in_date' => 'date',
            'expected_move_out_date' => 'date',
            'actual_move_out_date' => 'date',
            'monthly_rate' => 'decimal:2',
            'monthly_rate_override' => 'decimal:2',
            'deposit_amount' => 'decimal:2',
            'is_cleared' => 'boolean',
            'status' => ContractStatus::class,
            'contract_type' => ContractType::class,
        ];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class, 'tenant_id', 'tenant_id')->withTrashed();
    }

    public function bedSpace(): BelongsTo
    {
        return $this->belongsTo(BedSpace::class, 'bed_space_id', 'bed_space_id');
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

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by', 'user_id');
    }

    public function billings(): HasMany
    {
        return $this->hasMany(Billing::class, 'contract_id', 'contract_id');
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class, 'contract_id', 'contract_id');
    }

    /**
     * Get the current active billing cycle.
     */
    public function latestBilling(): HasOne
    {
        return $this->hasOne(Billing::class, 'contract_id', 'contract_id')
            ->latest('billing_period_to');
    }

    /**
     * Scope: Enrich query with Tenant full name for sorting.
     */
    public function scopeWithTenantName(Builder $query): Builder
    {
        return $query->addSelect([
            'tenant_name' => Tenant::select(\Illuminate\Support\Facades\DB::raw('CONCAT(last_name, ", ", first_name)'))
                ->whereColumn('tenants.tenant_id', 'contracts.tenant_id')
                ->limit(1)
        ]);
    }

    /**
     * Scope: Enrich query with room context.
     */
    public function scopeWithRoomContext(Builder $query): Builder
    {
        return $query->addSelect([
            'room_code' => 'room_context.room_code',
            'bed_label' => 'room_context.bed_label',
        ])->leftJoinLateral(
            Room::select('rooms.room_code', 'bed_spaces.bed_label')
                ->join('bed_spaces', 'rooms.room_id', '=', 'bed_spaces.room_id')
                ->whereColumn('bed_spaces.bed_space_id', 'contracts.bed_space_id')
                ->limit(1),
            'room_context'
        );
    }
}
