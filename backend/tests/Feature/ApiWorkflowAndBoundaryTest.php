<?php

namespace Tests\Feature;

use App\Enums\PaymentMethod;
use App\Models\AuditLog;
use App\Models\BedSpace;
use App\Models\Billing;
use App\Models\BillingLineItem;
use App\Models\Contract;
use App\Models\Payment;
use App\Models\Role;
use App\Models\Room;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Deeper workflows and boundary checks — SRS/ API_REFERENCE alignment.
 */
class ApiWorkflowAndBoundaryTest extends TestCase
{
    use RefreshDatabase;

    private User $adminUser;

    private User $staffUser;

    private User $viewerUser;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seedRoles();

        $adminRole = Role::where('role_name', 'admin')->firstOrFail();
        $staffRole = Role::where('role_name', 'staff')->firstOrFail();
        $viewerRole = Role::where('role_name', 'viewer')->firstOrFail();

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

    public function test_admin_cannot_deactivate_own_account(): void
    {
        $this->actingAs($this->adminUser)->postJson("/api/users/{$this->adminUser->user_id}/deactivate")
            ->assertStatus(400)
            ->assertJsonFragment(['message' => 'Conflict: You cannot deactivate your own account.']);
    }

    public function test_second_void_on_same_payment_returns_422(): void
    {
        $billing = $this->makeUnpaidBilling();
        $payment = Payment::create([
            'billing_id' => $billing->billing_id,
            'processed_by' => $this->adminUser->user_id,
            'amount_paid' => 100,
            'payment_date' => now(),
            'payment_method' => PaymentMethod::CASH->value,
            'reference_number' => 'REF-'.uniqid(),
        ]);

        $this->actingAs($this->staffUser)->deleteJson("/api/payments/{$payment->payment_id}", ['void_reason' => 'Test'])
            ->assertOk();

        $this->actingAs($this->staffUser)->deleteJson("/api/payments/{$payment->payment_id}", ['void_reason' => 'Test'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['payment_id']);
    }

    public function test_room_duplicate_code_rejected(): void
    {
        $code = 'DUP-'.uniqid();
        $this->actingAs($this->adminUser)->postJson('/api/rooms', [
            'room_code' => $code,
            'room_type' => \App\Enums\RoomType::PRIVATE->value,
            'capacity' => 1,
            'monthly_rate' => 4000,
        ])->assertCreated();

        $this->actingAs($this->adminUser)->postJson('/api/rooms', [
            'room_code' => $code,
            'room_type' => \App\Enums\RoomType::PRIVATE->value,
            'capacity' => 1,
            'monthly_rate' => 4000,
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['room_code']);
    }

    public function test_unauthenticated_csv_export_returns_401(): void
    {
        $this->get('/api/reports/occupancy/export')->assertUnauthorized();
        $this->get('/api/reports/billing-summary/export')->assertUnauthorized();
    }

    public function test_payment_for_unknown_billing_id_returns_422(): void
    {
        $this->actingAs($this->adminUser)->postJson('/api/payments', [
            'billing_id' => 999_999,
            'amount_paid' => 100,
            'payment_date' => '2026-05-01',
            'payment_method' => 'cash',
            'payment_category' => 'billing',
        ])->assertUnprocessable();
    }

    public function test_viewer_can_list_contracts(): void
    {
        $this->actingAs($this->viewerUser)->getJson('/api/contracts')->assertOk();
    }

    public function test_viewer_cannot_update_contract(): void
    {
        $contract = $this->makeActiveContract();
        $this->actingAs($this->viewerUser)->putJson("/api/contracts/{$contract->contract_id}", [
            'notes' => 'Should not apply',
        ])->assertForbidden();
    }

    public function test_billing_create_requires_non_empty_line_items(): void
    {
        $contract = $this->makeActiveContract();
        $this->actingAs($this->adminUser)->postJson('/api/billing', [
            'contract_id' => $contract->contract_id,
            'billing_period_from' => '2026-10-01',
            'billing_period_to' => '2026-10-31',
            'due_date' => '2026-11-05',
            'line_items' => [],
        ])->assertUnprocessable();
    }

    public function test_admin_can_view_audit_logs(): void
    {
        $this->actingAs($this->adminUser)->getJson('/api/audit-logs')->assertOk();
    }

    public function test_staff_can_post_payment(): void
    {
        $billing = $this->makeUnpaidBilling();
        $this->actingAs($this->staffUser)->postJson('/api/payments', [
            'billing_id' => $billing->billing_id,
            'amount_paid' => 500,
            'payment_date' => '2026-05-15',
            'payment_method' => 'gcash',
            'reference_number' => 'GC-TEST-001',
            'payment_category' => 'billing',
        ])->assertCreated();
    }

    private function makeActiveContract(): Contract
    {
        $tenant = Tenant::create($this->tenantAttributes());

        $room = Room::create([
            'room_code' => 'WF-'.uniqid(),
            'room_type' => \App\Enums\RoomType::PRIVATE->value,
            'capacity' => 1,
            'monthly_rate' => 4000,
            'status' => \App\Enums\RoomStatus::AVAILABLE->value,
        ]);
        $bed = BedSpace::create([
            'room_id' => $room->room_id,
            'bed_label' => 'W1',
            'status' => \App\Enums\BedSpaceStatus::OCCUPIED->value,
        ]);

        return Contract::create([
            'tenant_id' => $tenant->tenant_id,
            'bed_space_id' => $bed->bed_space_id,
            'created_by' => $this->adminUser->user_id,
            'move_in_date' => '2026-04-01',
            'expected_move_out_date' => '2026-10-01',
            'deposit_amount' => 0,
            'monthly_rate' => 4000,
            'contract_type' => \App\Enums\ContractType::FIXED_TERM->value,
            'status' => \App\Enums\ContractStatus::ACTIVE->value,
        ]);
    }

    private function makeUnpaidBilling(): Billing
    {
        $contract = $this->makeActiveContract();
        $billing = Billing::create([
            'contract_id' => $contract->contract_id,
            'billing_period_from' => '2026-05-01',
            'billing_period_to' => '2026-05-31',
            'due_date' => '2026-06-05',
            'status' => \App\Enums\BillingStatus::UNPAID->value,
        ]);

        BillingLineItem::create([
            'billing_id' => $billing->billing_id,
            'item_type' => 'base_rent',
            'item_description' => 'Rent',
            'amount' => 3000,
        ]);

        return $billing;
    }

    protected function tenantAttributes(array $overrides = []): array
    {
        return array_merge([
            'first_name' => 'John',
            'last_name' => 'Doe',
            'email' => 'john' . uniqid() . '@example.com',
            'contact_number' => '+639170000000',
            'emergency_contact_name' => 'Jane Doe',
            'emergency_contact_number' => '+639170000001',
            'address' => '123 Main St, City',
            'status' => \App\Enums\TenantStatus::ACTIVE->value,
        ], $overrides);
    }
}
