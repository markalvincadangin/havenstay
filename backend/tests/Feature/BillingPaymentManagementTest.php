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
use App\Services\BillingService;
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
        $billingId = (int) $response->json('data.billing_id');

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
        ]);

        $response->assertCreated();
        $this->assertDatabaseHas('billing', [
            'billing_id' => $billing->billing_id,
            'status' => 'partial',
        ]);

        // Verify transaction log
        $this->assertDatabaseHas('transaction_logs', [
            'action' => 'POST_PAYMENT',
            'status' => 'committed',
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
            'action' => 'POST_PAYMENT',
            'status' => 'rolled_back',
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

    public function test_billing_list_combines_status_and_past_due_filters(): void
    {
        $paidBilling = $this->createBillingRecord(4500.00);
        $paidBilling->update([
            'due_date' => now()->subDays(10)->toDateString(),
        ]);

        Payment::create([
            'billing_id' => $paidBilling->billing_id,
            'processed_by' => $this->adminUser->user_id,
            'amount_paid' => 4500.00,
            'payment_date' => now()->subDays(5)->toDateString(),
            'payment_method' => 'cash',
        ]);
        $paidBilling->refresh();
        BillingService::autoUpdateStatus($paidBilling);

        $partialPastDueBilling = $this->createBillingRecord(5000.00);
        $partialPastDueBilling->update([
            'due_date' => now()->subDays(7)->toDateString(),
        ]);

        Payment::create([
            'billing_id' => $partialPastDueBilling->billing_id,
            'processed_by' => $this->adminUser->user_id,
            'amount_paid' => 1000.00,
            'payment_date' => now()->subDays(3)->toDateString(),
            'payment_method' => 'cash',
        ]);
        $partialPastDueBilling->refresh();
        BillingService::autoUpdateStatus($partialPastDueBilling);

        $response = $this->actingAs($this->viewerUser)
            ->getJson('/api/billing?status=paid&past_due=1');

        $response->assertOk();
        $response->assertJsonCount(0, 'data');
    }

    public function test_billing_status_semantics_for_current_and_past_due_balances(): void
    {
        $unpaidCurrent = $this->createBillingRecord(3000.00);
        $unpaidCurrent->update([
            'due_date' => now()->addDays(7)->toDateString(),
        ]);
        BillingService::autoUpdateStatus($unpaidCurrent->refresh());

        $partialCurrent = $this->createBillingRecord(4000.00);
        $partialCurrent->update([
            'due_date' => now()->addDays(5)->toDateString(),
        ]);
        Payment::create([
            'billing_id' => $partialCurrent->billing_id,
            'processed_by' => $this->adminUser->user_id,
            'amount_paid' => 1000.00,
            'payment_date' => now()->toDateString(),
            'payment_method' => 'cash',
        ]);
        BillingService::autoUpdateStatus($partialCurrent->refresh());

        $overdueUnpaid = $this->createBillingRecord(3500.00);
        $overdueUnpaid->update([
            'due_date' => now()->subDays(8)->toDateString(),
        ]);
        BillingService::autoUpdateStatus($overdueUnpaid->refresh());

        $overduePartial = $this->createBillingRecord(4500.00);
        $overduePartial->update([
            'due_date' => now()->subDays(6)->toDateString(),
        ]);
        Payment::create([
            'billing_id' => $overduePartial->billing_id,
            'processed_by' => $this->adminUser->user_id,
            'amount_paid' => 1200.00,
            'payment_date' => now()->subDays(2)->toDateString(),
            'payment_method' => 'cash',
        ]);
        BillingService::autoUpdateStatus($overduePartial->refresh());

        $this->assertDatabaseHas('billing', [
            'billing_id' => $unpaidCurrent->billing_id,
            'status' => 'unpaid',
        ]);
        $this->assertDatabaseHas('billing', [
            'billing_id' => $partialCurrent->billing_id,
            'status' => 'partial',
        ]);
        $this->assertDatabaseHas('billing', [
            'billing_id' => $overdueUnpaid->billing_id,
            'status' => 'overdue',
        ]);
        $this->assertDatabaseHas('billing', [
            'billing_id' => $overduePartial->billing_id,
            'status' => 'overdue',
        ]);
    }

    public function test_zero_total_billing_is_marked_paid_per_status_priority(): void
    {
        $contract = $this->createActiveContract();
        $zeroBilling = Billing::create([
            'contract_id' => $contract->contract_id,
            'billing_period_from' => '2026-05-01',
            'billing_period_to' => '2026-05-31',
            'due_date' => now()->subDays(2)->toDateString(),
            'status' => 'unpaid',
        ]);

        BillingService::autoUpdateStatus($zeroBilling->refresh());

        $this->assertDatabaseHas('billing', [
            'billing_id' => $zeroBilling->billing_id,
            'status' => 'paid',
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
        ])->assertCreated();

        $this->assertDatabaseHas('billing', [
            'billing_id' => $billing->billing_id,
            'status' => 'paid',
        ]);

        $payment = Payment::where('billing_id', $billing->billing_id)->firstOrFail();

        $this->actingAs($this->adminUser)->deleteJson("/api/payments/{$payment->payment_id}", [
            'void_reason' => 'Test status recompute',
        ])->assertOk();

        $this->assertDatabaseHas('payments', [
            'payment_id' => $payment->payment_id,
        ]);

        $this->assertDatabaseHas('billing', [
            'billing_id' => $billing->billing_id,
            'status' => 'unpaid',
        ]);
    }

    public function test_overpayment_marks_billing_paid_and_removes_it_from_outstanding_balances(): void
    {
        $billing = $this->createBillingRecord(5000.00);
        $billing->update([
            'due_date' => now()->subDays(3)->toDateString(),
        ]);

        $this->actingAs($this->adminUser)->postJson('/api/payments', [
            'billing_id' => $billing->billing_id,
            'amount_paid' => 7000.00,
            'payment_date' => now()->toDateString(),
            'payment_method' => 'cash',
        ])->assertCreated();

        $this->assertDatabaseHas('billing', [
            'billing_id' => $billing->billing_id,
            'status' => 'paid',
        ]);

        $outstanding = $this->actingAs($this->viewerUser)->getJson('/api/reports/outstanding-balances');
        $outstanding->assertOk();
        $outstanding->assertJsonMissing([
            'billing_id' => $billing->billing_id,
        ]);
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
            'status' => 'vacant',
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
            'expected_move_out_date' => '2026-10-31',
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
