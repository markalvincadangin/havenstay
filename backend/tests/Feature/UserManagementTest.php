<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * User management — traceability: docs/SRS.md FR-004–007, docs/API_REFERENCE.md (Admin-only user routes).
 */
class UserManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seedRoles();
    }

    /**
     * TC-USER-001: Admin creates user
     */
    public function test_admin_creates_user_with_role(): void
    {
        $adminRole = Role::where('role_name', 'admin')->first();
        $admin = User::factory()->create([
            'role_id' => $adminRole->role_id,
            'is_active' => true,
        ]);

        $staffRole = Role::where('role_name', 'staff')->first();

        $response = $this->actingAs($admin)->postJson('/api/users', [
            'first_name' => 'New',
            'last_name' => 'User',
            'username' => 'newuser',
            'email' => 'newuser@example.com',
            'password' => 'password123',
            'role_id' => $staffRole->role_id,
        ]);

        $response->assertStatus(201);

        $this->assertDatabaseHas('users', [
            'username' => 'newuser',
            'role_id' => $staffRole->role_id,
            'is_active' => true,
        ]);

        // Verify audit log (INSERT)
        $this->assertTriggerAuditLog([
            'user_id' => $admin->user_id,
            'target_table' => 'users',
            'action' => 'INSERT',
        ]);
    }

    /**
     * TC-USER-002: Admin updates user role
     */
    public function test_admin_updates_user_role(): void
    {
        $adminRole = Role::where('role_name', 'admin')->first();
        $admin = User::factory()->create([
            'role_id' => $adminRole->role_id,
            'is_active' => true,
        ]);

        $staffRole = Role::where('role_name', 'staff')->first();
        $viewerRole = Role::where('role_name', 'viewer')->first();

        $user = User::factory()->create(['role_id' => $staffRole->role_id]);

        $response = $this->actingAs($admin)->postJson("/api/users/{$user->user_id}/assign-role", [
            'role_id' => $viewerRole->role_id,
        ]);

        $response->assertStatus(200);

        $user->refresh();
        $this->assertEquals($viewerRole->role_id, $user->role_id);
    }

    /**
     * FR-004: Staff cannot create users
     */
    public function test_staff_cannot_create_users(): void
    {
        $staffRole = Role::where('role_name', 'staff')->first();
        $staff = User::factory()->create([
            'role_id' => $staffRole->role_id,
            'is_active' => true,
        ]);

        $response = $this->actingAs($staff)->postJson('/api/users', [
            'first_name' => 'New',
            'last_name' => 'User',
            'username' => 'staffcreated',
            'email' => 'staffcreated@example.com',
            'password' => 'password123',
            'role_id' => $staffRole->role_id,
        ]);

        $response->assertStatus(403);

        // Verify access_denied audit log
        $this->assertTriggerAuditLog([
            'user_id' => $staff->user_id,
            'action' => 'access_denied',
        ]);
    }

    /**
     * FR-005 / API_REFERENCE: GET /api/users is Admin-only (Staff and Viewer get 403).
     */
    public function test_non_admin_cannot_list_users(): void
    {
        $viewerRole = Role::where('role_name', 'viewer')->first();
        $staffRole = Role::where('role_name', 'staff')->first();

        $viewer = User::factory()->create([
            'role_id' => $viewerRole->role_id,
            'is_active' => true,
        ]);
        $staff = User::factory()->create([
            'role_id' => $staffRole->role_id,
            'is_active' => true,
        ]);

        $this->actingAs($viewer)->getJson('/api/users')->assertForbidden();
        $this->actingAs($staff)->getJson('/api/users')->assertForbidden();
    }

    /**
     * FR-005: Admin can list users.
     */
    public function test_admin_can_list_users(): void
    {
        $adminRole = Role::where('role_name', 'admin')->first();
        $admin = User::factory()->create([
            'role_id' => $adminRole->role_id,
            'is_active' => true,
        ]);

        $this->actingAs($admin)->getJson('/api/users')->assertOk()->assertJsonStructure(['data', 'meta']);
    }

    /**
     * FR-005: GET /api/users/{user} is Admin-only.
     */
    public function test_non_admin_cannot_show_user(): void
    {
        $staffRole = Role::where('role_name', 'staff')->first();
        $staff = User::factory()->create(['role_id' => $staffRole->role_id, 'is_active' => true]);
        $target = User::factory()->create(['role_id' => $staffRole->role_id]);

        $this->actingAs($staff)->getJson("/api/users/{$target->user_id}")->assertForbidden();
    }

    /**
     * FR-005: Admin can fetch a single user.
     */
    public function test_admin_can_show_user(): void
    {
        $adminRole = Role::where('role_name', 'admin')->first();
        $admin = User::factory()->create(['role_id' => $adminRole->role_id, 'is_active' => true]);
        $viewerRole = Role::where('role_name', 'viewer')->first();
        $target = User::factory()->create(['username' => 'targetuser', 'role_id' => $viewerRole->role_id]);

        $this->actingAs($admin)
            ->getJson("/api/users/{$target->user_id}")
            ->assertOk()
            ->assertJsonPath('data.username', 'targetuser');
    }
}
