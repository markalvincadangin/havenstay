<?php

namespace Tests\Feature;

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
 * Cross-cutting API edge cases — docs/SRS.md (FR-*), docs/API_REFERENCE.md (401/403/422).
 */
class ApiEdgeCasesTest extends TestCase
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

    public function test_unauthenticated_requests_return_401(): void
    {
        $this->getJson('/api/auth/me')->assertUnauthorized();
        $this->postJson('/api/tenants', [])->assertUnauthorized();
        $this->getJson('/api/billing')->assertUnauthorized();
        $this->postJson('/api/contracts', [])->assertUnauthorized();
    }

    public function test_login_validation_requires_credentials(): void
    {
        $this->postJson('/api/auth/login', [])->assertUnprocessable()
            ->assertJsonValidationErrors(['username', 'password']);
    }

    public function test_login_unknown_username_returns_validation_error(): void
    {
        $this->postJson('/api/auth/login', [
            'username' => 'no_such_user_'.uniqid(),
            'password' => 'any-password-123',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['username']);
    }

    public function test_contract_create_rejects_unknown_tenant(): void
    {
        $room = Room::create([
            'room_code' => 'EC-'.uniqid(),
            'room_type' => 'solo',
            'capacity' => 1,
            'monthly_rate' => 4000,
            'status' => 'vacant',
        ]);
        $bed = BedSpace::create([
            'room_id' => $room->room_id,
            'bed_label' => 'B1',
            'status' => 'vacant',
        ]);

        $this->actingAs($this->adminUser)->postJson('/api/contracts', [
            'tenant_id' => 999_999,
            'room_id' => $room->room_id,
            'bed_space_id' => $bed->bed_space_id,
            'move_in_date' => '2026-05-01',
            'expected_move_out' => '2026-10-01',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['tenant_id']);
    }

    public function test_contract_create_rejects_archived_tenant(): void
    {
        $tenant = Tenant::create($this->tenantAttributes([
            'first_name' => 'Archived',
            'last_name' => 'Person',
            'contact_number' => '+639100000001',
            'status' => 'archived',
        ]));

        $room = Room::create([
            'room_code' => 'EC-'.uniqid(),
            'room_type' => 'solo',
            'capacity' => 1,
            'monthly_rate' => 4000,
            'status' => 'vacant',
        ]);
        $bed = BedSpace::create([
            'room_id' => $room->room_id,
            'bed_label' => 'B1',
            'status' => 'vacant',
        ]);

        $this->actingAs($this->adminUser)->postJson('/api/contracts', [
            'tenant_id' => $tenant->tenant_id,
            'room_id' => $room->room_id,
            'bed_space_id' => $bed->bed_space_id,
            'move_in_date' => '2026-05-01',
            'expected_move_out' => '2026-10-01',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['tenant_id']);
    }

    public function test_contract_create_rejects_bed_space_not_in_selected_room(): void
    {
        $tenant = Tenant::create($this->tenantAttributes([
            'first_name' => 'Edge',
            'last_name' => 'Case',
            'contact_number' => '+639100000002',
            'status' => 'active',
        ]));

        $roomA = Room::create([
            'room_code' => 'ECA-'.uniqid(),
            'room_type' => 'shared',
            'capacity' => 2,
            'monthly_rate' => 3000,
            'status' => 'vacant',
        ]);
        $roomB = Room::create([
            'room_code' => 'ECB-'.uniqid(),
            'room_type' => 'shared',
            'capacity' => 2,
            'monthly_rate' => 3000,
            'status' => 'vacant',
        ]);

        $bedInRoomB = BedSpace::create([
            'room_id' => $roomB->room_id,
            'bed_label' => 'X',
            'status' => 'vacant',
        ]);

        $this->actingAs($this->adminUser)->postJson('/api/contracts', [
            'tenant_id' => $tenant->tenant_id,
            'room_id' => $roomA->room_id,
            'bed_space_id' => $bedInRoomB->bed_space_id,
            'move_in_date' => '2026-05-01',
            'expected_move_out' => '2026-10-01',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['bed_space_id']);
    }

    public function test_contract_move_out_rejects_actual_move_out_before_move_in(): void
    {
        $contract = $this->makeActiveContractFixture();

        $this->actingAs($this->staffUser)->postJson("/api/contracts/{$contract->contract_id}/move-out", [
            'actual_move_out' => '2025-01-01',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['actual_move_out']);
    }

    public function test_contract_move_out_rejects_non_active_contract(): void
    {
        $contract = $this->makeActiveContractFixture();
        $contract->update(['status' => 'completed']);

        $this->actingAs($this->adminUser)->postJson("/api/contracts/{$contract->contract_id}/move-out", [
            'actual_move_out' => '2026-12-01',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['contract']);
    }

    public function test_viewer_cannot_create_contract(): void
    {
        $tenant = Tenant::create($this->tenantAttributes([
            'first_name' => 'V',
            'last_name' => 'Viewer',
            'contact_number' => '+639100000003',
            'status' => 'active',
        ]));
        $room = Room::create([
            'room_code' => 'ECV-'.uniqid(),
            'room_type' => 'solo',
            'capacity' => 1,
            'monthly_rate' => 4000,
            'status' => 'vacant',
        ]);
        $bed = BedSpace::create([
            'room_id' => $room->room_id,
            'bed_label' => 'B1',
            'status' => 'vacant',
        ]);

        $this->actingAs($this->viewerUser)->postJson('/api/contracts', [
            'tenant_id' => $tenant->tenant_id,
            'room_id' => $room->room_id,
            'bed_space_id' => $bed->bed_space_id,
            'move_in_date' => '2026-06-01',
            'expected_move_out' => '2026-10-01',
        ])->assertForbidden();
    }

    public function test_billing_rejects_inverted_period(): void
    {
        $contract = $this->makeActiveContractFixture();

        $this->actingAs($this->adminUser)->postJson('/api/billing', [
            'contract_id' => $contract->contract_id,
            'billing_period_from' => '2026-06-30',
            'billing_period_to' => '2026-06-01',
            'due_date' => '2026-07-05',
            'line_items' => [
                ['item_type' => 'base_rent', 'item_description' => 'Rent', 'amount' => 3000],
            ],
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['billing_period_to']);
    }

    public function test_billing_rejects_duplicate_cycle_for_same_contract(): void
    {
        $contract = $this->makeActiveContractFixture();

        $payload = [
            'contract_id' => $contract->contract_id,
            'billing_period_from' => '2026-07-01',
            'billing_period_to' => '2026-07-31',
            'due_date' => '2026-08-05',
            'line_items' => [
                ['item_type' => 'base_rent', 'item_description' => 'Rent', 'amount' => 4000],
            ],
        ];

        $this->actingAs($this->adminUser)->postJson('/api/billing', $payload)->assertCreated();
        $this->actingAs($this->adminUser)->postJson('/api/billing', $payload)->assertUnprocessable()
            ->assertJsonValidationErrors(['billing_period_from']);
    }

    public function test_billing_rejects_negative_total_amount(): void
    {
        $contract = $this->makeActiveContractFixture();

        $this->actingAs($this->adminUser)->postJson('/api/billing', [
            'contract_id' => $contract->contract_id,
            'billing_period_from' => '2026-08-01',
            'billing_period_to' => '2026-08-31',
            'due_date' => '2026-09-05',
            'line_items' => [
                ['item_type' => 'base_rent', 'item_description' => 'Rent', 'amount' => 1000],
                ['item_type' => 'adjustment', 'item_description' => 'Adj', 'amount' => -5000],
            ],
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['line_items']);
    }

    public function test_billing_create_requires_active_contract(): void
    {
        $contract = $this->makeActiveContractFixture();
        $contract->update(['status' => 'completed']);

        $this->actingAs($this->staffUser)->postJson('/api/billing', [
            'contract_id' => $contract->contract_id,
            'billing_period_from' => '2026-09-01',
            'billing_period_to' => '2026-09-30',
            'due_date' => '2026-10-05',
            'line_items' => [
                ['item_type' => 'base_rent', 'item_description' => 'Rent', 'amount' => 2000],
            ],
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['contract_id']);
    }

    public function test_payment_negative_amount_rejected(): void
    {
        $billing = $this->makeUnpaidBillingFixture();

        $this->actingAs($this->adminUser)->postJson('/api/payments', [
            'billing_id' => $billing->billing_id,
            'amount_paid' => -100,
            'payment_date' => '2026-05-10',
            'payment_method' => 'cash',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['amount_paid']);
    }

    public function test_viewer_cannot_post_payment(): void
    {
        $billing = $this->makeUnpaidBillingFixture();

        $this->actingAs($this->viewerUser)->postJson('/api/payments', [
            'billing_id' => $billing->billing_id,
            'amount_paid' => 100,
            'payment_date' => '2026-05-10',
            'payment_method' => 'cash',
        ])->assertForbidden();
    }

    public function test_viewer_cannot_void_payment(): void
    {
        $billing = $this->makeUnpaidBillingFixture();
        $payment = Payment::create([
            'billing_id' => $billing->billing_id,
            'processed_by' => $this->adminUser->user_id,
            'amount_paid' => 50,
            'payment_date' => now(),
            'payment_method' => Payment::METHOD_CASH,
            'reference_number' => 'REF-'.uniqid(),
        ]);

        $this->actingAs($this->viewerUser)
            ->deleteJson("/api/payments/{$payment->payment_id}")
            ->assertForbidden();
    }

    public function test_tenant_ledger_requires_tenant_id(): void
    {
        $this->actingAs($this->viewerUser)->getJson('/api/reports/tenant-ledger')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['tenant_id']);
    }

    public function test_tenant_ledger_rejects_nonexistent_tenant_id(): void
    {
        $this->actingAs($this->staffUser)->getJson('/api/reports/tenant-ledger?tenant_id=999999')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['tenant_id']);
    }

    public function test_room_create_rejects_invalid_room_type(): void
    {
        $this->actingAs($this->adminUser)->postJson('/api/rooms', [
            'room_code' => 'BAD-'.uniqid(),
            'room_type' => 'suite',
            'capacity' => 1,
            'monthly_rate' => 5000,
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['room_type']);
    }

    public function test_staff_cannot_view_audit_logs(): void
    {
        $this->actingAs($this->staffUser)->getJson('/api/audit-logs')->assertForbidden();
    }

    public function test_staff_cannot_view_transaction_logs(): void
    {
        $this->actingAs($this->staffUser)->getJson('/api/transaction-logs')->assertForbidden();
    }

    public function test_tenant_search_accepts_empty_query(): void
    {
        $this->actingAs($this->viewerUser)->getJson('/api/tenants/search?q=')
            ->assertOk()
            ->assertJsonStructure(['data', 'meta']);
    }

    public function test_show_nonexistent_contract_returns_404(): void
    {
        $this->actingAs($this->adminUser)->getJson('/api/contracts/999999')->assertNotFound();
    }

    public function test_show_nonexistent_tenant_returns_404(): void
    {
        $this->actingAs($this->staffUser)->getJson('/api/tenants/999999')->assertNotFound();
    }

    public function test_viewer_cannot_recalculate_billing_status(): void
    {
        $billing = $this->makeUnpaidBillingFixture();

        $this->actingAs($this->viewerUser)
            ->patchJson("/api/billing/{$billing->billing_id}/status", [])
            ->assertForbidden();
    }

    public function test_collections_performance_report_is_readable_by_viewer(): void
    {
        $this->actingAs($this->viewerUser)->getJson('/api/reports/collections-performance')
            ->assertOk();
    }

    private function makeActiveContractFixture(): Contract
    {
        $tenant = Tenant::create($this->tenantAttributes([
            'first_name' => 'Fixture',
            'last_name' => 'Tenant',
            'contact_number' => '+639199900001',
            'status' => 'active',
        ]));

        $room = Room::create([
            'room_code' => 'FX-'.uniqid(),
            'room_type' => 'solo',
            'capacity' => 1,
            'monthly_rate' => 4500,
            'status' => 'vacant',
        ]);
        $bed = BedSpace::create([
            'room_id' => $room->room_id,
            'bed_label' => 'F1',
            'status' => 'occupied',
        ]);

        return Contract::create([
            'tenant_id' => $tenant->tenant_id,
            'bed_space_id' => $bed->bed_space_id,
            'created_by' => $this->adminUser->user_id,
            'move_in_date' => '2026-04-01',
            'expected_move_out_date' => '2026-10-01',
            'deposit_amount' => 500,
            'status' => 'active',
        ]);
    }

    private function makeUnpaidBillingFixture(): Billing
    {
        $contract = $this->makeActiveContractFixture();

        $billing = Billing::create([
            'contract_id' => $contract->contract_id,
            'billing_period_from' => '2026-05-01',
            'billing_period_to' => '2026-05-31',
            'due_date' => '2026-06-05',
            'status' => 'unpaid',
        ]);

        BillingLineItem::create([
            'billing_id' => $billing->billing_id,
            'item_type' => 'base_rent',
            'item_description' => 'Rent',
            'amount' => 3500,
        ]);

        return $billing;
    }
}
