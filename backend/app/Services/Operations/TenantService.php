<?php

namespace App\Services\Operations;

use App\Services\Concerns\ManagesWorkflows;
use App\Models\Contract;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * TenantService
 * 
 * Orchestrates tenant lifecycle management, identity search, and 
 * status state machine logic.
 */
class TenantService
{
    use ManagesWorkflows;

    /**
     * Create a new tenant record.
     * 
     * @param User $actor The staff member performing the creation.
     * @param array $data Basic profile attributes (name, contact, email).
     * @return Tenant
     */
    public static function create(User $actor, array $data): Tenant
    {
        return self::runWriteWorkflow(
            actorId: $actor->user_id,
            action: 'CREATE_TENANT',
            txnReference: self::buildTxnReference('TENANT-CRT'),
            payload: ['email' => $data['email'] ?? null],
            operation: fn (): Tenant => Tenant::create($data),
            resultDetails: fn (Tenant $tenant): array => ['tenant_id' => $tenant->tenant_id]
        );
    }

    /**
     * Update an existing tenant profile.
     * 
     * Forensic Rules:
     * - BR-005b: 'moved_out' state is system-managed; manual setting is blocked.
     * - Constraint: Status cannot be changed while an active lease is linked.
     * 
     * @param User $actor The staff member performing the update.
     * @param Tenant $tenant
     * @param array $data Updated fields.
     * @return Tenant
     * @throws ValidationException
     */
    public static function update(User $actor, Tenant $tenant, array $data): Tenant
    {
        return self::runWriteWorkflow(
            actorId: $actor->user_id,
            action: 'UPDATE_TENANT',
            txnReference: (string) $tenant->tenant_id,
            payload: ['tenant_id' => $tenant->tenant_id],
            operation: function () use ($tenant, $data): Tenant {
                $hasStatusChange = array_key_exists('status', $data) && $data['status'] !== $tenant->status;

                if ($hasStatusChange && $data['status'] === Tenant::STATUS_MOVED_OUT) {
                    throw ValidationException::withMessages([
                        'status' => ['Tenant status is system-managed via move-out workflow.'],
                    ]);
                }

                if ($hasStatusChange && self::hasActiveContract($tenant->tenant_id)) {
                    throw ValidationException::withMessages([
                        'status' => ['Tenant status cannot be changed while an active contract exists.'],
                    ]);
                }

                $tenant->update($data);

                return $tenant;
            },
            resultDetails: fn (Tenant $updatedTenant): array => ['tenant_id' => $updatedTenant->tenant_id]
        );
    }

    /**
     * Archive a tenant for forensic history.
     * 
     * @param User $actor
     * @param Tenant $tenant
     * @return Tenant
     * @throws ValidationException If active contracts exist.
     */
    public static function archive(User $actor, Tenant $tenant): Tenant
    {
        return self::runWriteWorkflow(
            actorId: $actor->user_id,
            action: 'ARCHIVE_TENANT',
            txnReference: (string) $tenant->tenant_id,
            payload: ['tenant_id' => $tenant->tenant_id],
            operation: function () use ($tenant): Tenant {
                if (self::hasActiveContract($tenant->tenant_id)) {
                    throw ValidationException::withMessages([
                        'status' => ['Tenant cannot be archived while an active contract exists.'],
                    ]);
                }

                $tenant->update(['status' => Tenant::STATUS_ARCHIVED]);
                $tenant->delete();

                return $tenant;
            }
        );
    }

    /**
     * Reactivate a moved-out or inactive tenant.
     */
    public static function reactivate(User $actor, Tenant $tenant): Tenant
    {
        return self::runWriteWorkflow(
            actorId: $actor->user_id,
            action: 'REACTIVATE_TENANT',
            txnReference: (string)$tenant->tenant_id,
            payload: ['tenant_id' => $tenant->tenant_id],
            operation: function() use ($tenant): Tenant {
                $tenant->update(['status' => Tenant::STATUS_ACTIVE]);
                return $tenant;
            }
        );
    }

    /**
     * Restore an archived tenant.
     */
    public static function restore(User $actor, int $id): Tenant
    {
        return self::runWriteWorkflow(
            actorId: $actor->user_id,
            action: 'RESTORE_TENANT',
            txnReference: self::buildTxnReference('TENANT-RES'),
            payload: ['tenant_id' => $id],
            operation: function() use ($id): Tenant {
                $tenant = Tenant::withTrashed()->findOrFail($id);
                $tenant->restore();
                $tenant->update(['status' => Tenant::STATUS_ACTIVE]);
                return $tenant;
            }
        );
    }

    /**
     * Find tenant regardless of soft-delete state.
     */
    public static function findByIdWithTrashedOrFail(int $id): Tenant
    {
        return Tenant::withTrashed()->findOrFail($id);
    }

    /**
     * Compute summary statistics for tenant distribution.
     */
    public static function summary(): array
    {
        return [
            'total_records' => Tenant::count(),
            'active_tenants' => Tenant::where('status', Tenant::STATUS_ACTIVE)->count(),
            'pending_move_outs' => Contract::where('status', Contract::STATUS_ACTIVE)
                ->whereNotNull('expected_move_out_date')
                ->whereBetween('expected_move_out_date', [
                    now()->toDateTimeString(),
                    now()->addDays(30)->toDateTimeString()
                ])
                ->count(),
            'moved_out' => Tenant::where('status', Tenant::STATUS_MOVED_OUT)->count(),
            'archived' => Tenant::onlyTrashed()->count(),
        ];
    }

    /**
     * Search tenants with richness (including room/bed context and balance).
     * Thin Model Compliance: Query logic migrated from model scopes to service.
     * 
     * @return Builder<Tenant>
     */
    public static function searchRichBuilder(string $query = '', string $status = '', string $sortBy = 'last_name', string $sortOrder = 'asc'): Builder
    {
        $q = Tenant::withTrashed();

        // Forensic Rich Context (Joins and Aggregates)
        $driver = DB::getDriverName();
        $nowExpr = $driver === 'sqlite' ? "datetime('now')" : 'NOW()';
        $upperExpr = $driver === 'sqlite' ? "datetime('now','+30 day')" : 'DATE_ADD(NOW(), INTERVAL 30 DAY)';

        $q->select('tenants.*')
            ->leftJoin('vw_active_contracts', 'tenants.tenant_id', '=', 'vw_active_contracts.tenant_id')
            ->addSelect(['vw_active_contracts.room_code', 'vw_active_contracts.bed_label'])
            ->leftJoin('vw_billing_summary', 'tenants.tenant_id', '=', 'vw_billing_summary.tenant_id')
            ->addSelect([
                DB::raw('COALESCE(SUM(vw_billing_summary.total_amount - vw_billing_summary.total_paid), 0) as outstanding_balance'),
                DB::raw('(SELECT COUNT(*) FROM contracts WHERE contracts.tenant_id = tenants.tenant_id AND contracts.status = "active" AND contracts.deleted_at IS NULL AND contracts.expected_move_out_date IS NOT NULL AND contracts.expected_move_out_date BETWEEN '.$nowExpr.' AND '.$upperExpr.') as pending_move_outs')
            ])
            ->groupBy('tenants.tenant_id', 'vw_active_contracts.room_code', 'vw_active_contracts.bed_label');

        if (!empty($query)) {
            $q->where(function ($iq) use ($query) {
                $iq->where('tenants.first_name', 'LIKE', "%{$query}%")
                    ->orWhere('tenants.last_name', 'LIKE', "%{$query}%")
                    ->orWhere('tenants.email', 'LIKE', "%{$query}%");
                if (ctype_digit($query)) $iq->orWhere('tenants.tenant_id', (int) $query);
            });
        }

        if (! empty($status)) $q->where('tenants.status', $status);

        return $q->orderBy($sortBy, $sortOrder === 'desc' ? 'desc' : 'asc');
    }

    /**
     * Internal: Check if a tenant currently has an active lease agreement.
     */
    public static function hasActiveContract(int $tenantId): bool
    {
        return Contract::query()
            ->where('tenant_id', $tenantId)
            ->where('status', Contract::STATUS_ACTIVE)
            ->whereNull('deleted_at')
            ->exists();
    }

    /**
     * Synchronize a tenant's profile status based on their contract history.
     */
    public static function syncStatus(int $tenantId): void
    {
        $tenant = Tenant::find($tenantId);
        if (!$tenant || $tenant->status === Tenant::STATUS_ARCHIVED) {
            return;
        }

        $hasActive = Contract::where('tenant_id', $tenantId)
            ->whereIn('status', [Contract::STATUS_ACTIVE, Contract::STATUS_PENDING_PAYMENT])
            ->exists();

        $newStatus = $hasActive ? Tenant::STATUS_ACTIVE : Tenant::STATUS_MOVED_OUT;

        if ($tenant->status !== $newStatus) {
            $tenant->update(['status' => $newStatus]);
        }
    }
}
