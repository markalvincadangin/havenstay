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
            // High-Performance Industry Pattern: Compute all aggregates in a single database pass.
            $stats = DB::table('tenants')
                ->selectRaw("
                    COUNT(*) as total_records,
                    SUM(CASE WHEN status = ? AND deleted_at IS NULL THEN 1 ELSE 0 END) as active_tenants,
                    SUM(CASE WHEN status = ? AND deleted_at IS NULL THEN 1 ELSE 0 END) as moved_out,
                    SUM(CASE WHEN created_at BETWEEN ? AND ? AND deleted_at IS NULL THEN 1 ELSE 0 END) as new_onboarded_mtd,
                    SUM(CASE WHEN deleted_at IS NOT NULL THEN 1 ELSE 0 END) as archived_count
                ", [
                    TenantStatus::ACTIVE->value,
                    TenantStatus::MOVED_OUT->value,
                    now()->startOfMonth()->toDateTimeString(),
                    now()->endOfMonth()->toDateTimeString(),
                ])
                ->first();

            // Pending move-outs is a separate table, so it remains a single optimized hit.
            $pendingExits = Contract::where('status', ContractStatus::ACTIVE)
                ->whereNotNull('expected_move_out_date')
                ->whereBetween('expected_move_out_date', [
                    now()->toDateTimeString(),
                    now()->addDays(30)->toDateTimeString(),
                ])
                ->count();

            return [
                'total_records' => (int) ($stats->total_records ?? 0),
                'active_tenants' => (int) ($stats->active_tenants ?? 0),
                'new_onboarded_mtd' => (int) ($stats->new_onboarded_mtd ?? 0),
                'pending_move_outs' => $pendingExits,
                'moved_out' => (int) ($stats->moved_out ?? 0),
                'archived_count' => (int) ($stats->archived_count ?? 0),
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

        // Clean Industry Pattern: Delegate query construction to Model Scopes
        $q->select('tenants.*')
            ->withActiveContractContext()
            ->withOutstandingBalance();

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
                        ->orWhere('tenants.email', 'LIKE', "%{$stripped}%")
                        ->orWhere('tenants.contact_number', 'LIKE', "%{$stripped}%");
                }
            });
        }

        if (! empty($status)) {
            $q->where('tenants.status', $status);
        }

        // Primary sort
        $q->orderBy($sortBy, $sortOrder === 'desc' ? 'desc' : 'asc');
        
        // Tie-breaker
        return $q->orderBy('tenants.tenant_id', $sortOrder === 'desc' ? 'desc' : 'asc');
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
     * High-Performance Existence Check (Deterministic Matching).
     * Scans for duplicates across both active and archived records.
     *
     * @return array{exists: bool, status: ?string, tenant_id: ?int, match_type: ?string}
     */
    public static function checkExistence(array $data): array
    {
        $firstName = trim($data['first_name'] ?? '');
        $lastName = trim($data['last_name'] ?? '');
        $email = trim($data['email'] ?? '');
        $phone = trim($data['contact_number'] ?? '');

        // 1. Email check (Highest Confidence)
        if (! empty($email)) {
            $match = Tenant::withTrashed()->where('email', $email)->first(['tenant_id', 'status', 'deleted_at']);
            if ($match) {
                return [
                    'exists' => true,
                    'status' => $match->trashed() ? 'archived' : $match->status->value,
                    'tenant_id' => $match->tenant_id,
                    'match_type' => 'email',
                ];
            }
        }

        // 2. Phone check (High Confidence)
        if (! empty($phone)) {
            $match = Tenant::withTrashed()->where('contact_number', $phone)->first(['tenant_id', 'status', 'deleted_at']);
            if ($match) {
                return [
                    'exists' => true,
                    'status' => $match->trashed() ? 'archived' : $match->status->value,
                    'tenant_id' => $match->tenant_id,
                    'match_type' => 'phone',
                ];
            }
        }

        // 3. Name check (Identity Warning)
        if (! empty($firstName) && ! empty($lastName)) {
            $match = Tenant::withTrashed()
                ->where('first_name', $firstName)
                ->where('last_name', $lastName)
                ->first(['tenant_id', 'status', 'deleted_at']);
            if ($match) {
                return [
                    'exists' => true,
                    'status' => $match->trashed() ? 'archived' : $match->status->value,
                    'tenant_id' => $match->tenant_id,
                    'match_type' => 'name',
                ];
            }
        }

        return ['exists' => false];
    }

    /**
     * Clear cached tenant data.
     */
    public static function clearCache(): void
    {
        Cache::forget('tenants:summary');
    }
}
