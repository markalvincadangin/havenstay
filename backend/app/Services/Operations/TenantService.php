<?php

namespace App\Services\Operations;

use App\Enums\ContractStatus;
use App\Enums\TenantStatus;
use App\Models\Contract;
use App\Models\Tenant;
use App\Models\User;
use App\Services\Concerns\ManagesWorkflows;
use App\Support\OperationalHardening;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Manages tenant lifecycle, profile updates, and status synchronization
 * based on contract history.
 */
class TenantService
{
    use ManagesWorkflows;

    /**
     * Create a new tenant record.
     *
     * @param  User  $actor  The staff member performing the creation.
     * @param  array  $data  Basic profile attributes (name, contact, email).
     */
    public static function create(User $actor, array $data): Tenant
    {
        return self::runWriteWorkflow(
            actorId: $actor->user_id,
            action: 'CREATE_TENANT',
            payload: [
                'email' => $data['email'] ?? 'N/A',
                'name_fact' => ($data['first_name'] ?? '').' '.($data['last_name'] ?? ''),
            ],
            operation: fn (): Tenant => tap(Tenant::create($data), fn() => self::clearCache()),
            resultDetails: fn (Tenant $tenant): array => ['tenant_id' => $tenant->tenant_id]
        );
    }

    /**
     * Update an existing tenant profile.
     *
     * Implementation details:
     * - 'moved_out' status is system-managed and cannot be set manually.
     * - Status cannot be changed if the tenant has an active contract.
     *
     * @param  User  $actor  The staff member performing the update.
     * @param  array  $data  Updated fields.
     *
     * @throws ValidationException
     */
    public static function update(User $actor, Tenant $tenant, array $data): Tenant
    {
        return self::runWriteWorkflow(
            actorId: $actor->user_id,
            action: 'UPDATE_TENANT',
            payload: ['tenant_id' => $tenant->tenant_id, 'email_context' => $tenant->email],
            operation: function () use ($tenant, $data): Tenant {
                if (array_key_exists('status', $data)) {
                    throw ValidationException::withMessages([
                        'status' => ['Tenant status is system-managed and cannot be modified manually (BR-TEN-004).'],
                    ]);
                }

                $tenant->update($data);
                self::clearCache();

                return $tenant;
            },
            resultDetails: fn (Tenant $updatedTenant): array => ['tenant_id' => $updatedTenant->tenant_id]
        );
    }

    /**
     * Archive a tenant record (soft-delete).
     *
     * @throws ValidationException If active contracts exist.
     */
    public static function archive(User $actor, Tenant $tenant): Tenant
    {
        return self::runWriteWorkflow(
            actorId: $actor->user_id,
            action: 'ARCHIVE_TENANT',
            payload: ['tenant_id' => $tenant->tenant_id, 'final_status' => TenantStatus::ARCHIVED->value],
            operation: function () use ($tenant): Tenant {
                if (self::hasActiveContract($tenant->tenant_id)) {
                    throw ValidationException::withMessages([
                        'status' => ['Tenant cannot be archived while an active contract exists.'],
                    ]);
                }

                $tenant->update(['status' => TenantStatus::ARCHIVED]);
                $tenant->delete();

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
            payload: ['tenant_id' => $id],
            operation: function () use ($id): Tenant {
                $tenant = Tenant::withTrashed()->findOrFail($id);

                // Pre-flight: Check that the archived tenant's email is still available.
                // The active_email VIRTUAL column enforces this at DB level, but we surface
                // a clean, actionable error before hitting the constraint.
                $conflicting = Tenant::where('email', $tenant->email)
                    ->whereNull('deleted_at')
                    ->where('tenant_id', '!=', $id)
                    ->first(['tenant_id', 'first_name', 'last_name']);

                if ($conflicting) {
                    throw ValidationException::withMessages([
                        'email' => [
                            "Cannot restore tenant #{$id}: the email address '{$tenant->email}' is already registered " .
                            "to active tenant #{$conflicting->tenant_id} ({$conflicting->first_name} {$conflicting->last_name}). " .
                            "Update that tenant's email first before restoring this record."
                        ],
                    ]);
                }

                $tenant->restore();
                self::syncStatus($id);

                return $tenant->fresh();
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
        return Cache::remember('tenants:summary', 300, function () {
            return [
                'total_records' => Tenant::count(),
                'active_tenants' => Tenant::where('status', TenantStatus::ACTIVE)->count(),
                'new_onboarded_mtd' => Tenant::whereBetween('created_at', [
                    now()->startOfMonth()->toDateTimeString(),
                    now()->endOfMonth()->toDateTimeString(),
                ])->count(),
                'pending_move_outs' => Contract::where('status', ContractStatus::ACTIVE)
                    ->whereNotNull('expected_move_out_date')
                    ->whereBetween('expected_move_out_date', [
                        now()->toDateTimeString(),
                        now()->addDays(30)->toDateTimeString(),
                    ])
                    ->count(),
                'moved_out' => Tenant::where('status', TenantStatus::MOVED_OUT)->count(),
                'archived_count' => Tenant::onlyTrashed()->count(),
            ];
        });
    }

    /**
     * List tenants with pagination and related metadata.
     *
     * @return LengthAwarePaginator
     */
    public static function listPaginated(array $filters = [], int $page = 1, int $perPage = 15)
    {
        $query = $filters['q'] ?? '';
        $status = $filters['status'] ?? '';
        
        $sortByRaw = $filters['sort_by'] ?? null;
        $sortDir = $filters['sort_dir'] ?? 'asc';
        
        $sortBy = match ($sortByRaw) {
            'id' => 'tenants.tenant_id',
            'name' => 'tenants.last_name',
            'room' => 'vw_active_contracts.room_code',
            'balance' => 'outstanding_balance',
            'status' => 'tenants.status',
            default => 'tenants.last_name',
        };

        return self::searchRichBuilder($query, $status, $sortBy, $sortDir)->paginate($perPage, ['*'], 'page', $page);
    }

    /**
     * Retrieve a single tenant record by ID.
     */
    public static function getById(int $id): ?Tenant
    {
        return self::searchRichBuilder(includeTrashed: true)->find($id);
    }

    /**
     * Search tenants including room/bed context and balance.
     *
     * @return Builder<Tenant>
     */
    public static function searchRichBuilder(string $query = '', string $status = '', string $sortBy = 'last_name', string $sortOrder = 'asc', bool $includeTrashed = false): Builder
    {
        $q = Tenant::query();

        if ($status === TenantStatus::ARCHIVED->value || $includeTrashed) {
            $q->withTrashed();
        } else {
            $q->withoutTrashed();
        }

        // Include room, bed, and balance context
        $driver = DB::getDriverName();
        $nowExpr = $driver === 'sqlite' ? "datetime('now')" : 'NOW()';
        $upperExpr = $driver === 'sqlite' ? "datetime('now','+30 day')" : 'DATE_ADD(NOW(), INTERVAL 30 DAY)';

        $q->select('tenants.*')
            ->leftJoin('vw_active_contracts', 'tenants.tenant_id', '=', 'vw_active_contracts.tenant_id')
            ->addSelect(['vw_active_contracts.room_code', 'vw_active_contracts.bed_label'])
            ->leftJoin('vw_billing_summary', 'tenants.tenant_id', '=', 'vw_billing_summary.tenant_id')
            ->addSelect([
                DB::raw('COALESCE(SUM(vw_billing_summary.total_amount - vw_billing_summary.total_paid), 0) as outstanding_balance'),
                DB::raw('(SELECT COUNT(*) FROM contracts WHERE contracts.tenant_id = tenants.tenant_id AND contracts.status = "'.ContractStatus::ACTIVE->value.'" AND contracts.deleted_at IS NULL AND contracts.expected_move_out_date IS NOT NULL AND contracts.expected_move_out_date BETWEEN '.$nowExpr.' AND '.$upperExpr.') as pending_move_outs'),
            ])
            ->groupBy(
                'tenants.tenant_id', 'tenants.first_name', 'tenants.last_name', 'tenants.email',
                'tenants.contact_number', 'tenants.emergency_contact_name', 'tenants.emergency_contact_number',
                'tenants.address', 'tenants.status', 'tenants.created_at', 'tenants.updated_at', 'tenants.deleted_at',
                'vw_active_contracts.room_code', 'vw_active_contracts.bed_label'
            );

        if (! empty($query)) {
            $needle = trim((string) $query);
            $forensicId = OperationalHardening::parseForensicId($needle);

            $q->where(function ($iq) use ($needle, $forensicId) {
                if ($forensicId) {
                    $iq->where('tenants.tenant_id', $forensicId);
                } else {
                    $stripped = ltrim($needle, '#');
                    $iq->where('tenants.first_name', 'LIKE', "%{$stripped}%")
                        ->orWhere('tenants.last_name', 'LIKE', "%{$stripped}%")
                        ->orWhere(DB::raw("CONCAT(tenants.first_name, ' ', tenants.last_name)"), 'LIKE', "%{$stripped}%")
                        ->orWhere('tenants.email', 'LIKE', "%{$stripped}%")
                        ->orWhere('tenants.contact_number', 'LIKE', "%{$stripped}%");
                }
            });
        }

        if (! empty($status)) {
            $q->where('tenants.status', $status);
        }

        return $q->orderBy($sortBy, $sortOrder === 'desc' ? 'desc' : 'asc')
            ->orderBy('tenants.tenant_id', $sortOrder === 'desc' ? 'desc' : 'asc');
    }

    /**
     * Internal: Check if a tenant currently has an active lease agreement.
     */
    public static function hasActiveContract(int $tenantId): bool
    {
        return Contract::query()
            ->where('tenant_id', $tenantId)
            ->where('status', ContractStatus::ACTIVE)
            ->whereNull('deleted_at')
            ->exists();
    }

    public static function syncStatus(int $tenantId): void
    {
        $tenant = Tenant::withTrashed()->find($tenantId);
        if (! $tenant) {
            return;
        }

        // Rule: If it's still soft-deleted, it must remain ARCHIVED status
        if ($tenant->trashed()) {
            if ($tenant->status !== TenantStatus::ARCHIVED) {
                $tenant->update(['status' => TenantStatus::ARCHIVED]);
            }

            return;
        }

        // Level 1: Check for current residency (Active/Pending)
        $hasActive = Contract::where('tenant_id', $tenantId)
            ->whereIn('status', [ContractStatus::ACTIVE, ContractStatus::PENDING_PAYMENT])
            ->whereNull('deleted_at')
            ->exists();

        if ($hasActive) {
            $newStatus = TenantStatus::ACTIVE;
        } else {
            // Level 2: Check for any historical residency (Completed/Terminated/Voided)
            // Rule: VOIDED contracts do not count as residency history (BR-CON-012).
            $hasHistory = Contract::where('tenant_id', $tenantId)
                ->whereIn('status', [ContractStatus::ACTIVE, ContractStatus::PENDING_PAYMENT, ContractStatus::COMPLETED, ContractStatus::TERMINATED])
                ->whereNull('deleted_at')
                ->exists();

            $newStatus = $hasHistory ? TenantStatus::MOVED_OUT : TenantStatus::ONBOARDED;
        }

        if ($tenant->status !== $newStatus) {
            $tenant->update(['status' => $newStatus]);
        }

        self::clearCache();
    }

    /**
     * Clear cached tenant data.
     */
    public static function clearCache(): void
    {
        Cache::forget('tenants:summary');
    }
}
