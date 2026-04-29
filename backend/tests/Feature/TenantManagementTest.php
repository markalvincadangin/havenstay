<?php

namespace Tests\Feature;

use App\Enums\BedSpaceStatus;
use App\Enums\ContractStatus;
use App\Enums\ContractType;
use App\Enums\RoomStatus;
use App\Enums\RoomType;
use App\Enums\TenantStatus;
use App\Models\BedSpace;
use App\Models\Contract;
use App\Models\Role;
use App\Models\Room;
use App\Models\Tenant;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Tenants — docs/SRS.md FR-008–011, docs/TEST_PLAN.md TC-TENANT-*. */
class TenantManagementTest extends TestCase
{
    use RefreshDatabase;

    private User $adminUser;

    private User $staffUser;

    private User $viewerUser;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seedRoles();

        // Create users
        $adminRole = Role::where('role_name', 'admin')->first();
        $staffRole = Role::where('role_name', 'staff')->first();
        $viewerRole = Role::where('role_name', 'viewer')->first();

        $this->adminUser = User::factory()->create([
            'role_id' => $adminRole->role_id,
            'is_active' => true,
        ]);

        $this->staffUser = User::factory()->create([
            'role_id' => $staffRole->role_id,
            'is_active' => true,
        ]);

        $this->viewerUser = User::factory()->create([
            'role_id' => $viewerRole->role_id,
            'is_active' => true,
        ]);
    }

    /**
     * TC-TENANT-001: Admin creates a tenant
     */
    public function test_admin_creates_tenant_with_all_fields(): void
    {
        $response = $this->actingAs($this->adminUser)->postJson('/api/tenants', [
            'first_name' => 'John',
            'last_name' => 'Doe',
            'contact_number' => '+63912345678',
            'email' => 'john.doe@example.com',
            'emergency_contact_name' => 'Jane Doe',
            'emergency_contact_number' => '+63987654321',
            'address' => '123 Main Street, City',
        ]);

        $response->assertCreated();
        $response->assertJsonStructure(['message', 'data']);

        // Verify tenant stored in database
        $this->assertDatabaseHas('tenants', [
            'first_name' => 'John',
            'last_name' => 'Doe',
            'email' => 'john.doe@example.com',
            'status' => TenantStatus::ACTIVE->value,
        ]);

        // Verify audit log entry (Trigger handles INSERT)
        $this->assertTriggerAuditLog([
            'user_id' => $this->adminUser->user_id,
            'target_table' => 'tenants',
            'action' => 'INSERT',
        ]);
    }

    /**
     * TC-TENANT-001: Viewer cannot create tenants
     */
    public function test_viewer_cannot_create_tenant(): void
    {
        $response = $this->actingAs($this->viewerUser)->postJson('/api/tenants', [
            'first_name' => 'Bob',
            'last_name' => 'Johnson',
            'contact_number' => '+639876543210',
            'email' => 'bob@example.com',
            'emergency_contact_name' => 'Mary Johnson',
            'emergency_contact_number' => '+639112223333',
            'address' => '123 Street, City',
        ]);

        $response->assertForbidden();

        // Verify access_denied audit log (App level log)
        $this->assertTriggerAuditLog([
            'user_id' => $this->viewerUser->user_id,
            'action' => 'access_denied',
        ]);
    }

    /**
     * TC-TENANT-002: Admin updates tenant profile
     */
    public function test_admin_updates_tenant_profile(): void
    {
        $tenant = Tenant::create($this->tenantAttributes([
            'first_name' => 'John',
            'last_name' => 'Doe',
            'contact_number' => '+63912345678',
            'status' => TenantStatus::ACTIVE->value,
        ]));

        $response = $this->actingAs($this->adminUser)->putJson("/api/tenants/{$tenant->tenant_id}", [
            'first_name' => 'John',
            'last_name' => 'Doe',
            'contact_number' => '+63912345678',
            'email' => 'john.new@example.com',
            'emergency_contact_name' => 'Jane Doe',
            'emergency_contact_number' => '+63987654321',
            'address' => '456 Updated Street',
        ]);

        $response->assertOk();

        // Verify update in database
        $this->assertDatabaseHas('tenants', [
            'tenant_id' => $tenant->tenant_id,
            'email' => 'john.new@example.com',
        ]);

        // Verify audit log entry (Trigger handles UPDATE)
        $this->assertTriggerAuditLog([
            'user_id' => $this->adminUser->user_id,
            'target_table' => 'tenants',
            'record_id' => (string) $tenant->tenant_id,
            'action' => 'UPDATE',
        ]);
    }

    /**
     * BR-005b (SRS): Admin cannot manually set status to moved_out
     */
    public function test_manual_status_change_to_moved_out_is_blocked(): void
    {
        $tenant = Tenant::create($this->tenantAttributes([
            'status' => TenantStatus::ACTIVE->value,
        ]));

        $response = $this->actingAs($this->adminUser)->putJson("/api/tenants/{$tenant->tenant_id}", $this->tenantAttributes([
            'status' => TenantStatus::MOVED_OUT->value,
        ]));

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['status']);

        $this->assertDatabaseHas('tenants', [
            'tenant_id' => $tenant->tenant_id,
            'status' => TenantStatus::ACTIVE->value,
        ]);
    }

    public function test_status_update_is_blocked_when_tenant_has_active_contract(): void
    {
        $tenant = Tenant::create($this->tenantAttributes([
            'first_name' => 'Guard',
            'last_name' => 'Status',
            'contact_number' => '+639171111111',
            'status' => TenantStatus::ACTIVE->value,
        ]));
        $this->createActiveContractForTenant($tenant);

        $response = $this->actingAs($this->adminUser)->putJson("/api/tenants/{$tenant->tenant_id}", [
            'first_name' => $tenant->first_name,
            'last_name' => $tenant->last_name,
            'contact_number' => $tenant->contact_number,
            'email' => $tenant->email,
            'emergency_contact_name' => $tenant->emergency_contact_name,
            'emergency_contact_number' => $tenant->emergency_contact_number,
            'address' => $tenant->address,
            'status' => TenantStatus::ARCHIVED->value,
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['status']);
        $this->assertDatabaseHas('tenants', [
            'tenant_id' => $tenant->tenant_id,
            'status' => TenantStatus::ACTIVE->value,
        ]);
    }

    public function test_archive_is_blocked_when_tenant_has_active_contract(): void
    {
        $tenant = Tenant::create($this->tenantAttributes([
            'first_name' => 'Archive',
            'last_name' => 'Blocked',
            'contact_number' => '+639172222222',
            'status' => TenantStatus::ACTIVE->value,
        ]));
        $this->createActiveContractForTenant($tenant);

        $response = $this->actingAs($this->adminUser)->postJson("/api/tenants/{$tenant->tenant_id}/archive");

        $response->assertStatus(422);
        $this->assertDatabaseHas('tenants', [
            'tenant_id' => $tenant->tenant_id,
            'deleted_at' => null,
        ]);
    }

    public function test_archive_succeeds_when_tenant_has_no_active_contract(): void
    {
        $tenant = Tenant::create($this->tenantAttributes([
            'first_name' => 'Archive',
            'last_name' => 'Allowed',
            'contact_number' => '+639173333333',
            'status' => TenantStatus::ARCHIVED->value,
        ]));

        $response = $this->actingAs($this->adminUser)->postJson("/api/tenants/{$tenant->tenant_id}/archive");

        $response->assertOk();
        $this->assertSoftDeleted('tenants', ['tenant_id' => $tenant->tenant_id]);
        $this->assertDatabaseHas('tenants', [
            'tenant_id' => $tenant->tenant_id,
            'status' => TenantStatus::ARCHIVED->value,
        ]);
    }

    public function test_restore_sets_tenant_to_moved_out_if_no_active_contract(): void
    {
        $tenant = Tenant::create($this->tenantAttributes([
            'first_name' => 'Restore',
            'last_name' => 'Lifecycle',
            'status' => TenantStatus::ARCHIVED->value,
        ]));
        $tenant->delete();

        $response = $this->actingAs($this->adminUser)->postJson("/api/tenants/{$tenant->tenant_id}/restore");

        $response->assertOk();
        $this->assertDatabaseHas('tenants', [
            'tenant_id' => $tenant->tenant_id,
            'deleted_at' => null,
            'status' => TenantStatus::MOVED_OUT->value,
        ]);
    }

    public function test_restore_sets_tenant_to_active_if_has_active_contract(): void
    {
        $tenant = Tenant::create($this->tenantAttributes([
            'status' => TenantStatus::ARCHIVED->value,
        ]));
        $this->createActiveContractForTenant($tenant);
        $tenant->delete();

        $response = $this->actingAs($this->adminUser)->postJson("/api/tenants/{$tenant->tenant_id}/restore");

        $response->assertOk();
        $this->assertDatabaseHas('tenants', [
            'tenant_id' => $tenant->tenant_id,
            'deleted_at' => null,
            'status' => TenantStatus::ACTIVE->value,
        ]);
    }

    public function test_tenant_summary_returns_global_counts(): void
    {
        $tenantWithPendingMoveOut = Tenant::create($this->tenantAttributes([
            'first_name' => 'Pending',
            'last_name' => 'Tenant',
            'contact_number' => '+639174444444',
            'status' => TenantStatus::ACTIVE->value,
            'email' => 'pending@example.com',
        ]));
        $tenantWithoutPending = Tenant::create($this->tenantAttributes([
            'first_name' => 'Stable',
            'last_name' => 'Tenant',
            'contact_number' => '+639175555555',
            'status' => TenantStatus::ACTIVE->value,
            'email' => 'stable@example.com',
        ]));
        Tenant::create($this->tenantAttributes([
            'first_name' => 'Moved',
            'last_name' => 'Tenant',
            'contact_number' => '+639176666666',
            'status' => TenantStatus::MOVED_OUT->value,
            'email' => 'moved@example.com',
        ]));

        $this->createActiveContractForTenant(
            $tenantWithPendingMoveOut,
            Carbon::now()->subDays(15),
            Carbon::now()->addDays(10)
        );
        $this->createActiveContractForTenant(
            $tenantWithoutPending,
            Carbon::now()->subDays(60),
            Carbon::now()->addDays(60)
        );

        $response = $this->actingAs($this->adminUser)->getJson('/api/tenants/summary');

        $response->assertOk();
        $response->assertJsonPath('data.active_tenants', 2);
        $response->assertJsonPath('data.pending_move_outs', 1);
    }

    public function test_index_returns_rich_fields_for_tenant_directory(): void
    {
        $tenant = Tenant::create($this->tenantAttributes([
            'first_name' => 'Directory',
            'last_name' => 'Row',
            'contact_number' => '+639178888888',
            'email' => 'directory.row@example.com',
            'status' => TenantStatus::ACTIVE->value,
        ]));
        $this->createActiveContractForTenant($tenant);

        $response = $this->actingAs($this->adminUser)->getJson('/api/tenants');

        $response->assertOk();
        $response->assertJsonStructure([
            'data' => [[
                'tenant_id',
                'room_code',
                'bed_label',
                'outstanding_balance',
            ]],
            'meta',
        ]);
    }

    public function test_index_pending_move_outs_excludes_soft_deleted_contracts(): void
    {
        $tenant = Tenant::create($this->tenantAttributes([
            'first_name' => 'Pending',
            'last_name' => 'SoftDelete',
            'contact_number' => '+6391888999011',
            'email' => 'pending.softdelete@example.com',
            'status' => TenantStatus::ACTIVE->value,
        ]));
        $contract = $this->createActiveContractForTenant(
            $tenant,
            Carbon::now()->subDays(10),
            Carbon::now()->addDays(5)
        );
        $contract->delete();

        $response = $this->actingAs($this->adminUser)->getJson('/api/tenants');
        $response->assertOk();

        $row = collect($response->json('data'))
            ->firstWhere('tenant_id', $tenant->tenant_id);
        $this->assertNotNull($row);
        $this->assertSame(0, (int) ($row['pending_move_outs'] ?? -1));
    }

    public function test_index_rejects_unknown_status_filter(): void
    {
        $response = $this->actingAs($this->adminUser)->getJson('/api/tenants?status=invalid_status');

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['status']);
    }

    public function test_search_rejects_unknown_status_filter(): void
    {
        $response = $this->actingAs($this->adminUser)->getJson('/api/tenants/search?status=invalid_status');

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['status']);
    }

    /**
     * TC-PII-001 — NFR-015: Viewer receives masked tenant PII in API responses.
     */
    public function test_viewer_sees_masked_tenant_pii_on_show(): void
    {
        $tenant = Tenant::create($this->tenantAttributes([
            'first_name' => 'PII',
            'last_name' => 'Viewer',
            'contact_number' => '+6391999888777',
            'email' => 'pii.viewer@example.com',
            'emergency_contact_name' => 'Emergency Contact',
            'emergency_contact_number' => '+6391777888999',
            'address' => '123 Confidential Road',
        ]));

        $response = $this->actingAs($this->viewerUser)->getJson("/api/tenants/{$tenant->tenant_id}");

        $response->assertOk();
        $data = $response->json('data');
        $this->assertSame('Redacted', $data['address']);
        $this->assertSame('Redacted', $data['emergency_contact_name']);
        $this->assertSame('***', $data['emergency_contact_number']);
        $this->assertStringContainsString('***@', (string) $data['email']);
        $this->assertSame('***-***-8777', $data['contact_number']);
    }

    public function test_viewer_sees_masked_tenant_pii_on_index_and_search(): void
    {
        $tenant = Tenant::create($this->tenantAttributes([
            'first_name' => 'Viewer',
            'last_name' => 'Masked',
            'contact_number' => '+6391888999000',
            'email' => 'viewer.masked@example.com',
            'emergency_contact_name' => 'Emergency Contact',
            'emergency_contact_number' => '+6391777888999',
            'address' => '456 Sensitive Street',
        ]));

        $indexResponse = $this->actingAs($this->viewerUser)->getJson('/api/tenants');
        $indexResponse->assertOk();
        $indexRow = collect($indexResponse->json('data'))
            ->firstWhere('tenant_id', $tenant->tenant_id);

        $this->assertNotNull($indexRow);
        $this->assertSame('Redacted', $indexRow['address']);
        $this->assertSame('Redacted', $indexRow['emergency_contact_name']);
        $this->assertSame('***', $indexRow['emergency_contact_number']);
        $this->assertStringContainsString('***@', (string) $indexRow['email']);
        $this->assertSame('***-***-9000', $indexRow['contact_number']);

        $searchResponse = $this->actingAs($this->viewerUser)->getJson('/api/tenants/search?q=Viewer');
        $searchResponse->assertOk();
        $searchRow = collect($searchResponse->json('data'))
            ->firstWhere('tenant_id', $tenant->tenant_id);

        $this->assertNotNull($searchRow);
        $this->assertSame('Redacted', $searchRow['address']);
        $this->assertSame('Redacted', $searchRow['emergency_contact_name']);
        $this->assertSame('***', $searchRow['emergency_contact_number']);
        $this->assertStringContainsString('***@', (string) $searchRow['email']);
        $this->assertSame('***-***-9000', $searchRow['contact_number']);
    }

    /**
     * TC-PII-001 — Admin continues to receive full tenant attributes.
     */
    public function test_admin_sees_unmasked_tenant_pii_on_show(): void
    {
        $tenant = Tenant::create($this->tenantAttributes([
            'first_name' => 'PII',
            'last_name' => 'Admin',
            'contact_number' => '+6391999888777',
            'email' => 'pii.admin@example.com',
            'emergency_contact_name' => 'Emergency Contact',
            'emergency_contact_number' => '+6391777888999',
            'address' => '123 Confidential Road',
        ]));

        $response = $this->actingAs($this->adminUser)->getJson("/api/tenants/{$tenant->tenant_id}");

        $response->assertOk();
        $data = $response->json('data');
        $this->assertSame('123 Confidential Road', $data['address']);
        $this->assertSame('Emergency Contact', $data['emergency_contact_name']);
        $this->assertSame('pii.admin@example.com', $data['email']);
    }

    private function createActiveContractForTenant(
        Tenant $tenant,
        ?Carbon $moveInDate = null,
        ?Carbon $expectedMoveOutDate = null
    ): Contract {
        $room = Room::create([
            'room_code' => 'UT-'.mt_rand(1000, 9999),
            'room_type' => RoomType::SHARED->value,
            'capacity' => 2,
            'monthly_rate' => 5000.00,
            'status' => RoomStatus::AVAILABLE->value,
        ]);

        $bed = BedSpace::create([
            'room_id' => $room->room_id,
            'bed_label' => 'Bed A',
            'status' => BedSpaceStatus::OCCUPIED->value,
        ]);

        return Contract::create([
            'tenant_id' => $tenant->tenant_id,
            'bed_space_id' => $bed->bed_space_id,
            'created_by' => $this->adminUser->user_id,
            'move_in_date' => ($moveInDate ?? Carbon::now()->subMonths(1))->toDateString(),
            'expected_move_out_date' => ($expectedMoveOutDate ?? Carbon::now()->addMonths(1))->toDateString(),
            'deposit_amount' => 5000.00,
            'monthly_rate' => 5000.00,
            'monthly_rate_override' => 5000.00,
            'contract_type' => ContractType::FIXED_TERM->value,
            'status' => ContractStatus::ACTIVE->value,
        ]);
    }

    protected function tenantAttributes(array $overrides = []): array
    {
        return array_merge([
            'first_name' => 'Test',
            'last_name' => 'Tenant',
            'contact_number' => '+639123456789',
            'email' => 'test@example.com',
            'emergency_contact_name' => 'Test Emergency Contact',
            'emergency_contact_number' => '+639000000001',
            'address' => '123 Test Street, Quezon City',
            'status' => TenantStatus::ACTIVE->value,
        ], $overrides);
    }
}
