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
use App\Services\Operations\BillingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Billing and payments — traceability: docs/SRS.md FR-020–027, docs/TEST_PLAN.md TC-BILLING-*, TC-PAYMENT-*.
 */
class BillingPaymentManagementTest extends TestCase
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
     * TC-BILLING-001: Create billing
     */
    public function test_create_monthly_billing(): void
    {
        $contract = $this->createActiveContract();

        $response = $this->actingAs($this->adminUser)->postJson('/api/billing', [
            'contract_id' => $contract->contract_id,
            'billing_period_from' => '2026-04-01',
            'billing_period_to' => '2026-04-30',
            'due_date' => '2026-05-05',
            'line_items' => [
                ['item_type' => 'base_rent', 'description' => 'Monthly rent', 'amount' => 5000],
                ['item_type' => 'utility', 'description' => 'Water', 'amount' => 450],
            ],
        ]);

        $response->assertCreated();
        $billingId = (int) $response->json('data.billing_id');

        $this->assertDatabaseHas('billing', [
            'billing_id' => $billingId,
            'status' => \App\Enums\BillingStatus::UNPAID->value,
        ]);

        // Verify line items
        $this->assertDatabaseHas('billing_line_items', [
            'billing_id' => $billingId,
            'amount' => 5000,
        ]);

        // Verify audit log (INSERT)
        $this->assertTriggerAuditLog([
            'user_id' => $this->adminUser->user_id,
            'target_table' => 'billing',
            'action' => 'INSERT',
        ]);
    }

    /**
     * TC-PAYMENT-001: Partial payment updates status
     */
    public function test_partial_payment_updates_status(): void
    {
        $billing = $this->createBillingRecord(6000.00);

        $response = $this->actingAs($this->adminUser)->postJson('/api/payments', [
            'billing_id' => $billing->billing_id,
            'amount_paid' => 2000,
            'payment_date' => '2026-05-08',
            'payment_method' => 'cash',
            'payment_category' => 'billing',
        ]);

        $response->assertCreated();
        $this->assertDatabaseHas('billing', [
            'billing_id' => $billing->billing_id,
            'status' => \App\Enums\BillingStatus::PARTIAL->value,
        ]);

        // Verify transaction log
        $this->assertDatabaseHas('transaction_logs', [
            'action' => 'POST_PAYMENT',
            'status' => 'committed',
        ]);
    }

    /**
     * TC-REPORT-005: Tenant ledger stable order
     */
    public function test_tenant_ledger_same_day_orders_debit_before_credit(): void
    {
        $billing = $this->createBillingRecord(6000.00);
        $billing->load('contract');
        $tenantId = (int) $billing->contract->tenant_id;

        $this->actingAs($this->adminUser)->postJson('/api/payments', [
            'billing_id' => $billing->billing_id,
            'amount_paid' => 2000,
            'payment_date' => '2026-05-01',
            'payment_method' => 'cash',
            'payment_category' => 'billing',
        ])->assertCreated();

        $response = $this->actingAs($this->viewerUser)->getJson(
            "/api/reports/tenant-ledger?tenant_id={$tenantId}"
        );

        $response->assertOk();
        $entries = $response->json('entries');
        $this->assertCount(2, $entries);
        $this->assertSame('debit', $entries[0]['type']);
        $this->assertSame('credit', $entries[1]['type']);
    }

    /**
     * TC-PAYMENT-003: Invalid payment amount rolls back
     */
    public function test_invalid_payment_amount_rolls_back(): void
    {
        $billing = $this->createBillingRecord(5000.00);

        $response = $this->actingAs($this->staffUser)->postJson('/api/payments', [
            'billing_id' => $billing->billing_id,
            'amount_paid' => 0, // Invalid
            'payment_date' => '2026-05-08',
            'payment_method' => 'cash',
            'payment_category' => 'billing',
        ]);

        $response->assertUnprocessable();

        // Verify status remains unpaid
        $this->assertDatabaseHas('billing', [
            'billing_id' => $billing->billing_id,
            'status' => \App\Enums\BillingStatus::UNPAID->value,
        ]);

        // Verify rolled-back transaction log
        $this->assertDatabaseHas('transaction_logs', [
            'action' => 'POST_PAYMENT',
            'status' => 'rolled_back',
        ]);
    }

    public function test_non_cash_payment_requires_reference_number(): void
    {
        $billing = $this->createBillingRecord(5000.00);

        $this->actingAs($this->adminUser)->postJson('/api/payments', [
            'billing_id' => $billing->billing_id,
            'amount_paid' => 1000,
            'payment_date' => '2026-05-08',
            'payment_method' => 'gcash',
            'reference_number' => '',
        ])->assertUnprocessable()->assertJsonValidationErrors(['reference_number']);
    }

    public function test_tc_billing_004_zero_amount_line_item_rejected(): void
    {
        $contract = $this->createActiveContract();

        $response = $this->actingAs($this->adminUser)->postJson('/api/billing', [
            'contract_id' => $contract->contract_id,
            'billing_period_from' => '2026-04-01',
            'billing_period_to' => '2026-04-30',
            'due_date' => '2026-05-05',
            'line_items' => [
                ['item_type' => 'base_rent', 'item_description' => 'Rent', 'amount' => 0],
            ],
        ]);

        $response->assertUnprocessable();
    }

    public function test_billing_list_combines_status_and_past_due_filters(): void
    {
        $paidBilling = $this->createBillingRecord(4500.00);
        $paidBilling->update(['due_date' => now()->subDays(10)->toDateString()]);

        Payment::create([
            'billing_id' => $paidBilling->billing_id,
            'processed_by' => $this->adminUser->user_id,
            'amount_paid' => 4500.00,
            'payment_date' => now()->subDays(5)->toDateString(),
            'payment_method' => \App\Enums\PaymentMethod::CASH->value,
        ]);
        $paidBilling->refresh();
        BillingService::syncBillingStatus($paidBilling);

        $response = $this->actingAs($this->viewerUser)
            ->getJson('/api/billing?status=paid&past_due=1');

        $response->assertOk();
        $response->assertJsonCount(0, 'data');
    }

    public function test_zero_total_billing_is_marked_paid_per_status_priority(): void
    {
        $contract = $this->createActiveContract();
        $zeroBilling = Billing::create([
            'contract_id' => $contract->contract_id,
            'billing_period_from' => '2026-05-01',
            'billing_period_to' => '2026-05-31',
            'due_date' => now()->subDays(2)->toDateString(),
            'status' => \App\Enums\BillingStatus::UNPAID->value,
        ]);

        BillingService::syncBillingStatus($zeroBilling->refresh());

        $this->assertDatabaseHas('billing', [
            'billing_id' => $zeroBilling->billing_id,
            'status' => \App\Enums\BillingStatus::PAID->value,
        ]);
    }

    public function test_voiding_payment_recomputes_billing_status_and_excludes_voided_amount(): void
    {
        $billing = $this->createBillingRecord(6000.00);

        $this->actingAs($this->adminUser)->postJson('/api/payments', [
            'billing_id' => $billing->billing_id,
            'amount_paid' => 6000.00,
            'payment_date' => now()->toDateString(),
            'payment_method' => 'cash',
            'payment_category' => 'billing',
        ])->assertCreated();

        $payment = Payment::where('billing_id', $billing->billing_id)->firstOrFail();

        $this->actingAs($this->adminUser)->deleteJson("/api/payments/{$payment->payment_id}", [
            'void_reason' => 'Test',
        ])->assertOk();

        $this->assertDatabaseHas('billing', [
            'billing_id' => $billing->billing_id,
            'status' => \App\Enums\BillingStatus::UNPAID->value,
        ]);
    }

    private function createActiveContract(): Contract
    {
        $tenant = Tenant::create($this->tenantAttributes());

        $room = Room::create([
            'room_code' => 'R'.rand(100, 999),
            'room_type' => \App\Enums\RoomType::PRIVATE->value,
            'capacity' => 1,
            'monthly_rate' => 5000,
            'status' => \App\Enums\RoomStatus::AVAILABLE->value,
        ]);

        $bedSpace = BedSpace::create([
            'room_id' => $room->room_id,
            'bed_label' => 'Bed 1',
            'status' => \App\Enums\BedSpaceStatus::OCCUPIED->value,
        ]);

        return Contract::create([
            'tenant_id' => $tenant->tenant_id,
            'bed_space_id' => $bedSpace->bed_space_id,
            'created_by' => $this->adminUser->user_id,
            'move_in_date' => '2026-04-01',
            'expected_move_out_date' => '2026-10-31',
            'deposit_amount' => 1000,
            'monthly_rate' => 5000,
            'contract_type' => \App\Enums\ContractType::FIXED_TERM->value,
            'status' => \App\Enums\ContractStatus::ACTIVE->value,
        ]);
    }

    private function createBillingRecord(float $amountDue): Billing
    {
        $contract = $this->createActiveContract();

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
            'item_description' => 'Base rent',
            'amount' => $amountDue,
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
