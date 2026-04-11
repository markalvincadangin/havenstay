<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\Tenant;
use App\Models\User;
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
        $response->assertJsonStructure(['message', 'tenant']);

        // Verify tenant stored in database
        $this->assertDatabaseHas('tenants', [
            'first_name' => 'John',
            'last_name' => 'Doe',
            'email' => 'john.doe@example.com',
            'status' => 'active',
        ]);

        // Verify audit log entry (Trigger handles INSERT)
        $this->assertTriggerAuditLog([
            'user_id' => $this->adminUser->user_id,
            'entity_name' => 'tenants',
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
        ]);

        $response->assertForbidden();

        // Verify access_denied audit log (App level log)
        $this->assertDatabaseHas('audit_logs', [
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
            'status' => 'active',
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
            'entity_name' => 'tenants',
            'entity_id' => (string) $tenant->tenant_id,
            'action' => 'UPDATE',
        ]);
    }

    /**
     * TC-TENANT-002: Admin deactivates a tenant
     */
    public function test_admin_deactivates_tenant(): void
    {
        $tenant = Tenant::create($this->tenantAttributes([
            'first_name' => 'John',
            'last_name' => 'Doe',
            'contact_number' => '+63912345678',
            'status' => 'active',
        ]));

        $response = $this->actingAs($this->adminUser)->postJson("/api/tenants/{$tenant->tenant_id}/deactivate");

        $response->assertOk();

        // Verify status changed to moved_out
        $this->assertDatabaseHas('tenants', [
            'tenant_id' => $tenant->tenant_id,
            'status' => 'moved_out',
        ]);
    }
}
