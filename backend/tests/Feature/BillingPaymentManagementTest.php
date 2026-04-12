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
                ['item_type' => 'base_rent', 'item_description' => 'Monthly rent', 'amount' => 5000],
                ['item_type' => 'utility', 'item_description' => 'Water', 'amount' => 450],
            ],
        ]);

        $response->assertCreated();
        $billingId = (int) $response->json('billing.billing_id');

        $this->assertDatabaseHas('billing', [
            'billing_id' => $billingId,
            'status' => 'unpaid',
        ]);

        // Verify line items
        $this->assertDatabaseHas('billing_line_items', [
            'billing_id' => $billingId,
            'amount' => 5000,
        ]);

        // Verify audit log (INSERT)
        $this->assertTriggerAuditLog([
            'user_id' => $this->adminUser->user_id,
            'entity_name' => 'billing',
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
        ]);

        $response->assertCreated();
        $this->assertDatabaseHas('billing', [
            'billing_id' => $billing->billing_id,
            'status' => 'partial',
        ]);

        // Verify transaction log
        $this->assertDatabaseHas('transaction_logs', [
            'tx_name' => 'payment_posting',
            'status' => 'committed',
            'reference_id' => (string) $billing->billing_id,
        ]);
    }

    /**
     * TC-REPORT-005: Tenant ledger stable order — debit before credit when both share the same calendar date (RPT-01).
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
        ])->assertCreated();

        $response = $this->actingAs($this->viewerUser)->getJson(
            "/api/reports/tenant-ledger?tenant_id={$tenantId}"
        );

        $response->assertOk();
        $entries = $response->json('entries');
        $this->assertCount(2, $entries);
        $this->assertSame('debit', $entries[0]['type']);
        $this->assertSame('credit', $entries[1]['type']);
        $normalize = static fn ($d) => substr((string) $d, 0, 10);
        $this->assertSame('2026-05-01', $normalize($entries[0]['date']));
        $this->assertSame('2026-05-01', $normalize($entries[1]['date']));
        $this->assertEqualsWithDelta(6000.0, (float) $entries[0]['running_balance'], 0.01);
        $this->assertEqualsWithDelta(4000.0, (float) $entries[1]['running_balance'], 0.01);
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
        ]);

        $response->assertUnprocessable();

        // Verify status remains unpaid
        $this->assertDatabaseHas('billing', [
            'billing_id' => $billing->billing_id,
            'status' => 'unpaid',
        ]);

        // Verify rolled-back transaction log (DB::transaction aborted)
        $this->assertDatabaseHas('transaction_logs', [
            'tx_name' => 'payment_posting',
            'status' => 'rolled_back',
            'reference_id' => (string) $billing->billing_id,
        ]);
    }

    public function test_non_cash_payment_requires_reference_number(): void
    {
        $billing = $this->createBillingRecord(5000.00);

        $empty = $this->actingAs($this->adminUser)->postJson('/api/payments', [
            'billing_id' => $billing->billing_id,
            'amount_paid' => 1000,
            'payment_date' => '2026-05-08',
            'payment_method' => 'gcash',
            'reference_number' => '',
        ]);

        $empty->assertUnprocessable()
            ->assertJsonValidationErrors(['reference_number']);

        $whitespace = $this->actingAs($this->adminUser)->postJson('/api/payments', [
            'billing_id' => $billing->billing_id,
            'amount_paid' => 1000,
            'payment_date' => '2026-05-08',
            'payment_method' => 'gcash',
            'reference_number' => '   ',
        ]);

        $whitespace->assertUnprocessable()
            ->assertJsonValidationErrors(['reference_number']);
    }

    /**
     * TC-BILLING-004: Zero-amount line item rejection (BR line items must be non-zero).
     */
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

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['line_items.0.amount']);
    }

    private function createActiveContract(): Contract
    {
        $tenant = Tenant::create($this->tenantAttributes([
            'first_name' => 'Billing',
            'last_name' => 'Tenant',
            'contact_number' => '09170000001',
            'email' => 'tenant-'.uniqid().'@test.local',
            'status' => 'active',
        ]));

        $room = Room::create([
            'room_code' => 'R'.rand(100, 999),
            'room_type' => 'solo',
            'capacity' => 1,
            'monthly_rate' => 5000,
            'status' => 'occupied',
        ]);

        $bedSpace = BedSpace::create([
            'room_id' => $room->room_id,
            'bed_label' => 'Bed 1',
            'status' => 'occupied',
        ]);

        return Contract::create([
            'tenant_id' => $tenant->tenant_id,
            'bed_space_id' => $bedSpace->bed_space_id,
            'created_by' => $this->adminUser->user_id,
            'move_in_date' => '2026-04-01',
            'deposit_amount' => 1000,
            'status' => 'active',
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
            'status' => 'unpaid',
        ]);

        BillingLineItem::create([
            'billing_id' => $billing->billing_id,
            'item_type' => 'base_rent',
            'item_description' => 'Base rent',
            'amount' => $amountDue,
        ]);

        return $billing;
    }
}
