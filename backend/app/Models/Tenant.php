<?php

namespace App\Models;

use App\Enums\ContractStatus;
use App\Enums\TenantStatus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\DB;

/**
 * Tenant Model
 *
 * Profile for a boarding house resident. Tracks personal information,
 * status, and rental history.
 *
 * @property int $tenant_id
 * @property string $first_name
 * @property string $last_name
 * @property string $contact_number
 * @property string $email
 * @property string $emergency_contact_name
 * @property string $emergency_contact_number
 * @property string $address
 * @property TenantStatus $status
 * @property string|null $active_email
 */
class Tenant extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'tenants';

    protected $primaryKey = 'tenant_id';

    protected $fillable = [
        'first_name',
        'last_name',
        'contact_number',
        'email',
        'emergency_contact_name',
        'emergency_contact_number',
        'address',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'status' => TenantStatus::class,
        ];
    }

    /**
     * Historical and active contracts associated with this tenant.
     */
    public function contracts(): HasMany
    {
        return $this->hasMany(Contract::class, 'tenant_id', 'tenant_id');
    }

    /**
     * The active contract for this tenant.
     */
    public function activeContract(): HasOne
    {
        return $this->hasOne(Contract::class, 'tenant_id', 'tenant_id')
            ->whereIn('status', [ContractStatus::ACTIVE, ContractStatus::PENDING_PAYMENT])
            ->whereNull('deleted_at');
    }

    /**
     * Scope: Enrich query with active contract context (room, bed) using subqueries.
     * Industry Standard: Performance patterns for avoiding joins.
     */
    public function scopeWithActiveContractContext(Builder $query): Builder
    {
        return $query->addSelect([
            'room_code' => 'contract_context.room_code',
            'bed_label' => 'contract_context.bed_label',
        ])->leftJoinLateral(
            Contract::select('rooms.room_code', 'bed_spaces.bed_label')
                ->join('bed_spaces', 'contracts.bed_space_id', '=', 'bed_spaces.bed_space_id')
                ->join('rooms', 'bed_spaces.room_id', '=', 'rooms.room_id')
                ->whereColumn('contracts.tenant_id', 'tenants.tenant_id')
                ->whereIn('contracts.status', [ContractStatus::ACTIVE->value, ContractStatus::PENDING_PAYMENT->value])
                ->whereNull('contracts.deleted_at')
                ->limit(1),
            'contract_context'
        );
    }

    /**
     * Scope: Enrich query with calculated financial balance.
     */
    public function scopeWithOutstandingBalance(Builder $query): Builder
    {
        return $query->addSelect([
            'outstanding_balance' => DB::table('billing_line_items')
                ->join('billing', 'billing_line_items.billing_id', '=', 'billing.billing_id')
                ->join('contracts', 'billing.contract_id', '=', 'contracts.contract_id')
                ->whereColumn('contracts.tenant_id', 'tenants.tenant_id')
                ->selectRaw('COALESCE(SUM(billing_line_items.amount), 0) - (
                    SELECT COALESCE(SUM(p.amount_paid), 0) 
                    FROM payments p 
                    LEFT JOIN billing b ON p.billing_id = b.billing_id
                    LEFT JOIN contracts c ON (p.contract_id = c.contract_id OR b.contract_id = c.contract_id)
                    WHERE c.tenant_id = tenants.tenant_id 
                    AND p.voided_at IS NULL
                )')
        ]);
    }
}
