<?php

namespace Tests\Feature;

use App\Models\BedSpace;
use App\Models\Contract;
use App\Models\Role;
use App\Models\Room;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Rooms / bed spaces — docs/SRS.md FR-012–015, docs/TEST_PLAN.md TC-ROOM-*. */
class RoomManagementTest extends TestCase
{
    use RefreshDatabase;

    private User $adminUser;

    private User $staffUser;

    private User $viewerUser;

    protected function setUp(): void
    {
        parent::setUp();

        // Create roles in lowercase
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
     * TC-ROOM-001: Admin creates a room
     */
    public function test_admin_creates_room_with_valid_capacity_and_rate(): void
    {
        $response = $this->actingAs($this->adminUser)->postJson('/api/rooms', [
            'room_code' => '101',
            'room_type' => 'solo',
            'capacity' => 1,
            'monthly_rate' => 5000.00,
            'status' => 'vacant',
            'amenities' => 'Air conditioning, Free WiFi',
            'description' => 'Single occupancy room',
        ]);

        $response->assertCreated();
        $response->assertJsonStructure(['message', 'data']);

        // Verify room stored in database
        $this->assertDatabaseHas('rooms', [
            'room_code' => '101',
            'room_type' => 'solo',
            'capacity' => 1,
            'monthly_rate' => 5000.00,
            'status' => 'vacant',
        ]);

        // Verify audit log entry for INSERT action (Trigger)
        $this->assertTriggerAuditLog([
            'user_id' => $this->adminUser->user_id,
            'target_table' => 'rooms',
            'action' => 'INSERT',
        ]);
    }

    /**
     * TC-ROOM-001: Viewer cannot create rooms
     */
    public function test_viewer_cannot_create_room(): void
    {
        $response = $this->actingAs($this->viewerUser)->postJson('/api/rooms', [
            'room_code' => '301',
            'room_type' => 'solo',
            'capacity' => 1,
            'monthly_rate' => 5000.00,
        ]);

        $response->assertForbidden();

        // Verify access_denied audit log
        $this->assertTriggerAuditLog([
            'user_id' => $this->viewerUser->user_id,
            'action' => 'access_denied',
        ]);
    }

    /**
     * TC-BED-001: Admin adds bed spaces for a shared room
     */
    public function test_admin_adds_bed_spaces_for_shared_room(): void
    {
        $room = Room::create([
            'room_code' => '201',
            'room_type' => 'shared',
            'capacity' => 2,
            'monthly_rate' => 3000.00,
            'status' => 'vacant',
        ]);

        // Add first bed space
        $response1 = $this->actingAs($this->adminUser)->postJson("/api/rooms/{$room->room_id}/bed-spaces", [
            'bed_label' => 'Bed A',
        ]);

        $response1->assertCreated();
        $this->assertDatabaseHas('bed_spaces', [
            'room_id' => $room->room_id,
            'bed_label' => 'Bed A',
            'status' => 'vacant',
        ]);

        // Verify audit log for INSERT action
        $this->assertTriggerAuditLog([
            'user_id' => $this->adminUser->user_id,
            'target_table' => 'bed_spaces',
            'action' => 'INSERT',
        ]);
    }

    /**
     * TC-BED-002: Prevent double occupancy
     */
    public function test_prevent_double_occupancy_assignment(): void
    {
        $room = Room::create([
            'room_code' => '203',
            'room_type' => 'shared',
            'capacity' => 2,
            'monthly_rate' => 3000.00,
            'status' => 'vacant',
        ]);

        $bedSpace = BedSpace::create([
            'room_id' => $room->room_id,
            'bed_label' => 'Bed A',
            'status' => 'vacant',
        ]);

        // First occupancy - should succeed
        $response1 = $this->actingAs($this->adminUser)->postJson("/api/rooms/bed-spaces/{$bedSpace->bed_space_id}/occupy");

        $response1->assertOk();
        $this->assertDatabaseHas('bed_spaces', [
            'bed_space_id' => $bedSpace->bed_space_id,
            'status' => 'occupied',
        ]);

        // Verify audit log for UPDATE action
        $this->assertTriggerAuditLog([
            'user_id' => $this->adminUser->user_id,
            'target_table' => 'bed_spaces',
            'record_id' => (string) $bedSpace->bed_space_id,
            'action' => 'UPDATE',
        ]);

        // Second occupancy - should fail with 409 (conflict)
        $response2 = $this->actingAs($this->adminUser)->postJson("/api/rooms/bed-spaces/{$bedSpace->bed_space_id}/occupy");

        $response2->assertConflict();
    }

    public function test_archive_is_blocked_when_room_has_occupied_bed(): void
    {
        $room = Room::create([
            'room_code' => 'HS-901',
            'room_type' => 'solo',
            'capacity' => 1,
            'monthly_rate' => 7000.00,
            'status' => 'fully_occupied',
        ]);

        BedSpace::create([
            'room_id' => $room->room_id,
            'bed_label' => 'Solo Bed',
            'status' => 'occupied',
        ]);

        $response = $this->actingAs($this->adminUser)->postJson("/api/rooms/{$room->room_id}/archive");

        $response->assertStatus(422);
        $response->assertJsonValidationErrors('room');

        $this->assertNull($room->fresh()->deleted_at);
    }

    public function test_archive_is_blocked_when_room_has_active_contract(): void
    {
        $room = Room::create([
            'room_code' => 'HS-902',
            'room_type' => 'solo',
            'capacity' => 1,
            'monthly_rate' => 7200.00,
            'status' => 'vacant',
        ]);

        $bedSpace = BedSpace::create([
            'room_id' => $room->room_id,
            'bed_label' => 'Solo Bed',
            'status' => 'vacant',
        ]);

        $tenant = Tenant::create($this->tenantAttributes([
            'first_name' => 'Archive',
            'last_name' => 'Blocked',
            'email' => 'archive.blocked@example.com',
            'contact_number' => '09170000000',
            'status' => 'active',
        ]));

        Contract::create([
            'tenant_id' => $tenant->tenant_id,
            'bed_space_id' => $bedSpace->bed_space_id,
            'created_by' => $this->adminUser->user_id,
            'move_in_date' => now()->subDays(3)->toDateString(),
            'expected_move_out_date' => now()->addMonths(6)->toDateString(),
            'deposit_amount' => 2000.00,
            'monthly_rate' => 7200.00,
            'status' => 'active',
        ]);

        $response = $this->actingAs($this->adminUser)->postJson("/api/rooms/{$room->room_id}/archive");

        $response->assertStatus(422);
        $response->assertJsonValidationErrors('room');

        $this->assertNull($room->fresh()->deleted_at);
    }

    public function test_archive_succeeds_when_room_has_no_occupied_bed_or_active_contract(): void
    {
        $room = Room::create([
            'room_code' => 'HS-903',
            'room_type' => 'shared',
            'capacity' => 2,
            'monthly_rate' => 5000.00,
            'status' => 'vacant',
        ]);

        BedSpace::create([
            'room_id' => $room->room_id,
            'bed_label' => 'Bed A',
            'status' => 'vacant',
        ]);

        BedSpace::create([
            'room_id' => $room->room_id,
            'bed_label' => 'Bed B',
            'status' => 'maintenance',
        ]);

        $response = $this->actingAs($this->adminUser)->postJson("/api/rooms/{$room->room_id}/archive");

        $response->assertOk();
        $this->assertNotNull($room->fresh()->deleted_at);
    }

    public function test_admin_can_update_room_code_with_unique_constraint(): void
    {
        $room = Room::create([
            'room_code' => 'HS-910',
            'room_type' => 'solo',
            'capacity' => 1,
            'monthly_rate' => 5000.00,
            'status' => 'vacant',
        ]);

        Room::create([
            'room_code' => 'HS-911',
            'room_type' => 'solo',
            'capacity' => 1,
            'monthly_rate' => 5200.00,
            'status' => 'vacant',
        ]);

        $ok = $this->actingAs($this->adminUser)->putJson("/api/rooms/{$room->room_id}", [
            'room_code' => 'HS-912',
        ]);
        $ok->assertOk();
        $this->assertDatabaseHas('rooms', [
            'room_id' => $room->room_id,
            'room_code' => 'HS-912',
        ]);

        $conflict = $this->actingAs($this->adminUser)->putJson("/api/rooms/{$room->room_id}", [
            'room_code' => 'HS-911',
        ]);
        $conflict->assertStatus(422);
        $conflict->assertJsonValidationErrors('room_code');
    }
}
