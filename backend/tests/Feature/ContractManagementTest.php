<?php

namespace Tests\Feature;

use App\Models\BedSpace;
use App\Models\Contract;
use App\Models\Role;
use App\Models\Room;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Contract workflows — traceability: docs/SRS.md FR-016–FR-019, docs/TEST_PLAN.md TC-CONTRACT-*.
 */
class ContractManagementTest extends TestCase
{
    use RefreshDatabase;

    private User $adminUser;

    private User $staffUser;

    private User $viewerUser;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seedRoles();

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
     * TC-CONTRACT-001: Create contract
     */
    public function test_create_contract(): void
    {
        $tenant = $this->createTenant('active');
        $room = $this->createRoom('shared', 'R301', 2, 'available');
        $bedSpace = BedSpace::create([
            'room_id' => $room->room_id,
            'bed_label' => 'Bed A',
            'status' => 'vacant',
        ]);

        $response = $this->actingAs($this->adminUser)->postJson('/api/contracts', [
            'tenant_id' => $tenant->tenant_id,
            'room_id' => $room->room_id,
            'bed_space_id' => $bedSpace->bed_space_id,
            'move_in_date' => '2026-03-01',
            'expected_move_out' => '2026-06-01',
            'deposit_amount' => 1500,
            'notes' => 'Initial contract',
        ]);

        $response->assertCreated();

        $this->assertDatabaseHas('contracts', [
            'tenant_id' => $tenant->tenant_id,
            'bed_space_id' => $bedSpace->bed_space_id,
            'status' => 'active',
        ]);

        // room_id was removed from contracts table in hardened schema
        $this->assertDatabaseMissing('contracts', ['room_id' => $room->room_id]);

        // Verify bed space status update
        $this->assertDatabaseHas('bed_spaces', [
            'bed_space_id' => $bedSpace->bed_space_id,
            'status' => 'occupied',
        ]);

        // Verify audit log entry (Trigger handles INSERT)
        $this->assertTriggerAuditLog([
            'user_id' => $this->adminUser->user_id,
            'entity_name' => 'contracts',
            'action' => 'INSERT',
        ]);
    }

    /**
     * TC-CONTRACT-003: Move-out success
     * TC-TX-004: `transaction_logs` committed row for `tenant_move_out` (CCR-007)
     */
    public function test_move_out_success(): void
    {
        $tenant = $this->createTenant('active');
        $room = $this->createRoom('solo', 'R501', 1, 'occupied');
        $bedSpace = BedSpace::create([
            'room_id' => $room->room_id,
            'bed_label' => 'Solo Bed',
            'status' => 'occupied',
        ]);

        $contract = Contract::create([
            'tenant_id' => $tenant->tenant_id,
            'bed_space_id' => $bedSpace->bed_space_id,
            'created_by' => $this->adminUser->user_id,
            'move_in_date' => '2026-02-01',
            'deposit_amount' => 900,
            'status' => 'active',
        ]);

        $response = $this->actingAs($this->staffUser)->postJson("/api/contracts/{$contract->contract_id}/move-out", [
            'actual_move_out' => '2026-03-15',
            'notes' => 'Completed stay',
        ]);

        $response->assertOk();
        $this->assertDatabaseHas('contracts', [
            'contract_id' => $contract->contract_id,
            'status' => 'completed',
            'actual_move_out_date' => '2026-03-15 00:00:00',
        ]);

        // Verify bed space becomes vacant
        $this->assertDatabaseHas('bed_spaces', [
            'bed_space_id' => $bedSpace->bed_space_id,
            'status' => 'vacant',
        ]);

        // Verify audit log entry for UPDATE
        $this->assertTriggerAuditLog([
            'user_id' => $this->staffUser->user_id,
            'entity_name' => 'contracts',
            'entity_id' => (string) $contract->contract_id,
            'action' => 'UPDATE',
        ]);

        // TC-TX-004: Move-out workflow logs committed transaction (FR-034, CCR-007)
        $this->assertDatabaseHas('transaction_logs', [
            'tx_name' => 'tenant_move_out',
            'status' => 'committed',
            'reference_entity' => 'contracts',
            'reference_id' => (string) $contract->contract_id,
            'initiated_by' => $this->staffUser->user_id,
        ]);
    }

    /**
     * TC-TX-006: Move-out validation failure — no tenant_move_out log (validation runs before logStarted).
     */
    public function test_move_out_invalid_date_does_not_create_tenant_move_out_log(): void
    {
        $tenant = $this->createTenant('active');
        $room = $this->createRoom('solo', 'R503', 1, 'occupied');
        $bedSpace = BedSpace::create([
            'room_id' => $room->room_id,
            'bed_label' => 'Solo Bed',
            'status' => 'occupied',
        ]);

        $contract = Contract::create([
            'tenant_id' => $tenant->tenant_id,
            'bed_space_id' => $bedSpace->bed_space_id,
            'created_by' => $this->adminUser->user_id,
            'move_in_date' => '2026-02-01',
            'deposit_amount' => 900,
            'status' => 'active',
        ]);

        $countBefore = DB::table('transaction_logs')->where('tx_name', 'tenant_move_out')->count();

        $response = $this->actingAs($this->staffUser)->postJson("/api/contracts/{$contract->contract_id}/move-out", [
            'actual_move_out' => '2026-01-15',
            'notes' => 'Before move-in',
        ]);

        $response->assertUnprocessable();
        $this->assertSame(
            $countBefore,
            DB::table('transaction_logs')->where('tx_name', 'tenant_move_out')->count()
        );
    }

    /**
     * TC-CONTRACT-002 / FR-017: One active contract per tenant.
     */
    public function test_tc_contract_002_tenant_overlap_prevention(): void
    {
        $tenant = $this->createTenant('active');
        $roomA = $this->createRoom('shared', 'R-TC002-A', 2, 'available');
        $bedA = BedSpace::create([
            'room_id' => $roomA->room_id,
            'bed_label' => 'A1',
            'status' => 'vacant',
        ]);

        $this->actingAs($this->adminUser)->postJson('/api/contracts', [
            'tenant_id' => $tenant->tenant_id,
            'room_id' => $roomA->room_id,
            'bed_space_id' => $bedA->bed_space_id,
            'move_in_date' => '2026-03-01',
        ])->assertCreated();

        $roomB = $this->createRoom('shared', 'R-TC002-B', 2, 'available');
        $bedB = BedSpace::create([
            'room_id' => $roomB->room_id,
            'bed_label' => 'B1',
            'status' => 'vacant',
        ]);

        $response = $this->actingAs($this->staffUser)->postJson('/api/contracts', [
            'tenant_id' => $tenant->tenant_id,
            'room_id' => $roomB->room_id,
            'bed_space_id' => $bedB->bed_space_id,
            'move_in_date' => '2026-04-01',
        ]);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['tenant_id']);
        $this->assertStringContainsString(
            'active contract',
            strtolower($response->json('errors.tenant_id.0') ?? '')
        );
    }

    /**
     * TC-CONTRACT-004 / FR-017: One active contract per bed space (bed must be vacant).
     */
    public function test_tc_contract_004_bed_space_overlap_prevention(): void
    {
        $tenantA = $this->createTenant('active');
        $tenantB = $this->createTenant('active');
        $room = $this->createRoom('shared', 'R-TC004', 2, 'available');
        $bed = BedSpace::create([
            'room_id' => $room->room_id,
            'bed_label' => 'X1',
            'status' => 'vacant',
        ]);

        $this->actingAs($this->adminUser)->postJson('/api/contracts', [
            'tenant_id' => $tenantA->tenant_id,
            'room_id' => $room->room_id,
            'bed_space_id' => $bed->bed_space_id,
            'move_in_date' => '2026-03-01',
        ])->assertCreated();

        $response = $this->actingAs($this->staffUser)->postJson('/api/contracts', [
            'tenant_id' => $tenantB->tenant_id,
            'room_id' => $room->room_id,
            'bed_space_id' => $bed->bed_space_id,
            'move_in_date' => '2026-04-01',
        ]);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['bed_space_id']);
    }

    private function createTenant(string $status = 'active'): Tenant
    {
        return Tenant::create($this->tenantAttributes([
            'first_name' => 'Tenant',
            'last_name' => 'User',
            'contact_number' => '+639000000000',
            'email' => 'tenant-'.uniqid().'@test.local',
            'status' => $status,
        ]));
    }

    private function createRoom(string $type, string $number, int $capacity, string $status = 'available'): Room
    {
        return Room::create([
            'room_code' => $number,
            'room_type' => $type,
            'capacity' => $capacity,
            'monthly_rate' => 3500,
            'status' => $status,
        ]);
    }
}
