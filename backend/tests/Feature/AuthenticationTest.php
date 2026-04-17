<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Auth — traceability: docs/SRS.md FR-001–004, docs/TEST_PLAN.md TC-AUTH-*, docs/API_REFERENCE.md.
 */
class AuthenticationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seedRoles();
    }

    /**
     * TC-AUTH-001: Valid admin login
     */
    public function test_valid_admin_login(): void
    {
        $adminRole = Role::where('role_name', 'admin')->first();
        $user = User::factory()->create([
            'username' => 'admin_user',
            'password_hash' => bcrypt('password123'),
            'role_id' => $adminRole->role_id,
            'is_active' => true,
        ]);

        $response = $this->postJson('/api/auth/login', [
            'username' => 'admin_user',
            'password' => 'password123',
        ]);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'message',
                'data' => [
                    'user' => ['user_id', 'username', 'first_name', 'last_name', 'role'],
                    'token',
                ],
            ])
            ->assertJson([
                'message' => 'Authenticated.',
                'data' => [
                    'user' => ['username' => 'admin_user'],
                ],
            ]);

        // Verify audit log entry
        $this->assertTriggerAuditLog([
            'user_id' => $user->user_id,
            'action' => 'login',
        ]);
    }

    /**
     * TC-AUTH-002: Invalid login (wrong credentials)
     */
    public function test_invalid_login_credentials(): void
    {
        $viewerRole = Role::where('role_name', 'viewer')->first();
        User::factory()->create([
            'username' => 'test_user',
            'password_hash' => bcrypt('correct_password'),
            'role_id' => $viewerRole->role_id,
        ]);

        $response = $this->postJson('/api/auth/login', [
            'username' => 'test_user',
            'password' => 'wrong_password',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['username']);
    }

    /**
     * TC-AUTH-003: Deactivated user rejected
     */
    public function test_deactivated_user_cannot_login(): void
    {
        $staffRole = Role::where('role_name', 'staff')->first();
        User::factory()->create([
            'username' => 'inactive_user',
            'password_hash' => bcrypt('password123'),
            'role_id' => $staffRole->role_id,
            'is_active' => false,
        ]);

        $response = $this->postJson('/api/auth/login', [
            'username' => 'inactive_user',
            'password' => 'password123',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['username']);
    }

    /**
     * TC-AUTH: Me endpoint returns authenticated user
     */
    public function test_me_endpoint_returns_user(): void
    {
        $adminRole = Role::where('role_name', 'admin')->first();
        $user = User::factory()->create([
            'role_id' => $adminRole->role_id,
            'is_active' => true,
        ]);

        $response = $this->actingAs($user)->getJson('/api/auth/me');

        $response->assertStatus(200)
            ->assertJson([
                'data' => ['user_id' => $user->user_id],
            ]);
    }

    /**
     * TC-AUTH: Logout event is logged
     */
    public function test_logout_logs_event(): void
    {
        $adminRole = Role::where('role_name', 'admin')->first();
        $user = User::factory()->create([
            'role_id' => $adminRole->role_id,
            'is_active' => true,
        ]);

        $response = $this->actingAs($user)->postJson('/api/auth/logout');

        $response->assertStatus(200)
            ->assertJson(['message' => 'Logged out.']);

        // Verify audit log entry
        $this->assertTriggerAuditLog([
            'user_id' => $user->user_id,
            'action' => 'logout',
        ]);
    }
}
