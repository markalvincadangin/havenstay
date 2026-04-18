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
use App\Services\Operations\PaymentService;
use App\Services\Analytics\ReportService;
use App\Services\Operations\RoomService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Regression tests for behaviors described in CLAUDE.md §13 (BUG-001–009 resolved).
 *
 * Source of truth: docs/SRS.md, docs/SDD.md, CLAUDE.md. These assert current correct behavior
 * (voided payments excluded from totals, valid room ENUM, void payment tx logs, report filters,
 * no Gate::authorize in controllers, audit context on MySQL).
 */
class BugConditionExplorationTest extends TestCase
{
    use RefreshDatabase;

    private User $adminUser;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seedRoles();
        $adminRole = Role::where('role_name', 'admin')->first();

        $this->adminUser = User::factory()->create([
            'role_id' => $adminRole->role_id,
            'is_active' => true,
        ]);
    }

    /**
     * Property 1: Bug Condition - BUG-001 Voided Payments Counted
     *
     * **Validates: Requirements BUG-001**
     *
     * CRITICAL: This test MUST FAIL on unfixed code - failure confirms the bug exists.
     * DO NOT attempt to fix the test or the code when it fails.
     *
     * Bug Condition: getTotalPaidAttribute() incorrectly includes voided payments
     * Expected Behavior: Only non-voided payments (voided_at IS NULL) should be counted
     *
     * Test Strategy:
     * 1. Create a billing record with a known amount
     * 2. Add a payment
     * 3. Void the payment (set voided_at)
     * 4. Assert getTotalPaidAttribute() returns 0 (should exclude voided payment)
     *
     * EXPECTED OUTCOME ON UNFIXED CODE: Test FAILS
     * - getTotalPaidAttribute() will return the payment amount instead of 0
     * - This confirms voided payments are incorrectly included
     */
    public function test_bug_001_voided_payments_are_counted_in_total_paid(): void
    {
        // Arrange: Create billing record with $5000 due
        $billing = $this->createBillingRecord(5000.00);

        // Act: Add a payment of $2000
        $payment = Payment::create([
            'billing_id' => $billing->billing_id,
            'processed_by' => $this->adminUser->user_id,
            'amount_paid' => 2000.00,
            'payment_date' => now(),
            'payment_method' => Payment::METHOD_CASH,
            'reference_number' => 'REF-'.uniqid(),
        ]);

        // Verify payment was created
        $this->assertDatabaseHas('payments', [
            'payment_id' => $payment->payment_id,
            'amount_paid' => 2000.00,
            'voided_at' => null,
        ]);

        // Act: Void the payment
        $payment->update([
            'voided_at' => now(),
            'voided_by' => $this->adminUser->user_id,
            'void_reason' => 'Test void for bug exploration',
        ]);

        // Verify payment was voided
        $this->assertDatabaseHas('payments', [
            'payment_id' => $payment->payment_id,
            'voided_at' => $payment->voided_at,
        ]);

        // Assert: Refresh billing model and check total_paid
        $billing->refresh();

        // EXPECTED BEHAVIOR: total_paid should be 0 (voided payment excluded)
        // BUG BEHAVIOR: total_paid will be 2000.00 (voided payment included)
        $this->assertEquals(
            0.0,
            $billing->total_paid,
            'BUG-001 CONFIRMED: getTotalPaidAttribute() incorrectly includes voided payments. '.
            'Expected 0.0 but got '.$billing->total_paid.'. '.
            'The payment with amount_paid=2000.00 has voided_at set but is still counted.'
        );

        // Additional assertion: balance should equal total_amount when all payments are voided
        $this->assertEquals(
            $billing->total_amount,
            $billing->balance,
            'Balance should equal total_amount when all payments are voided'
        );
    }

    /**
     * Property 1: Bug Condition - BUG-003 Invalid ENUM 'occupied'
     *
     * **Validates: Requirements BUG-003**
     *
     * CRITICAL: This test MUST FAIL on unfixed code - failure confirms the bug exists.
     * DO NOT attempt to fix the test or the code when it fails.
     *
     * Bug Condition: RoomService::syncStatusAndCapacity() writes 'occupied' to rooms.status
     * Expected Behavior: rooms.status should only contain valid ENUM values: 'vacant', 'partially_occupied', 'fully_occupied', 'maintenance'
     *
     * Test Strategy:
     * 1. Create a solo room with a bed space
     * 2. Create a contract that occupies the bed space (triggers syncStatusAndCapacity)
     * 3. Assert room status is NOT 'occupied' (should be 'fully_occupied' instead)
     *
     * EXPECTED OUTCOME ON UNFIXED CODE: Test FAILS
     * - Room status will be 'occupied' (invalid ENUM value)
     * - This confirms the bug exists in syncStatusAndCapacity()
     */
    public function test_bug_003_room_status_set_to_invalid_occupied_enum(): void
    {
        // Arrange: Create a solo room with available status
        $room = Room::create([
            'room_code' => 'R'.rand(100, 999),
            'room_type' => Room::TYPE_SOLO,
            'capacity' => 1,
            'monthly_rate' => 5000,
            'status' => Room::STATUS_VACANT,
        ]);

        $bedSpace = BedSpace::create([
            'room_id' => $room->room_id,
            'bed_label' => 'Bed 1',
            'status' => 'vacant',
        ]);

        // Verify initial state
        $this->assertDatabaseHas('rooms', [
            'room_id' => $room->room_id,
            'status' => Room::STATUS_VACANT,
        ]);

        // Arrange: Create a tenant
        $tenant = Tenant::create($this->tenantAttributes([
            'first_name' => 'Bug',
            'last_name' => 'Test',
            'contact_number' => '09170000003',
            'email' => 'bug-test-003-'.uniqid().'@test.local',
            'status' => 'active',
        ]));

        // Act: Create a contract (this triggers syncStatusAndCapacity via occupyBedSpace)
        $contract = Contract::create([
            'tenant_id' => $tenant->tenant_id,
            'bed_space_id' => $bedSpace->bed_space_id,
            'created_by' => $this->adminUser->user_id,
            'move_in_date' => '2026-04-01',
            'expected_move_out_date' => '2026-10-01',
            'deposit_amount' => 1000,
            'status' => 'active',
        ]);

        // Manually trigger the sync to ensure it runs (simulating ContractService::create behavior)
        $bedSpace->refresh();
        RoomService::occupyBedSpace($this->adminUser, $bedSpace);

        // Assert: Refresh room and check status
        $room->refresh();

        // EXPECTED BEHAVIOR: room status should be 'fully_occupied' (valid ENUM)
        $this->assertNotEquals(
            'occupied',
            $room->status,
            'Room status should never be "occupied" (invalid ENUM value)'
        );

        // For a fully occupied solo room, status should specifically be 'fully_occupied'
        $this->assertEquals(
            Room::STATUS_FULLY_OCCUPIED,
            $room->status,
            'A fully occupied solo room should have status "fully_occupied"'
        );
    }

    /**
     * Property 1: Bug Condition - BUG-005 Missing Transaction Log
     *
     * **Validates: Requirements BUG-005**
     *
     * CRITICAL: This test MUST FAIL on unfixed code - failure confirms the bug exists.
     * DO NOT attempt to fix the test or the code when it fails.
     *
     * Bug Condition: PaymentService::void() does not create transaction_logs entry
     * Expected Behavior: Every void() call should create a transaction_logs entry with tx_name='void_payment'
     *
     * Test Strategy:
     * 1. Create a billing record with a payment
     * 2. Call PaymentService::void() to void the payment
     * 3. Assert transaction_logs has an entry with tx_name='void_payment'
     * 4. Assert the entry references the correct payment
     *
     * EXPECTED OUTCOME ON UNFIXED CODE: Test FAILS
     * - No transaction_logs entry will be found with tx_name='void_payment'
     * - This confirms the bug exists (CCR-007 gap)
     */
    public function test_bug_005_payment_void_missing_transaction_log(): void
    {
        // Arrange: Create billing record with a payment
        $billing = $this->createBillingRecord(5000.00);

        $payment = Payment::create([
            'billing_id' => $billing->billing_id,
            'processed_by' => $this->adminUser->user_id,
            'amount_paid' => 2000.00,
            'payment_date' => now(),
            'payment_method' => Payment::METHOD_CASH,
            'reference_number' => 'REF-'.uniqid(),
        ]);

        // Verify payment was created and is not voided
        $this->assertDatabaseHas('payments', [
            'payment_id' => $payment->payment_id,
            'amount_paid' => 2000.00,
            'voided_at' => null,
        ]);

        // Act: Call PaymentService::void() to void the payment
        PaymentService::void($this->adminUser, $payment);

        // Assert: Check that payment was voided
        $payment->refresh();
        $this->assertNotNull($payment->voided_at, 'Payment should be voided');

        // Assert: Check that transaction_logs entry exists with action='VOID_PAYMENT'
        // EXPECTED BEHAVIOR: transaction_logs should have an entry for this void operation
        // BUG BEHAVIOR: No transaction_logs entry will exist
        $txLogExists = DB::table('transaction_logs')
            ->where('action', 'VOID_PAYMENT')
            ->exists();

        $this->assertTrue(
            $txLogExists,
            'BUG-005 CONFIRMED: PaymentService::void() does not create transaction_logs entry. '.
            'Expected to find transaction_logs entry with action="VOID_PAYMENT" '.
            'but no such entry exists. This is a CCR-007 gap - all critical financial operations must be logged.'
        );

        // Additional assertion: The transaction log should have a valid terminal status
        $txLog = DB::table('transaction_logs')
            ->where('action', 'VOID_PAYMENT')
            ->first();

        $this->assertNotNull($txLog, 'Transaction log entry should exist');
        $this->assertContains(
            $txLog->status,
            ['started', 'committed', 'failed', 'rolled_back'],
            'Transaction log status should be one of: started, committed, failed, rolled_back'
        );

        // The transaction should be committed (successful void)
        $this->assertEquals(
            'committed',
            $txLog->status,
            'Transaction log status should be "committed" for successful void operation'
        );

        // The transaction should have the correct initiator
        $this->assertEquals(
            $this->adminUser->user_id,
            $txLog->initiated_by,
            'Transaction log should record the correct user who initiated the void'
        );
    }

    /**
     * Property 1: Bug Condition - BUG-006 Filters Silently Dropped
     *
     * **Validates: Requirements BUG-006**
     *
     * CRITICAL: This test MUST FAIL on unfixed code - failure confirms the bug exists.
     * DO NOT attempt to fix the test or the code when it fails.
     *
     * Bug Condition: ReportService::outstandingBalances() silently drops tenant_id, due_from, due_to filters
     * Expected Behavior: All filters should be applied at SQL level and results should match ALL filters
     *
     * Test Strategy:
     * 1. Create multiple billing records with different tenants and due dates
     * 2. Create some with outstanding balances, some fully paid
     * 3. Call outstandingBalances() with specific filters (tenant_id, due_from, due_to)
     * 4. Assert results match ALL filters (not just outstanding balance filter)
     *
     * EXPECTED OUTCOME ON UNFIXED CODE: Test FAILS
     * - Filters are silently dropped because outstandingBalances() delegates to billingSummary()
     * - billingSummary() uses different filter keys (start_date, end_date) so filters are ignored
     * - Results will include records that don't match the filters
     */
    public function test_bug_006_outstanding_balances_filters_silently_dropped(): void
    {
        // Arrange: Create multiple tenants
        $tenant1 = Tenant::create($this->tenantAttributes([
            'first_name' => 'Tenant',
            'last_name' => 'One',
            'contact_number' => '09170000101',
            'email' => 'tenant1-'.uniqid().'@test.local',
            'status' => 'active',
        ]));

        $tenant2 = Tenant::create($this->tenantAttributes([
            'first_name' => 'Tenant',
            'last_name' => 'Two',
            'contact_number' => '09170000102',
            'email' => 'tenant2-'.uniqid().'@test.local',
            'status' => 'active',
        ]));

        // Create contracts for both tenants
        $contract1 = $this->createContractForTenant($tenant1);
        $contract2 = $this->createContractForTenant($tenant2);

        // Create billing records with different due dates and outstanding balances
        // Tenant 1 - Due date: 2026-06-05 (within filter range) - Outstanding balance
        $billing1 = Billing::create([
            'contract_id' => $contract1->contract_id,
            'billing_period_from' => '2026-05-01',
            'billing_period_to' => '2026-05-31',
            'due_date' => '2026-06-05',
            'status' => 'unpaid',
        ]);
        BillingLineItem::create([
            'billing_id' => $billing1->billing_id,
            'item_type' => 'base_rent',
            'item_description' => 'Base rent',
            'amount' => 5000.00,
        ]);

        // Tenant 2 - Due date: 2026-06-10 (within filter range) - Outstanding balance
        $billing2 = Billing::create([
            'contract_id' => $contract2->contract_id,
            'billing_period_from' => '2026-05-01',
            'billing_period_to' => '2026-05-31',
            'due_date' => '2026-06-10',
            'status' => 'unpaid',
        ]);
        BillingLineItem::create([
            'billing_id' => $billing2->billing_id,
            'item_type' => 'base_rent',
            'item_description' => 'Base rent',
            'amount' => 4000.00,
        ]);

        // Tenant 1 - Due date: 2026-07-05 (OUTSIDE filter range) - Outstanding balance
        $billing3 = Billing::create([
            'contract_id' => $contract1->contract_id,
            'billing_period_from' => '2026-06-01',
            'billing_period_to' => '2026-06-30',
            'due_date' => '2026-07-05',
            'status' => 'unpaid',
        ]);
        BillingLineItem::create([
            'billing_id' => $billing3->billing_id,
            'item_type' => 'base_rent',
            'item_description' => 'Base rent',
            'amount' => 5000.00,
        ]);

        // Act: Call outstandingBalances() with filters
        // Filter: tenant_id = tenant1, due_from = 2026-06-01, due_to = 2026-06-15
        $filters = [
            'tenant_id' => $tenant1->tenant_id,
            'due_from' => '2026-06-01',
            'due_to' => '2026-06-15',
        ];

        $result = ReportService::outstandingBalances($filters);

        // Assert: Results should ONLY include billing1 (tenant1, due_date within range)
        // EXPECTED BEHAVIOR: 1 record (billing1 only)
        // BUG BEHAVIOR: Will include all 3 records (filters are dropped)

        $resultRows = collect($result['rows']);

        // Check that ONLY billing1 is returned
        $this->assertCount(
            1,
            $resultRows,
            'BUG-006 CONFIRMED: ReportService::outstandingBalances() silently drops filters. '.
            'Expected 1 record (billing_id='.$billing1->billing_id.' for tenant_id='.$tenant1->tenant_id.' with due_date between 2026-06-01 and 2026-06-15) '.
            'but got '.$resultRows->count().' records. '.
            'Filters (tenant_id, due_from, due_to) are being ignored because outstandingBalances() delegates to billingSummary() which uses different filter keys.'
        );

        // Verify the returned record is billing1
        $returnedBilling = $resultRows->first();
        $this->assertEquals(
            $billing1->billing_id,
            $returnedBilling['billing_id'],
            'The returned record should be billing1 (billing_id='.$billing1->billing_id.')'
        );

        // Verify tenant_id filter was applied
        $this->assertEquals(
            $tenant1->tenant_id,
            $returnedBilling['tenant_id'],
            'The returned record should belong to tenant1 (tenant_id='.$tenant1->tenant_id.')'
        );

        // Verify due_date filter was applied
        $dueDate = $returnedBilling['due_date'];
        $this->assertGreaterThanOrEqual(
            '2026-06-01',
            $dueDate,
            'The returned record due_date should be >= 2026-06-01'
        );
        $this->assertLessThanOrEqual(
            '2026-06-15',
            $dueDate,
            'The returned record due_date should be <= 2026-06-15'
        );

        // Verify outstanding balance filter was applied
        $this->assertGreaterThan(
            0,
            $returnedBilling['outstanding_balance'],
            'The returned record should have an outstanding balance > 0'
        );

        // Verify summary counts match
        $this->assertEquals(
            1,
            $result['summary']['account_count'],
            'Summary account_count should be 1'
        );

        $this->assertEquals(
            5000.00,
            $result['summary']['total_outstanding'],
            'Summary total_outstanding should be 5000.00 (billing1 amount)'
        );
    }

    /**
     * Property 1: Bug Condition - BUG-007 Mixed Authorization
     *
     * **Validates: Requirements BUG-007**
     *
     * CRITICAL: This test MUST FAIL on unfixed code - failure confirms the bug exists.
     * DO NOT attempt to fix the test or the code when it fails.
     *
     * Bug Condition: Controllers use Gate::authorize() instead of AuthorizationService
     * Expected Behavior: All authorization should use AuthorizationService only (CLAUDE.md Section 6.3)
     *
     * Test Strategy:
     * 1. Search all controller files for Gate::authorize usage
     * 2. Assert zero results (no Gate::authorize calls should exist)
     * 3. Document all found instances as counterexamples
     *
     * EXPECTED OUTCOME ON UNFIXED CODE: Test FAILS
     * - Gate::authorize() calls will be found in PaymentController and ReportController
     * - This confirms mixed authorization pattern exists (violates architecture)
     */
    public function test_bug_007_mixed_authorization_gate_instead_of_service(): void
    {
        // Act: Search for Gate::authorize usage in controllers
        $controllerPath = app_path('Http/Controllers');
        $gateUsages = [];

        // Recursively search all controller files
        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($controllerPath)
        );

        foreach ($iterator as $file) {
            if ($file->isFile() && $file->getExtension() === 'php') {
                $content = file_get_contents($file->getPathname());
                $relativePath = str_replace(base_path().DIRECTORY_SEPARATOR, '', $file->getPathname());

                // Search for Gate::authorize patterns
                if (preg_match_all('/Gate::authorize\s*\([^)]+\)/', $content, $matches, PREG_OFFSET_CAPTURE)) {
                    foreach ($matches[0] as $match) {
                        $lineNumber = substr_count(substr($content, 0, $match[1]), "\n") + 1;
                        $gateUsages[] = [
                            'file' => $relativePath,
                            'line' => $lineNumber,
                            'code' => trim($match[0]),
                        ];
                    }
                }

                // Also search for fully qualified Gate usage
                if (preg_match_all('/\\\\Illuminate\\\\Support\\\\Facades\\\\Gate::authorize\s*\([^)]+\)/', $content, $matches, PREG_OFFSET_CAPTURE)) {
                    foreach ($matches[0] as $match) {
                        $lineNumber = substr_count(substr($content, 0, $match[1]), "\n") + 1;
                        $gateUsages[] = [
                            'file' => $relativePath,
                            'line' => $lineNumber,
                            'code' => trim($match[0]),
                        ];
                    }
                }
            }
        }

        // Assert: No Gate::authorize calls should exist
        // EXPECTED BEHAVIOR: 0 Gate::authorize calls (all authorization via AuthorizationService)
        // BUG BEHAVIOR: Multiple Gate::authorize calls will be found

        $counterexamplesMessage = '';
        if (count($gateUsages) > 0) {
            $counterexamplesMessage = "\n\nCounterexamples found (".count($gateUsages)." instances):\n";
            foreach ($gateUsages as $usage) {
                $counterexamplesMessage .= sprintf(
                    "  - %s:%d\n    %s\n",
                    $usage['file'],
                    $usage['line'],
                    $usage['code']
                );
            }
            $counterexamplesMessage .= "\nThese should be replaced with AuthorizationService method calls per CLAUDE.md Section 6.3.";
        }

        $this->assertCount(
            0,
            $gateUsages,
            'BUG-007 CONFIRMED: Mixed authorization pattern detected. '.
            'Controllers are using Gate::authorize() instead of AuthorizationService. '.
            'CLAUDE.md Section 6.3 mandates AuthorizationService as the only authorization path. '.
            $counterexamplesMessage
        );

        // Additional assertion: Verify AuthorizationService exists and is being used elsewhere
        $authServicePath = app_path('Services/AuthorizationService.php');
        $this->assertFileExists(
            $authServicePath,
            'AuthorizationService should exist as the single authorization mechanism'
        );

        // Verify AuthorizationService has the expected methods
        $authServiceContent = file_get_contents($authServicePath);
        $expectedMethods = ['canViewBilling', 'canManageBilling', 'canViewReports'];

        foreach ($expectedMethods as $method) {
            $this->assertStringContainsString(
                'function '.$method,
                $authServiceContent,
                "AuthorizationService should have {$method}() method"
            );
        }
    }

    /**
     * Property 1: Bug Condition - BUG-009 Missing Audit Context
     *
     * **Validates: Requirements BUG-009**
     *
     * CRITICAL: This test MUST FAIL on unfixed code - failure confirms the bug exists.
     * DO NOT attempt to fix the test or the code when it fails.
     *
     * Bug Condition: PaymentService::void() does not call setAuditUserContext before transaction
     * Expected Behavior: Audit context should be set before DB::transaction() so triggers capture user_id
     *
     * Test Strategy:
     * 1. Create a billing record with a payment
     * 2. Call PaymentService::void() to void the payment
     * 3. Check audit_logs for entries related to the billing update (trigger trg_billing_au)
     * 4. Assert user_id is NOT NULL in audit_logs (MySQL only)
     *
     * EXPECTED OUTCOME ON UNFIXED CODE: Test FAILS (MySQL only)
     * - audit_logs.user_id will be NULL because setAuditUserContext was not called
     * - This confirms the bug exists (CCR-008 gap)
     *
     * Note: This test only runs on MySQL. SQLite does not support triggers with @current_user_id.
     */
    public function test_trigger_audit_log_fires_on_mysql(): void
    {
        // Skip test if not using MySQL (SQLite doesn't support @current_user_id in triggers)
        if (DB::getDriverName() !== 'mysql') {
            $this->markTestSkipped('This test only runs on MySQL (requires trigger support for @current_user_id)');
        }

        // Arrange: Create billing record with a payment
        $billing = $this->createBillingRecord(5000.00);

        $payment = Payment::create([
            'billing_id' => $billing->billing_id,
            'processed_by' => $this->adminUser->user_id,
            'amount_paid' => 2000.00,
            'payment_date' => now(),
            'payment_method' => Payment::METHOD_CASH,
            'reference_number' => 'REF-'.uniqid(),
        ]);

        // Verify payment was created and is not voided
        $this->assertDatabaseHas('payments', [
            'payment_id' => $payment->payment_id,
            'amount_paid' => 2000.00,
            'voided_at' => null,
        ]);

        // Sync billing status so it reflects the payment (unpaid → partial).
        // Without this, autoUpdateStatus inside void() sees no status change
        // and the trigger never fires.
        BillingService::syncBillingStatus($billing);
        $billing->refresh();
        $this->assertEquals('partial', $billing->status, 'Billing should be partial after payment');

        // Clear any existing audit logs for this billing to ensure clean test
        DB::table('audit_logs')
            ->where('target_table', 'billing')
            ->where('record_id', (string) $billing->billing_id)
            ->delete();

        // Act: Call PaymentService::void() to void the payment
        // This triggers an UPDATE on billing table (via BillingService::autoUpdateStatus)
        // which should fire trg_billing_au trigger
        PaymentService::void($this->adminUser, $payment);

        // Assert: Check that payment was voided
        $payment->refresh();
        $this->assertNotNull($payment->voided_at, 'Payment should be voided');

        // Check audit_logs for the billing UPDATE (Standard trigger trg_billing_au)
        // Wait for @current_user_id to be set in DB
        $auditLog = DB::table('audit_logs')
            ->where('target_table', 'billing')
            ->where('record_id', (string) $billing->billing_id)
            ->where('action', 'UPDATE')
            ->first();

        $this->assertNotNull(
            $auditLog,
            'Audit log entry should exist for billing update'
        );

        // Assert: Check that user_id is NOT NULL in audit_logs
        // EXPECTED BEHAVIOR: user_id should be set to $this->adminUser->user_id
        // BUG BEHAVIOR: user_id will be NULL because setAuditUserContext was not called

        $this->assertNotNull(
            $auditLog->changed_by,
            'BUG-009 CONFIRMED: PaymentService::void() does not set audit context before transaction. '.
            'Expected audit_logs.changed_by to be '.$this->adminUser->user_id.' (the user who voided the payment) '.
            'but got NULL. This is a CCR-008 gap - AuditService::setAuditUserContext() must be called before DB::transaction() '.
            'so that trigger trg_billing_au can capture @current_user_id. '.
            'The billing UPDATE inside void() fires the trigger, but without audit context, user_id is NULL.'
        );

        // Additional assertion: The user_id should match the actor who voided the payment
        $this->assertEquals(
            $this->adminUser->user_id,
            $auditLog->changed_by,
            'Audit log changed_by should match the user who initiated the void operation'
        );

        // Additional assertion: The action should be 'UPDATE' (billing status changed)
        $this->assertEquals(
            'UPDATE',
            $auditLog->action,
            'Audit log action should be "UPDATE" for billing status change'
        );

        // Additional assertion: Verify old_value and new_value exist
        $this->assertNotNull(
            $auditLog->old_value,
            'Audit log should capture old values (previous billing status)'
        );

        $this->assertNotNull(
            $auditLog->new_value,
            'Audit log should capture new values (updated billing status)'
        );
    }

    /**
     * Helper: Create a billing record with line items
     */
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

    /**
     * Helper: Create an active contract with tenant, room, and bed space
     */
    private function createActiveContract(): Contract
    {
        $tenant = Tenant::create($this->tenantAttributes([
            'first_name' => 'Bug',
            'last_name' => 'Test',
            'contact_number' => '09170000001',
            'email' => 'bug-test-'.uniqid().'@test.local',
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
            'expected_move_out_date' => '2026-10-01',
            'deposit_amount' => 1000,
            'status' => 'active',
        ]);
    }

    /**
     * Helper: Create a contract for a specific tenant
     */
    private function createContractForTenant(Tenant $tenant): Contract
    {
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
            'expected_move_out_date' => '2026-10-01',
            'deposit_amount' => 1000,
            'status' => 'active',
        ]);
    }
}
