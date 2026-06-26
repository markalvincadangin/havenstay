<?php

namespace Tests\Feature;

use App\Enums\BedSpaceStatus;
use App\Enums\BillingStatus;
use App\Enums\ContractStatus;
use App\Enums\ContractType;
use App\Enums\RoomStatus;
use App\Enums\RoomType;
use App\Models\BedSpace;
use App\Models\Billing;
use App\Models\BillingLineItem;
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
        $room = $this->createRoom(RoomType::SHARED->value, 'R301', 2, RoomStatus::AVAILABLE->value);
        $bedSpace = BedSpace::create([
            'room_id' => $room->room_id,
            'bed_label' => 'Bed A',
            'status' => BedSpaceStatus::VACANT->value,
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
            'status' => ContractStatus::PENDING_PAYMENT->value,
        ]);

        // Verify bed space status update
        $this->assertDatabaseHas('bed_spaces', [
            'bed_space_id' => $bedSpace->bed_space_id,
            'status' => BedSpaceStatus::OCCUPIED->value,
        ]);

        // Verify audit log entry (Trigger handles INSERT)
        $this->assertTriggerAuditLog([
            'user_id' => $this->adminUser->user_id,
            'target_table' => 'contracts',
            'action' => 'INSERT',
        ]);
    }

    public function test_create_contract_allows_null_expected_move_out_and_persists_rate_override(): void
    {
        $tenant = $this->createTenant('active');
        $room = $this->createRoom(RoomType::SHARED->value, 'R302', 2, RoomStatus::AVAILABLE->value);
        $bedSpace = BedSpace::create([
            'room_id' => $room->room_id,
            'bed_label' => 'Bed A',
            'status' => BedSpaceStatus::VACANT->value,
        ]);

        $response = $this->actingAs($this->adminUser)->postJson('/api/contracts', [
            'tenant_id' => $tenant->tenant_id,
            'room_id' => $room->room_id,
            'bed_space_id' => $bedSpace->bed_space_id,
            'move_in_date' => '2026-03-01',
            'expected_move_out' => null,
            'deposit_amount' => 1500,
            'monthly_rate_override' => 4200,
            'notes' => 'Open-ended lease with override',
        ]);

        $response->assertCreated();
        $this->assertDatabaseHas('contracts', [
            'tenant_id' => $tenant->tenant_id,
            'bed_space_id' => $bedSpace->bed_space_id,
            'expected_move_out_date' => null,
            'monthly_rate_override' => 4200.00,
        ]);
    }

    /**
     * TC-CONTRACT-003: Move-out success
     * TC-TX-004: `transaction_logs` committed row for `tenant_move_out` 
     */
    public function test_move_out_success(): void
    {
        $tenant = $this->createTenant('active');
        $room = $this->createRoom(RoomType::PRIVATE->value, 'R501', 1, RoomStatus::UNAVAILABLE->value);
        $bedSpace = BedSpace::create([
            'room_id' => $room->room_id,
            'bed_label' => 'Solo Bed',
            'status' => BedSpaceStatus::OCCUPIED->value,
        ]);

        $contract = Contract::create([
            'tenant_id' => $tenant->tenant_id,
            'bed_space_id' => $bedSpace->bed_space_id,
            'created_by' => $this->adminUser->user_id,
            'move_in_date' => '2026-02-01',
            'expected_move_out_date' => '2026-12-31',
            'deposit_amount' => 900,
            'monthly_rate' => 3500,
            'contract_type' => ContractType::FIXED_TERM->value,
            'status' => ContractStatus::ACTIVE->value,
        ]);

        $response = $this->actingAs($this->staffUser)->postJson("/api/contracts/{$contract->contract_id}/move-out", [
            'actual_move_out' => '2026-03-15',
            'notes' => 'Completed stay',
        ]);

        $response->assertOk();
        $this->assertDatabaseHas('contracts', [
            'contract_id' => $contract->contract_id,
            'status' => ContractStatus::COMPLETED->value,
            'actual_move_out_date' => '2026-03-15 00:00:00',
        ]);

        // Verify bed space becomes vacant
        $this->assertDatabaseHas('bed_spaces', [
            'bed_space_id' => $bedSpace->bed_space_id,
            'status' => BedSpaceStatus::VACANT->value,
        ]);

        // Verify audit log entry for UPDATE
        $this->assertTriggerAuditLog([
            'user_id' => $this->staffUser->user_id,
            'target_table' => 'contracts',
            'record_id' => (string) $contract->contract_id,
            'action' => 'UPDATE',
        ]);

        // TC-TX-004: Move-out workflow logs committed transaction (FR-034)
        $this->assertDatabaseHas('transaction_logs', [
            'action' => 'TENANT_MOVEOUT',
            'status' => 'committed',
            'initiated_by' => $this->staffUser->user_id,
        ]);
    }

    /**
     * TC-TX-006: Move-out validation failure — no tenant_move_out log (validation runs before logStarted).
     */
    public function test_move_out_invalid_date_does_not_create_tenant_move_out_log(): void
    {
        $tenant = $this->createTenant('active');
        $room = $this->createRoom(RoomType::PRIVATE->value, 'R503', 1, RoomStatus::UNAVAILABLE->value);
        $bedSpace = BedSpace::create([
            'room_id' => $room->room_id,
            'bed_label' => 'Solo Bed',
            'status' => BedSpaceStatus::OCCUPIED->value,
        ]);

        $contract = Contract::create([
            'tenant_id' => $tenant->tenant_id,
            'bed_space_id' => $bedSpace->bed_space_id,
            'created_by' => $this->adminUser->user_id,
            'move_in_date' => '2026-02-01',
            'expected_move_out_date' => '2026-12-31',
            'deposit_amount' => 900,
            'monthly_rate' => 3500,
            'contract_type' => ContractType::FIXED_TERM->value,
            'status' => ContractStatus::ACTIVE->value,
        ]);

        $countBefore = DB::table('transaction_logs')->where('action', 'TENANT_MOVEOUT')->count();

        $response = $this->actingAs($this->staffUser)->postJson("/api/contracts/{$contract->contract_id}/move-out", [
            'actual_move_out' => '2026-01-15',
            'notes' => 'Before move-in',
        ]);

        $response->assertUnprocessable();
        $this->assertSame(
            $countBefore,
            DB::table('transaction_logs')->where('action', 'TENANT_MOVEOUT')->count()
        );
    }

    public function test_move_out_does_not_mutate_existing_billing_records(): void
    {
        $tenant = $this->createTenant('active');
        $room = $this->createRoom(RoomType::PRIVATE->value, 'R504', 1, RoomStatus::UNAVAILABLE->value);
        $bedSpace = BedSpace::create([
            'room_id' => $room->room_id,
            'bed_label' => 'Solo Bed',
            'status' => BedSpaceStatus::OCCUPIED->value,
        ]);

        $contract = Contract::create([
            'tenant_id' => $tenant->tenant_id,
            'bed_space_id' => $bedSpace->bed_space_id,
            'created_by' => $this->adminUser->user_id,
            'move_in_date' => '2026-02-01',
            'expected_move_out_date' => '2026-12-31',
            'deposit_amount' => 900,
            'monthly_rate' => 3500,
            'contract_type' => ContractType::FIXED_TERM->value,
            'status' => ContractStatus::ACTIVE->value,
        ]);

        $billing = Billing::create([
            'contract_id' => $contract->contract_id,
            'billing_period_from' => '2026-03-01',
            'billing_period_to' => '2026-03-31',
            'due_date' => '2026-04-05',
            'status' => BillingStatus::UNPAID->value,
        ]);

        BillingLineItem::create([
            'billing_id' => $billing->billing_id,
            'item_type' => 'base_rent',
            'item_description' => 'Base rent',
            'amount' => 3500,
        ]);

        // Clear balance (Gate Pass requirement)
        $this->actingAs($this->adminUser)->postJson('/api/payments', [
            'billing_id' => $billing->billing_id,
            'amount_paid' => 3500,
            'payment_date' => now()->toDateString(),
            'payment_method' => 'cash',
            'payment_category' => 'billing',
        ])->assertCreated();

        $this->actingAs($this->staffUser)->postJson("/api/contracts/{$contract->contract_id}/move-out", [
            'actual_move_out' => '2026-03-15',
            'notes' => 'Move-out with existing unpaid billing',
        ])->assertOk();

        $this->assertDatabaseHas('billing', [
            'billing_id' => $billing->billing_id,
            'contract_id' => $contract->contract_id,
            'status' => BillingStatus::PAID->value,
        ]);
    }

    /**
     * TC-CONTRACT-002 / FR-017: One active contract per tenant.
     */
    public function test_tc_contract_002_tenant_overlap_prevention(): void
    {
        $tenant = $this->createTenant('active');
        $roomA = $this->createRoom(RoomType::SHARED->value, 'R-TC002-A', 2, RoomStatus::AVAILABLE->value);
        $bedA = BedSpace::create([
            'room_id' => $roomA->room_id,
            'bed_label' => 'A1',
            'status' => BedSpaceStatus::VACANT->value,
        ]);

        $this->actingAs($this->adminUser)->postJson('/api/contracts', [
            'tenant_id' => $tenant->tenant_id,
            'room_id' => $roomA->room_id,
            'bed_space_id' => $bedA->bed_space_id,
            'move_in_date' => '2026-03-01',
            'expected_move_out' => '2026-06-01',
        ])->assertCreated();

        $roomB = $this->createRoom(RoomType::SHARED->value, 'R-TC002-B', 2, RoomStatus::AVAILABLE->value);
        $bedB = BedSpace::create([
            'room_id' => $roomB->room_id,
            'bed_label' => 'B1',
            'status' => BedSpaceStatus::VACANT->value,
        ]);

        $response = $this->actingAs($this->staffUser)->postJson('/api/contracts', [
            'tenant_id' => $tenant->tenant_id,
            'room_id' => $roomB->room_id,
            'bed_space_id' => $bedB->bed_space_id,
            'move_in_date' => '2026-04-01',
            'expected_move_out' => '2026-07-01',
        ]);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['tenant_id']);
    }

    /**
     * TC-CONTRACT-004 / FR-017: One active contract per bed space (bed must be vacant).
     */
    public function test_tc_contract_004_bed_space_overlap_prevention(): void
    {
        $tenantA = $this->createTenant('active');
        $tenantB = $this->createTenant('active');
        $room = $this->createRoom(RoomType::SHARED->value, 'R-TC004', 2, RoomStatus::AVAILABLE->value);
        $bed = BedSpace::create([
            'room_id' => $room->room_id,
            'bed_label' => 'X1',
            'status' => BedSpaceStatus::VACANT->value,
        ]);

        $this->actingAs($this->adminUser)->postJson('/api/contracts', [
            'tenant_id' => $tenantA->tenant_id,
            'room_id' => $room->room_id,
            'bed_space_id' => $bed->bed_space_id,
            'move_in_date' => '2026-03-01',
            'expected_move_out' => '2026-06-01',
        ])->assertCreated();

        $response = $this->actingAs($this->staffUser)->postJson('/api/contracts', [
            'tenant_id' => $tenantB->tenant_id,
            'room_id' => $room->room_id,
            'bed_space_id' => $bed->bed_space_id,
            'move_in_date' => '2026-04-01',
            'expected_move_out' => '2026-07-01',
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

    protected function tenantAttributes(array $overrides = []): array
    {
        return array_merge([
            'first_name' => 'John',
            'last_name' => 'Doe',
            'email' => 'john'.uniqid().'@example.com',
            'contact_number' => '+639170000000',
            'emergency_contact_name' => 'Jane Doe',
            'emergency_contact_number' => '+639170000001',
            'address' => '123 Main St, City',
            'status' => 'active',
        ], $overrides);
    }
}
