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
            'payment_method' => Payment::METHOD_CASH,
            'reference_number' => 'REF-'.uniqid(),
        ]);

        $this->actingAs($this->staffUser)->deleteJson("/api/payments/{$payment->payment_id}")
            ->assertOk();

        $this->actingAs($this->staffUser)->deleteJson("/api/payments/{$payment->payment_id}")
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['payment_id']);
    }

    public function test_room_duplicate_code_rejected(): void
    {
        $code = 'DUP-'.uniqid();
        $this->actingAs($this->adminUser)->postJson('/api/rooms', [
            'room_code' => $code,
            'room_type' => 'solo',
            'capacity' => 1,
            'monthly_rate' => 4000,
        ])->assertCreated();

        $this->actingAs($this->adminUser)->postJson('/api/rooms', [
            'room_code' => $code,
            'room_type' => 'solo',
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
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['billing_id']);
    }

    public function test_show_nonexistent_payment_returns_404(): void
    {
        $this->actingAs($this->viewerUser)->getJson('/api/payments/999999')->assertNotFound();
    }

    public function test_show_nonexistent_billing_returns_404(): void
    {
        $this->actingAs($this->viewerUser)->getJson('/api/billing/999999')->assertNotFound();
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

    public function test_active_contract_cannot_be_transitioned_via_update(): void
    {
        $contract = $this->makeActiveContract();

        $this->actingAs($this->adminUser)->putJson("/api/contracts/{$contract->contract_id}", [
            'status' => 'completed',
        ])->assertUnprocessable();
    }

    public function test_active_contract_cannot_set_actual_move_out_via_update(): void
    {
        $contract = $this->makeActiveContract();

        $this->actingAs($this->adminUser)->putJson("/api/contracts/{$contract->contract_id}", [
            'actual_move_out' => '2026-08-01',
        ])->assertUnprocessable();
    }

    public function test_active_contract_cannot_be_archived(): void
    {
        $contract = $this->makeActiveContract();

        $this->actingAs($this->adminUser)->postJson("/api/contracts/{$contract->contract_id}/archive", [])
            ->assertUnprocessable();
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
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['line_items']);
    }

    public function test_contract_create_missing_required_fields_returns_422(): void
    {
        $this->actingAs($this->adminUser)->postJson('/api/contracts', [])->assertUnprocessable()
            ->assertJsonValidationErrors(['tenant_id', 'move_in_date']);
    }

    public function test_user_create_rejects_short_password(): void
    {
        $staffRole = Role::where('role_name', 'staff')->firstOrFail();

        $this->actingAs($this->adminUser)->postJson('/api/users', [
            'first_name' => 'Short',
            'last_name' => 'Pass',
            'username' => 'shortpass_'.uniqid(),
            'email' => 'short_'.uniqid().'@test.local',
            'password' => 'short',
            'role_id' => $staffRole->role_id,
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['password']);
    }

    public function test_assign_role_requires_role_id(): void
    {
        $target = User::factory()->create([
            'role_id' => Role::where('role_name', 'viewer')->first()->role_id,
        ]);

        $this->actingAs($this->adminUser)->postJson("/api/users/{$target->user_id}/assign-role", [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['role_id']);
    }

    public function test_user_create_rejects_duplicate_username(): void
    {
        $staffRole = Role::where('role_name', 'staff')->firstOrFail();
        $username = 'duplicate_'.uniqid();

        $this->actingAs($this->adminUser)->postJson('/api/users', [
            'first_name' => 'First',
            'last_name' => 'User',
            'username' => $username,
            'email' => 'first_'.uniqid().'@test.local',
            'password' => 'Password123!',
            'role_id' => $staffRole->role_id,
        ])->assertCreated();

        $this->actingAs($this->adminUser)->postJson('/api/users', [
            'first_name' => 'Second',
            'last_name' => 'User',
            'username' => $username,
            'email' => 'second_'.uniqid().'@test.local',
            'password' => 'Password123!',
            'role_id' => $staffRole->role_id,
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['username']);
    }

    public function test_admin_can_view_transaction_logs(): void
    {
        $this->actingAs($this->adminUser)->getJson('/api/transaction-logs')->assertOk();
    }

    public function test_admin_can_view_audit_logs(): void
    {
        $response = $this->actingAs($this->adminUser)->getJson('/api/audit-logs');
        $response->assertOk();
        $response->assertJsonStructure([
            'meta' => [
                'current_page',
                'total',
                'access_denied_total',
            ],
        ]);
        $this->assertIsInt($response->json('meta.access_denied_total'));
    }

    public function test_admin_can_export_audit_logs_csv(): void
    {
        $response = $this->actingAs($this->adminUser)->get('/api/audit-logs/export');
        $response->assertOk();
        $response->assertHeader('content-type', 'text/csv; charset=UTF-8');
        $this->assertStringContainsString('ID', $response->streamedContent());
    }

    public function test_staff_cannot_export_audit_logs_csv(): void
    {
        $this->actingAs($this->staffUser)->get('/api/audit-logs/export')->assertForbidden();
    }

    public function test_viewer_cannot_export_audit_logs_csv(): void
    {
        $this->actingAs($this->viewerUser)->get('/api/audit-logs/export')->assertForbidden();
    }

    public function test_transaction_logs_accepts_per_page_query(): void
    {
        $this->actingAs($this->adminUser)->getJson('/api/transaction-logs?per_page=50')->assertOk();
    }

    public function test_transaction_logs_rejects_invalid_status_enum(): void
    {
        $this->actingAs($this->adminUser)
            ->getJson('/api/transaction-logs?status=not_a_real_status')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['status']);
    }

    public function test_audit_logs_rejects_invalid_action_enum(): void
    {
        $this->actingAs($this->adminUser)
            ->getJson('/api/audit-logs?action=not_a_real_action')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['action']);
    }

    public function test_transaction_logs_per_page_validation_max(): void
    {
        $this->actingAs($this->adminUser)->getJson('/api/transaction-logs?per_page=999')->assertUnprocessable()
            ->assertJsonValidationErrors(['per_page']);
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
        ])->assertCreated();
    }

    public function test_outstanding_balances_accepts_filter_parameters(): void
    {
        $this->actingAs($this->viewerUser)->getJson(
            '/api/reports/outstanding-balances?due_from=2026-01-01&due_to=2026-12-31'
        )->assertOk();
    }

    public function test_billing_summary_accepts_date_range(): void
    {
        $this->actingAs($this->staffUser)->getJson(
            '/api/reports/billing-summary?start_date=2026-01-01&end_date=2026-12-31'
        )->assertOk();
    }

    public function test_viewer_can_access_occupancy_status_report(): void
    {
        $this->actingAs($this->viewerUser)->getJson('/api/reports/occupancy-status')->assertOk();
    }

    public function test_viewer_can_access_active_contracts_report(): void
    {
        $this->actingAs($this->viewerUser)->getJson('/api/reports/active-contracts')->assertOk();
    }

    public function test_tenant_index_is_readable_by_viewer(): void
    {
        $this->actingAs($this->viewerUser)->getJson('/api/tenants')->assertOk();
    }

    public function test_rooms_index_is_readable_by_viewer(): void
    {
        $this->actingAs($this->viewerUser)->getJson('/api/rooms')->assertOk();
    }

    public function test_payments_index_is_readable_by_viewer(): void
    {
        $this->actingAs($this->viewerUser)->getJson('/api/payments')->assertOk();
    }

    public function test_billing_line_item_invalid_type_rejected(): void
    {
        $contract = $this->makeActiveContract();

        $this->actingAs($this->adminUser)->postJson('/api/billing', [
            'contract_id' => $contract->contract_id,
            'billing_period_from' => '2026-11-01',
            'billing_period_to' => '2026-11-30',
            'due_date' => '2026-12-05',
            'line_items' => [
                ['item_type' => 'invalid_type', 'item_description' => 'X', 'amount' => 100],
            ],
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['line_items.0.item_type']);
    }

    public function test_move_out_requires_actual_move_out(): void
    {
        $contract = $this->makeActiveContract();

        $this->actingAs($this->adminUser)->postJson("/api/contracts/{$contract->contract_id}/move-out", [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['actual_move_out']);
    }

    public function test_viewer_cannot_move_out(): void
    {
        $contract = $this->makeActiveContract();

        $this->actingAs($this->viewerUser)->postJson("/api/contracts/{$contract->contract_id}/move-out", [
            'actual_move_out' => '2026-08-01',
        ])->assertForbidden();
    }

    public function test_contract_create_rejects_expected_move_out_before_move_in(): void
    {
        $tenant = Tenant::create($this->tenantAttributes([
            'first_name' => 'Date',
            'last_name' => 'Edge',
            'contact_number' => '+639177700001',
            'status' => 'active',
        ]));
        $room = Room::create([
            'room_code' => 'DT-'.uniqid(),
            'room_type' => 'solo',
            'capacity' => 1,
            'monthly_rate' => 4000,
            'status' => 'vacant',
        ]);
        $bed = BedSpace::create([
            'room_id' => $room->room_id,
            'bed_label' => 'D1',
            'status' => 'vacant',
        ]);

        $this->actingAs($this->adminUser)->postJson('/api/contracts', [
            'tenant_id' => $tenant->tenant_id,
            'room_id' => $room->room_id,
            'bed_space_id' => $bed->bed_space_id,
            'move_in_date' => '2026-06-01',
            'expected_move_out' => '2026-05-01',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['expected_move_out']);
    }

    public function test_user_update_rejects_duplicate_username_from_another_user(): void
    {
        $staffRole = Role::where('role_name', 'staff')->firstOrFail();
        $takenUsername = 'taken_user_'.uniqid();

        User::factory()->create([
            'role_id' => $staffRole->role_id,
            'username' => $takenUsername,
        ]);

        $target = User::factory()->create([
            'role_id' => $staffRole->role_id,
        ]);

        $this->actingAs($this->adminUser)->putJson("/api/users/{$target->user_id}", [
            'username' => $takenUsername,
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['username']);
    }

    public function test_unauthenticated_logout_returns_401(): void
    {
        $this->postJson('/api/auth/logout')->assertUnauthorized();
    }

    private function makeActiveContract(): Contract
    {
        $tenant = Tenant::create($this->tenantAttributes([
            'first_name' => 'Wf',
            'last_name' => 'Tenant',
            'contact_number' => '+639188800001',
            'status' => 'active',
        ]));

        $room = Room::create([
            'room_code' => 'WF-'.uniqid(),
            'room_type' => 'solo',
            'capacity' => 1,
            'monthly_rate' => 4000,
            'status' => 'fully_occupied',
        ]);
        $bed = BedSpace::create([
            'room_id' => $room->room_id,
            'bed_label' => 'W1',
            'status' => 'occupied',
        ]);

        return Contract::create([
            'tenant_id' => $tenant->tenant_id,
            'bed_space_id' => $bed->bed_space_id,
            'created_by' => $this->adminUser->user_id,
            'move_in_date' => '2026-04-01',
            'expected_move_out_date' => '2026-10-01',
            'deposit_amount' => 0,
            'status' => 'active',
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
            'status' => 'unpaid',
        ]);

        BillingLineItem::create([
            'billing_id' => $billing->billing_id,
            'item_type' => 'base_rent',
            'item_description' => 'Rent',
            'amount' => 3000,
        ]);

        return $billing;
    }
}
