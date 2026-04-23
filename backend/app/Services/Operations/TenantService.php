<?php
 
 namespace App\Services\Operations;
 
 use App\Services\Concerns\ManagesWorkflows;
 use App\Models\Contract;
 use App\Models\Tenant;
 use App\Models\User;
 use App\Enums\TenantStatus;
 use App\Enums\ContractStatus;
 use Illuminate\Database\Eloquent\Builder;
 use Illuminate\Support\Facades\DB;
 use Illuminate\Validation\ValidationException;
 
 /**
  * TenantService
  * 
  * Orchestrates tenant lifecycle management, identity search, and 
  * status state machine logic.
  * Optimized for HavenStay Forensic v5.0.
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
             payload: [
                 'email' => $data['email'] ?? 'N/A',
                 'name_fact' => ($data['first_name'] ?? '') . ' ' . ($data['last_name'] ?? ''),
             ],
             operation: fn(): Tenant => Tenant::create($data),
             resultDetails: fn(Tenant $tenant): array => ['tenant_id' => $tenant->tenant_id]
         );
     }
 
     /**
      * Update an existing tenant profile.
      * 
      * Forensic Rules:
      * - BR-TEN-004: 'moved_out' state is system-managed; manual setting is blocked.
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
             payload: ['tenant_id' => $tenant->tenant_id, 'email_context' => $tenant->email],
             operation: function () use ($tenant, $data): Tenant {
                 $hasStatusChange = array_key_exists('status', $data) && $data['status'] != $tenant->status;
 
                 if ($hasStatusChange) {
                     $newStatus = $data['status'] instanceof TenantStatus ? $data['status'] : TenantStatus::tryFrom($data['status']);
                     
                     if ($newStatus === TenantStatus::MOVED_OUT) {
                         throw ValidationException::withMessages([
                             'status' => ['Tenant status is system-managed via move-out workflow (BR-TEN-004).'],
                         ]);
                     }
 
                     if (self::hasActiveContract($tenant->tenant_id)) {
                         throw ValidationException::withMessages([
                             'status' => ['Tenant status cannot be changed while an active contract exists.'],
                         ]);
                     }
                 }
 
                 $tenant->update($data);
 
                 return $tenant;
             },
             resultDetails: fn(Tenant $updatedTenant): array => ['tenant_id' => $updatedTenant->tenant_id]
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
      * Reactivate a moved-out or inactive tenant.
      */
     public static function reactivate(User $actor, Tenant $tenant): Tenant
     {
         return self::runWriteWorkflow(
             actorId: $actor->user_id,
             action: 'REACTIVATE_TENANT',
             payload: ['tenant_id' => $tenant->tenant_id],
             operation: function () use ($tenant): Tenant {
                 $tenant->update(['status' => TenantStatus::ACTIVE]);
                 // Ensure state is actually correct post-reactivation
                 self::syncStatus((int)$tenant->tenant_id);
                 return $tenant->fresh();
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
         return [
             'total_records' => Tenant::count(),
             'active_tenants' => Tenant::where('status', TenantStatus::ACTIVE)->count(),
             'pending_move_outs' => Contract::where('status', ContractStatus::ACTIVE)
                 ->whereNotNull('expected_move_out_date')
                 ->whereBetween('expected_move_out_date', [
                     now()->toDateTimeString(),
                     now()->addDays(30)->toDateTimeString()
                 ])
                 ->count(),
             'moved_out' => Tenant::where('status', TenantStatus::MOVED_OUT)->count(),
             'archived' => Tenant::onlyTrashed()->count(),
         ];
     }
 
     /**
      * List tenants with pagination and forensic context.
      * 
      * @param array $filters
      * @param int $page
      * @param int $perPage
      * @return \Illuminate\Contracts\Pagination\LengthAwarePaginator
      */
     public static function listPaginated(array $filters = [], int $page = 1, int $perPage = 15)
     {
         $query = $filters['q'] ?? '';
         $status = $filters['status'] ?? '';
         
         return self::searchRichBuilder($query, $status)->paginate($perPage, ['*'], 'page', $page);
     }
 
     /**
      * Retrieve a single tenant record by ID with forensic context.
      */
     public static function getById(int $id): ?Tenant
     {
         return self::searchRichBuilder()->find($id);
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
                 DB::raw('(SELECT COUNT(*) FROM contracts WHERE contracts.tenant_id = tenants.tenant_id AND contracts.status = "' . ContractStatus::ACTIVE->value . '" AND contracts.deleted_at IS NULL AND contracts.expected_move_out_date IS NOT NULL AND contracts.expected_move_out_date BETWEEN ' . $nowExpr . ' AND ' . $upperExpr . ') as pending_move_outs')
             ])
             ->groupBy(
                 'tenants.tenant_id', 'tenants.first_name', 'tenants.last_name', 'tenants.email', 
                 'tenants.contact_number', 'tenants.emergency_contact_name', 'tenants.emergency_contact_number',
                 'tenants.address', 'tenants.status', 'tenants.created_at', 'tenants.updated_at', 'tenants.deleted_at',
                 'vw_active_contracts.room_code', 'vw_active_contracts.bed_label'
             );
 
         if (!empty($query)) {
             $q->where(function ($iq) use ($query) {
                 $iq->where('tenants.first_name', 'LIKE', "%{$query}%")
                     ->orWhere('tenants.last_name', 'LIKE', "%{$query}%")
                     ->orWhere('tenants.email', 'LIKE', "%{$query}%");
                 if (ctype_digit($query))
                     $iq->orWhere('tenants.tenant_id', (int) $query);
             });
         }
 
         if (!empty($status))
             $q->where('tenants.status', $status);
 
         return $q->orderBy($sortBy, $sortOrder === 'desc' ? 'desc' : 'asc');
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
 
     /**
      * Synchronize a tenant's profile status based on their contract history.
      */
     public static function syncStatus(int $tenantId): void
     {
         $tenant = Tenant::withTrashed()->find($tenantId);
         if (!$tenant) {
             return;
         }
 
         // Rule: If it's still soft-deleted, it must remain ARCHIVED status
         if ($tenant->trashed()) {
             if ($tenant->status !== TenantStatus::ARCHIVED) {
                 $tenant->update(['status' => TenantStatus::ARCHIVED]);
             }
             return;
         }
 
         $hasActive = Contract::where('tenant_id', $tenantId)
             ->whereIn('status', [ContractStatus::ACTIVE, ContractStatus::PENDING_PAYMENT])
             ->exists();
 
         $newStatus = $hasActive ? TenantStatus::ACTIVE : TenantStatus::MOVED_OUT;
 
         if ($tenant->status !== $newStatus) {
             $tenant->update(['status' => $newStatus]);
         }
     }
 }
