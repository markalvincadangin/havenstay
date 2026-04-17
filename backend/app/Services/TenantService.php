<?php

namespace App\Services;

use App\Services\Concerns\ManagesWorkflows;
use App\Models\Contract;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Validation\ValidationException;

class TenantService
{
    use ManagesWorkflows;

    /**
     * Create a new tenant record.
     */
    public static function create(User $actor, array $data): Tenant
    {
        return self::runWriteWorkflow(
            actorId: $actor->user_id,
            action: 'CREATE_TENANT',
            txnReference: (string) ($data['email'] ?? 'tenant:create'),
            payload: ['email' => $data['email'] ?? null],
            operation: fn (): Tenant => Tenant::create($data),
            resultDetails: fn (Tenant $tenant): array => ['tenant_id' => $tenant->tenant_id]
        );
    }

    /**
     * Update an existing tenant record.
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

                // BR-005b (SRS): 'moved_out' is a system-managed state reached only via move-out workflow.
                if ($hasStatusChange && $data['status'] === Tenant::STATUS_MOVED_OUT) {
                    throw ValidationException::withMessages([
                        'status' => ['Tenant status cannot be manually set to "Moved Out". Use the move-out process on the contract instead.'],
                    ]);
                }

                if ($hasStatusChange && self::hasActiveContract($tenant->tenant_id)) {
                    throw ValidationException::withMessages([
                        'status' => ['Tenant status cannot be changed while an active contract exists. Process move-out first.'],
                    ]);
                }

                $tenant->update($data);

                return $tenant;
            },
            resultDetails: fn (Tenant $updatedTenant): array => ['tenant_id' => $updatedTenant->tenant_id]
        );
    }

    /**
     * Reactivate a tenant (mark as active)
     */
    public static function reactivate(User $actor, Tenant $tenant): Tenant
    {
        return self::runWriteWorkflow(
            actorId: $actor->user_id,
            action: 'REACTIVATE_TENANT',
            txnReference: (string) $tenant->tenant_id,
            payload: ['tenant_id' => $tenant->tenant_id],
            operation: function () use ($tenant): Tenant {
                $tenant->update(['status' => Tenant::STATUS_ACTIVE]);

                return $tenant;
            },
            resultDetails: fn (Tenant $reactivatedTenant): array => ['tenant_id' => $reactivatedTenant->tenant_id]
        );
    }

    /**
     * Archive a tenant (mark as archived)
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
                        'status' => ['Tenant cannot be archived while an active contract exists. Process move-out first.'],
                    ]);
                }

                $tenant->update(['status' => Tenant::STATUS_ARCHIVED]);
                $tenant->delete();

                return $tenant;
            },
            resultDetails: fn (Tenant $archivedTenant): array => ['tenant_id' => $archivedTenant->tenant_id]
        );
    }

    public static function restore(User $actor, int $tenantId): Tenant
    {
        return self::runWriteWorkflow(
            actorId: $actor->user_id,
            action: 'RESTORE_TENANT',
            txnReference: (string) $tenantId,
            payload: ['tenant_id' => $tenantId],
            operation: function () use ($tenantId): Tenant {
                $tenant = Tenant::withTrashed()->findOrFail($tenantId);
                $tenant->restore();

                // BR-005b (SRS): Determine status based on contract history context.
                $newStatus = self::hasActiveContract($tenant->tenant_id)
                    ? Tenant::STATUS_ACTIVE
                    : Tenant::STATUS_MOVED_OUT;

                $tenant->update(['status' => $newStatus]);

                return $tenant;
            },
            resultDetails: fn (Tenant $restoredTenant): array => ['tenant_id' => $restoredTenant->tenant_id]
        );
    }


    public static function allRich(): Collection
    {
        return self::searchRich();
    }

    /**
     * Search tenants with richness (query builder for pagination).
     *
     * @return Builder<Tenant>
     */
    public static function searchRichBuilder(string $query = '', string $status = '', string $sortBy = 'last_name', string $sortOrder = 'asc'): Builder
    {
        $q = Tenant::withTrashed()
            ->withRichContext()
            ->search($query);

        if (! empty($status)) {
            $q->where('tenants.status', $status);
        }

        $order = strtolower($sortOrder) === 'desc' ? 'desc' : 'asc';
        $q->orderBy($sortBy, $order);

        if ($sortBy !== 'tenant_id') {
            $q->orderBy('tenant_id', 'asc');
        }

        return $q;
    }


    public static function searchRich(string $query = '', string $status = '', string $sortBy = 'last_name', string $sortOrder = 'asc'): Collection
    {
        return self::searchRichBuilder($query, $status, $sortBy, $sortOrder)->get();
    }

    /**
     * Summary metrics for tenant dashboard/list KPIs.
     *
     * @return array{active_tenants:int,pending_move_outs:int}
     */
    public static function summary(): array
    {
        $activeTenants = Tenant::query()
            ->whereNull('deleted_at')
            ->where('status', Tenant::STATUS_ACTIVE)
            ->count();

        $pendingMoveOuts = Contract::query()
            ->whereNull('deleted_at')
            ->where('status', Contract::STATUS_ACTIVE)
            ->whereNotNull('expected_move_out_date')
            ->whereBetween('expected_move_out_date', [now()->startOfDay(), now()->copy()->addDays(30)->endOfDay()])
            ->count();

        return [
            'active_tenants' => $activeTenants,
            'pending_move_outs' => $pendingMoveOuts,
            'total_records' => Tenant::withTrashed()->count(),
        ];
    }

    public static function hasActiveContract(int $tenantId): bool
    {
        return Contract::query()
            ->where('tenant_id', $tenantId)
            ->where('status', Contract::STATUS_ACTIVE)
            ->whereNull('deleted_at')
            ->exists();
    }

    /**
     * Find a tenant by ID
     */
    public static function findById(int $id): ?Tenant
    {
        return Tenant::find($id);
    }

    public static function findByIdWithTrashedOrFail(int $id): Tenant
    {
        return Tenant::withTrashed()->findOrFail($id);
    }
}
