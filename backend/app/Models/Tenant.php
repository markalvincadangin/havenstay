<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

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

    const STATUS_ACTIVE = 'active';

    const STATUS_MOVED_OUT = 'moved_out';

    const STATUS_ARCHIVED = 'archived';

    protected function casts(): array
    {
        return [
            'status' => 'string',
        ];
    }

    /**
     * Scope for searching tenants.
     */
    public function scopeSearch(Builder $query, string $term): void
    {
        if (empty($term)) {
            return;
        }

        $query->where(function ($q) use ($term) {
            $q->where('tenants.first_name', 'LIKE', "%{$term}%")
                ->orWhere('tenants.last_name', 'LIKE', "%{$term}%")
                ->orWhere('tenants.contact_number', 'LIKE', "%{$term}%")
                ->orWhere('tenants.email', 'LIKE', "%{$term}%");

            if (ctype_digit($term)) {
                $q->orWhere('tenant_id', (int) $term);
            }
        });
    }

    /**
     * Scope for adding rich context (occupancy and balance) via database views.
     */
    public function scopeWithRichContext(Builder $query): void
    {
        $driver = DB::getDriverName();
        $nowExpr = $driver === 'sqlite' ? "datetime('now')" : 'NOW()';
        $upperExpr = $driver === 'sqlite' ? "datetime('now','+30 day')" : 'DATE_ADD(NOW(), INTERVAL 30 DAY)';

        $query->select('tenants.*')
            ->leftJoin('vw_active_contracts', 'tenants.tenant_id', '=', 'vw_active_contracts.tenant_id')
            ->addSelect([
                'vw_active_contracts.room_code',
                'vw_active_contracts.bed_label',
            ])
            ->leftJoin('vw_billing_summary', 'tenants.tenant_id', '=', 'vw_billing_summary.tenant_id')
            ->addSelect([
                DB::raw('COALESCE(SUM(vw_billing_summary.total_amount - vw_billing_summary.total_paid), 0) as outstanding_balance'),
                DB::raw('(SELECT COUNT(*) FROM contracts WHERE contracts.tenant_id = tenants.tenant_id AND contracts.status = "active" AND contracts.deleted_at IS NULL AND contracts.expected_move_out_date IS NOT NULL AND contracts.expected_move_out_date BETWEEN '.$nowExpr.' AND '.$upperExpr.') as pending_move_outs')
            ])
            ->groupBy('tenants.tenant_id', 'vw_active_contracts.room_code', 'vw_active_contracts.bed_label');
    }
}
