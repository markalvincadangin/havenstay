<?php

namespace App\Services;

use App\Models\Tenant;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class TenantService
{
    /**
     * Create a new tenant record
     * FR-008, FR-009: Create and update tenant profiles
     */
    public static function create(array $data): Tenant
    {
        // CCR-007: Transaction log entry
        $started = TransactionService::logStarted(
            'tenant_registration',
            auth()->id() ?? 0,
            'tenants',
            $data['last_name'] ?? 'pending'
        );
        $txLogId = $started['tx_log_id'];

        if (Auth::check()) {
            AuditService::setAuditUserContext(Auth::id());
        }
        AuditService::setCorrelationContext($started['correlation_id']);

        try {
            $tenant = Tenant::create($data);

            TransactionService::logCommitted($txLogId, [
                'tenant_id' => $tenant->tenant_id,
                'name' => "{$tenant->first_name} {$tenant->last_name}",
                'email' => $tenant->email,
            ]);

            return $tenant;
        } catch (\Exception $e) {
            TransactionService::logFailed($txLogId, $e->getMessage());
            throw $e;
        } finally {
            AuditService::clearCorrelationContext();
        }
    }

    /**
     * Update an existing tenant record
     * FR-008: Update tenant profiles
     */
    public static function update(Tenant $tenant, array $data): Tenant
    {
        // CCR-007: Transaction log entry
        $started = TransactionService::logStarted(
            'tenant_profile_update',
            auth()->id() ?? 0,
            'tenants',
            (string) $tenant->tenant_id
        );
        $txLogId = $started['tx_log_id'];

        if (Auth::check()) {
            AuditService::setAuditUserContext(Auth::id());
        }
        AuditService::setCorrelationContext($started['correlation_id']);

        try {
            $tenant->update($data);

            TransactionService::logCommitted($txLogId, [
                'tenant_id' => $tenant->tenant_id,
                'email' => $tenant->email,
                'fields_updated' => array_keys($data),
            ]);

            return $tenant;
        } catch (\Exception $e) {
            TransactionService::logFailed($txLogId, $e->getMessage());
            throw $e;
        } finally {
            AuditService::clearCorrelationContext();
        }
    }

    /**
     * Deactivate a tenant (mark as moved_out)
     * FR-010: Maintain tenant history
     */
    public static function deactivate(Tenant $tenant): Tenant
    {
        $tenant->update(['status' => 'moved_out']);

        return $tenant;
    }

    /**
     * Reactivate a tenant (mark as active)
     */
    public static function reactivate(Tenant $tenant): Tenant
    {
        $tenant->update(['status' => 'active']);

        return $tenant;
    }

    /**
     * Get all tenants with richness (Current Room & Outstanding Balance)
     * Leveraging optimized views: vw_active_contracts, vw_billing_summary
     */
    public static function allRich(): Collection
    {
        return self::searchRich();
    }

    /**
     * Search tenants with richness
     * Leveraging optimized views: vw_active_contracts, vw_billing_summary
     */
    /**
     * Search tenants with richness (query builder for pagination).
     *
     * @return Builder<Tenant>
     */
    public static function searchRichBuilder(string $query = '', string $status = ''): Builder
    {
        // CCR-003: SELECT query with joins
        // CCR-005: Multi-table JOIN via views
        $q = Tenant::query()
            ->select('tenants.*')
            // Join with Active Contracts view (Room/Bed)
            ->leftJoin('vw_active_contracts', 'tenants.tenant_id', '=', 'vw_active_contracts.tenant_id')
            ->addSelect([
                'vw_active_contracts.room_code',
                'vw_active_contracts.bed_label',
            ])
            // Join with Billing Summary (Outstanding Balance)
            ->leftJoin('vw_billing_summary', 'tenants.tenant_id', '=', 'vw_billing_summary.tenant_id')
            ->addSelect([
                DB::raw('COALESCE(SUM(vw_billing_summary.total_amount - vw_billing_summary.total_paid), 0) as outstanding_balance'),
            ])
            ->groupBy('tenants.tenant_id', 'vw_active_contracts.room_code', 'vw_active_contracts.bed_label');

        if (! empty($query)) {
            // CCR-004: LIKE operator for pattern matching
            // CCR-004: OR operator for multi-condition search
            $q->where(function ($builder) use ($query) {
                $builder->where('tenants.first_name', 'LIKE', "%{$query}%")
                    ->orWhere('tenants.last_name', 'LIKE', "%{$query}%")
                    ->orWhere('tenants.contact_number', 'LIKE', "%{$query}%")
                    ->orWhere('tenants.email', 'LIKE', "%{$query}%");
                if (ctype_digit($query)) {
                    $builder->orWhere('tenants.tenant_id', (int) $query);
                }
            });
        }

        if (! empty($status)) {
            $q->where('tenants.status', $status);
        }

        return $q;
    }

    public static function searchRich(string $query = '', string $status = ''): Collection
    {
        return self::searchRichBuilder($query, $status)->get();
    }

    /**
     * Find a tenant by ID
     */
    public static function findById(int $id): ?Tenant
    {
        return Tenant::find($id);
    }
}
