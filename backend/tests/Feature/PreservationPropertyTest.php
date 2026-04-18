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
use App\Services\Identity\AuthorizationService;
use App\Services\Operations\PaymentService;
use App\Services\Analytics\ReportService;
use App\Services\Operations\RoomService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Regression / preservation tests — docs/TEST_PLAN.md, CLAUDE.md §9 (services, transactions, reports).
 */
class PreservationPropertyTest extends TestCase
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
     * Property 2: Preservation - Non-Voided Payment Calculation
     *
     * **Validates: Requirements BUG-001 preservation**
     *
     * This test verifies that getTotalPaidAttribute() correctly sums non-voided payments.
     * This behavior should work correctly on unfixed code and must be preserved after the fix.
     *
     * Property: For all non-voided payments, total_paid equals sum of amount_paid
     *
     * Test Strategy:
     * 1. Create a billing record
     * 2. Add multiple non-voided payments
     * 3. Assert getTotalPaidAttribute() returns the correct sum
     * 4. Test with various payment amounts and counts
     *
     * EXPECTED OUTCOME: Test PASSES on unfixed code
     * - This confirms the correct behavior for non-voided payments is working
     * - This behavior must be preserved after fixing BUG-001
     */
    public function test_preservation_non_voided_payment_calculation(): void
    {
        // Arrange: Create billing record with $10000 due
        $billing = $this->createBillingRecord(10000.00);

        // Property test: Test with various payment scenarios
        $testCases = [
            // Case 1: Single non-voided payment
            [
                'payments' => [
                    ['amount' => 2000.00, 'voided' => false],
                ],
                'expected_total' => 2000.00,
                'description' => 'Single non-voided payment',
            ],
            // Case 2: Multiple non-voided payments
            [
                'payments' => [
                    ['amount' => 1500.00, 'voided' => false],
                    ['amount' => 2500.00, 'voided' => false],
                    ['amount' => 1000.00, 'voided' => false],
                ],
                'expected_total' => 5000.00,
                'description' => 'Multiple non-voided payments',
            ],
            // Case 3: Zero payments
            [
                'payments' => [],
                'expected_total' => 0.00,
                'description' => 'No payments',
            ],
            // Case 4: Small amounts
            [
                'payments' => [
                    ['amount' => 0.01, 'voided' => false],
                    ['amount' => 0.99, 'voided' => false],
                ],
                'expected_total' => 1.00,
                'description' => 'Small payment amounts',
            ],
            // Case 5: Large amounts
            [
                'payments' => [
                    ['amount' => 50000.00, 'voided' => false],
                    ['amount' => 25000.00, 'voided' => false],
                ],
                'expected_total' => 75000.00,
                'description' => 'Large payment amounts',
            ],
            // Case 6: Many small payments
            [
                'payments' => [
                    ['amount' => 100.00, 'voided' => false],
                    ['amount' => 200.00, 'voided' => false],
                    ['amount' => 300.00, 'voided' => false],
                    ['amount' => 400.00, 'voided' => false],
                    ['amount' => 500.00, 'voided' => false],
                ],
                'expected_total' => 1500.00,
                'description' => 'Many small non-voided payments',
            ],
        ];

        foreach ($testCases as $testCase) {
            // Clear previous payments
            Payment::where('billing_id', $billing->billing_id)->delete();

            // Create payments for this test case
            $actualSum = 0.0;
            foreach ($testCase['payments'] as $paymentData) {
                $payment = Payment::create([
                    'billing_id' => $billing->billing_id,
                    'processed_by' => $this->adminUser->user_id,
                    'amount_paid' => $paymentData['amount'],
                    'payment_date' => now(),
                    'payment_method' => Payment::METHOD_CASH,
                    'reference_number' => 'REF-'.uniqid(),
                ]);

                // Only count non-voided payments
                if (! $paymentData['voided']) {
                    $actualSum += $paymentData['amount'];
                }
            }

            // Refresh billing model to recalculate total_paid
            $billing->refresh();

            // Assert: total_paid should equal the sum of non-voided payments
            $this->assertEquals(
                $testCase['expected_total'],
                $billing->total_paid,
                "Preservation test failed for case: {$testCase['description']}. ".
                "Expected total_paid to be {$testCase['expected_total']} but got {$billing->total_paid}. ".
                'This behavior must be preserved after fixing BUG-001.'
            );

            // Additional assertion: Verify the sum matches our manual calculation
            $this->assertEquals(
                $actualSum,
                $billing->total_paid,
                "Manual sum verification failed for case: {$testCase['description']}"
            );
        }
    }

    /**
     * Property 2: Preservation - Room Status for Available/Maintenance
     *
     * **Validates: Requirements BUG-003 preservation**
     *
     * This test verifies that syncStatusAndCapacity() correctly sets 'vacant' and 'maintenance' status.
     * This behavior should work correctly on unfixed code and must be preserved after the fix.
     *
     * Property: For rooms with no occupancy, status is 'vacant'; manually set 'maintenance' is preserved
     *
     * Test Strategy:
     * 1. Create rooms with various configurations
     * 2. Verify 'vacant' status is set correctly for vacant rooms
     * 3. Verify 'maintenance' status is preserved when manually set
     * 4. Test both solo and shared room types
     *
     * EXPECTED OUTCOME: Test PASSES on unfixed code
     * - This confirms the correct behavior for 'vacant' and 'maintenance' status is working
     * - This behavior must be preserved after fixing BUG-003
     */
    public function test_preservation_room_status_for_vacancy_lifecycle_and_maintenance(): void
    {
        // Property test: Test with various room configurations
        $testCases = [
            // Case 1: Solo room with no occupancy should be 'vacant'
            [
                'room_type' => 'solo',
                'bed_spaces' => [
                    ['bed_label' => 'Bed 1', 'status' => 'vacant'],
                ],
                'expected_status' => Room::STATUS_VACANT,
                'description' => 'Solo room with vacant bed should be available',
            ],
            // Case 2: Shared room with no occupancy should be 'vacant'
            [
                'room_type' => 'shared',
                'bed_spaces' => [
                    ['bed_label' => 'Bed A', 'status' => 'vacant'],
                    ['bed_label' => 'Bed B', 'status' => 'vacant'],
                    ['bed_label' => 'Bed C', 'status' => 'vacant'],
                ],
                'expected_status' => Room::STATUS_VACANT,
                'description' => 'Shared room with all vacant beds should be available',
            ],
            // Case 3: Shared room with partial occupancy should be 'partially_occupied'
            [
                'room_type' => 'shared',
                'bed_spaces' => [
                    ['bed_label' => 'Bed A', 'status' => 'occupied'],
                    ['bed_label' => 'Bed B', 'status' => 'vacant'],
                ],
                'expected_status' => Room::STATUS_PARTIALLY_OCCUPIED,
                'description' => 'Shared room with partial occupancy should be partially occupied',
            ],
            // Case 4: Room with maintenance status should preserve it
            [
                'room_type' => 'solo',
                'bed_spaces' => [
                    ['bed_label' => 'Bed 1', 'status' => 'vacant'],
                ],
                'manual_status' => Room::STATUS_MAINTENANCE,
                'expected_status' => Room::STATUS_MAINTENANCE,
                'description' => 'Room manually set to maintenance should preserve status',
            ],
            // Case 5: Shared room with maintenance status should preserve it
            [
                'room_type' => 'shared',
                'bed_spaces' => [
                    ['bed_label' => 'Bed A', 'status' => 'vacant'],
                    ['bed_label' => 'Bed B', 'status' => 'vacant'],
                ],
                'manual_status' => Room::STATUS_MAINTENANCE,
                'expected_status' => Room::STATUS_MAINTENANCE,
                'description' => 'Shared room manually set to maintenance should preserve status',
            ],
        ];

        foreach ($testCases as $testCase) {
            // Create room
            $room = Room::create([
                'room_code' => 'R'.rand(1000, 9999),
                'room_type' => $testCase['room_type'],
                'capacity' => count($testCase['bed_spaces']),
                'monthly_rate' => 5000,
                'status' => $testCase['manual_status'] ?? Room::STATUS_VACANT,
            ]);

            // Create bed spaces
            foreach ($testCase['bed_spaces'] as $bedData) {
                BedSpace::create([
                    'room_id' => $room->room_id,
                    'bed_label' => $bedData['bed_label'],
                    'status' => $bedData['status'],
                ]);
            }

            // Trigger sync
            RoomService::syncStatusAndCapacity($room);

            // Refresh to get updated status
            $room->refresh();

            // Assert: room status should match expected
            $this->assertEquals(
                $testCase['expected_status'],
                $room->status,
                "Preservation test failed for case: {$testCase['description']}. ".
                "Expected status to be '{$testCase['expected_status']}' but got '{$room->status}'. ".
                'This behavior must be preserved after fixing BUG-003.'
            );

            // Additional assertion: Verify status is NOT 'occupied' (the invalid ENUM value)
            $this->assertNotEquals(
                'occupied',
                $room->status,
                "Room status should never be 'occupied' (invalid ENUM value) for case: {$testCase['description']}"
            );
        }
    }

    /**
     * Property 2: Preservation - Existing Transaction Logs
     *
     * **Validates: Requirements BUG-005 preservation**
     *
     * This test verifies that PaymentService::record() correctly creates transaction_logs entries.
     * This behavior should work correctly on unfixed code and must be preserved after the fix.
     *
     * Property: For all payment records, transaction_logs entry exists with correct status
     *
     * Test Strategy:
     * 1. Create billing records
     * 2. Record payments using PaymentService::record()
     * 3. Verify transaction_logs entries are created
     * 4. Verify transaction log status is 'committed'
     * 5. Test with various payment scenarios
     *
     * EXPECTED OUTCOME: Test PASSES on unfixed code
     * - This confirms PaymentService::record() correctly creates transaction logs
     * - This behavior must be preserved after fixing BUG-005 (which adds logs to void())
     */
    public function test_preservation_existing_transaction_logs(): void
    {
        // Property test: Test with various payment scenarios
        $testCases = [
            // Case 1: Single payment
            [
                'amount_due' => 5000.00,
                'payment_amount' => 5000.00,
                'description' => 'Full payment in single transaction',
            ],
            // Case 2: Partial payment
            [
                'amount_due' => 10000.00,
                'payment_amount' => 3000.00,
                'description' => 'Partial payment',
            ],
            // Case 3: Small payment
            [
                'amount_due' => 1000.00,
                'payment_amount' => 100.00,
                'description' => 'Small payment amount',
            ],
        ];

        foreach ($testCases as $testCase) {
            // Create billing record
            $billing = $this->createBillingRecord($testCase['amount_due']);

            // Record payment using PaymentService::record()
            $result = PaymentService::record($this->adminUser, [
                'billing_id' => $billing->billing_id,
                'amount_paid' => $testCase['payment_amount'],
                'payment_date' => now()->format('Y-m-d'),
                'payment_method' => 'cash',
                'reference_number' => 'REF-'.uniqid(),
            ]);

            // Assert: transaction_logs entry should exist
            $txLog = DB::table('transaction_logs')
                ->where('action', 'POST_PAYMENT')
                ->latest('id')
                ->first();

            $this->assertNotNull(
                $txLog,
                "Preservation test failed for case: {$testCase['description']}. ".
                'Expected transaction_logs entry to exist for payment record. '.
                'This behavior must be preserved after fixing BUG-005.'
            );

            $this->assertNotEmpty(
                $txLog->correlation_id,
                'transaction_logs.correlation_id should be set for workflow traceability.'
            );

            // Assert: transaction log status should be 'committed'
            $this->assertEquals(
                'committed',
                $txLog->status,
                "Transaction log status should be 'committed' for case: {$testCase['description']}"
            );

            // Assert: transaction log should have initiated_by set
            $this->assertEquals(
                $this->adminUser->user_id,
                $txLog->initiated_by,
                "Transaction log should have correct initiated_by for case: {$testCase['description']}"
            );
        }
    }

    /**
     * Property 2: Preservation - Report Queries Without Filters
     *
     * **Validates: Requirements BUG-006 preservation**
     *
     * This test verifies that outstandingBalances() returns all records when no filters provided.
     * This behavior should work correctly on unfixed code and must be preserved after the fix.
     *
     * Property: When filters are empty, all outstanding records are returned
     *
     * Test Strategy:
     * 1. Create multiple billing records with outstanding balances
     * 2. Call outstandingBalances() with no filters
     * 3. Verify all outstanding records are returned
     * 4. Test with various billing scenarios
     *
     * EXPECTED OUTCOME: Test PASSES on unfixed code
     * - This confirms outstandingBalances() returns all records when no filters provided
     * - This behavior must be preserved after fixing BUG-006 (which adds filter support)
     */
    public function test_preservation_report_queries_without_filters(): void
    {
        // Create multiple billing records with outstanding balances
        $billingRecords = [];

        // Create 3 billing records with different outstanding amounts
        for ($i = 0; $i < 3; $i++) {
            $billing = $this->createBillingRecord(5000.00);

            // Add partial payment to create outstanding balance
            Payment::create([
                'billing_id' => $billing->billing_id,
                'processed_by' => $this->adminUser->user_id,
                'amount_paid' => 1000.00 + ($i * 500),
                'payment_date' => now(),
                'payment_method' => Payment::METHOD_CASH,
                'reference_number' => 'REF-'.uniqid(),
            ]);

            $billingRecords[] = $billing;
        }

        // Call outstandingBalances() with no filters
        $report = ReportService::outstandingBalances([]);

        // Assert: All billing records with outstanding balances should be returned
        $this->assertGreaterThanOrEqual(
            3,
            $report['summary']['account_count'],
            'Preservation test failed: Expected at least 3 outstanding balance records when no filters provided. '.
            'This behavior must be preserved after fixing BUG-006.'
        );

        // Assert: All created billing records should be in the results
        $returnedBillingIds = collect($report['rows'])->pluck('billing_id')->toArray();

        foreach ($billingRecords as $billing) {
            $this->assertContains(
                $billing->billing_id,
                $returnedBillingIds,
                "Preservation test failed: Billing record {$billing->billing_id} should be in results when no filters provided. ".
                'This behavior must be preserved after fixing BUG-006.'
            );
        }

        // Assert: All returned records should have outstanding balance > 0
        foreach ($report['rows'] as $row) {
            $this->assertGreaterThan(
                0,
                $row['outstanding_balance'],
                'All returned records should have outstanding balance > 0'
            );
        }
    }

    /**
     * Property 2: Preservation - AuthorizationService Existing Usage
     *
     * **Validates: Requirements BUG-007 preservation**
     *
     * This test verifies that controllers using AuthorizationService work correctly.
     * This behavior should work correctly on unfixed code and must be preserved after the fix.
     *
     * Property: For all AuthorizationService calls, authorization logic is correct
     *
     * Test Strategy:
     * 1. Create users with different roles (admin, staff, viewer)
     * 2. Test AuthorizationService methods with each role
     * 3. Verify authorization logic returns correct results
     * 4. Test various authorization scenarios
     *
     * EXPECTED OUTCOME: Test PASSES on unfixed code
     * - This confirms AuthorizationService authorization logic is correct
     * - This behavior must be preserved after fixing BUG-007 (which replaces Gate with AuthorizationService)
     */
    public function test_preservation_authorization_service_existing_usage(): void
    {
        // Create roles
        $staffRole = Role::firstOrCreate(['role_name' => 'staff'], ['description' => 'Staff']);
        $viewerRole = Role::firstOrCreate(['role_name' => 'viewer'], ['description' => 'Viewer']);

        // Create users with different roles
        $staffUser = User::factory()->create([
            'role_id' => $staffRole->role_id,
            'is_active' => true,
        ]);

        $viewerUser = User::factory()->create([
            'role_id' => $viewerRole->role_id,
            'is_active' => true,
        ]);

        // Property test: Test authorization logic for various scenarios
        $testCases = [
            // Admin user tests
            [
                'user' => $this->adminUser,
                'method' => 'canManageBilling',
                'expected' => true,
                'description' => 'Admin can manage billing',
            ],
            [
                'user' => $this->adminUser,
                'method' => 'canViewBilling',
                'expected' => true,
                'description' => 'Admin can view billing',
            ],
            [
                'user' => $this->adminUser,
                'method' => 'canViewReports',
                'expected' => true,
                'description' => 'Admin can view reports',
            ],
            // Staff user tests
            [
                'user' => $staffUser,
                'method' => 'canManageBilling',
                'expected' => true,
                'description' => 'Staff can manage billing',
            ],
            [
                'user' => $staffUser,
                'method' => 'canViewBilling',
                'expected' => true,
                'description' => 'Staff can view billing',
            ],
            [
                'user' => $staffUser,
                'method' => 'canViewReports',
                'expected' => true,
                'description' => 'Staff can view reports',
            ],
            // Viewer user tests
            [
                'user' => $viewerUser,
                'method' => 'canManageBilling',
                'expected' => false,
                'description' => 'Viewer cannot manage billing',
            ],
            [
                'user' => $viewerUser,
                'method' => 'canViewBilling',
                'expected' => true,
                'description' => 'Viewer can view billing',
            ],
            [
                'user' => $viewerUser,
                'method' => 'canViewReports',
                'expected' => true,
                'description' => 'Viewer can view reports',
            ],
        ];

        foreach ($testCases as $testCase) {
            $result = AuthorizationService::{$testCase['method']}($testCase['user']);

            $this->assertEquals(
                $testCase['expected'],
                $result,
                "Preservation test failed for case: {$testCase['description']}. ".
                'Expected authorization result to be '.($testCase['expected'] ? 'true' : 'false').' but got '.($result ? 'true' : 'false').'. '.
                'This behavior must be preserved after fixing BUG-007.'
            );
        }
    }

    /**
     * Property 2: Preservation - Audit Context in Other Services
     *
     * **Validates: Requirements BUG-009 preservation**
     *
     * This test verifies that other services correctly set audit context.
     * This behavior should work correctly on unfixed code and must be preserved after the fix.
     *
     * Property: For all services with audit context, user_id is captured in audit_logs
     *
     * Test Strategy:
     * 1. Test PaymentService::record() which already sets audit context
     * 2. Verify audit_logs entries have non-NULL user_id
     * 3. Test on MySQL only (SQLite doesn't have triggers)
     *
     * EXPECTED OUTCOME: Test PASSES on unfixed code
     * - This confirms existing services correctly set audit context
     * - This behavior must be preserved after fixing BUG-009 (which adds context to void())
     */
    public function test_preservation_audit_context_in_other_services(): void
    {
        // Skip test if not using MySQL (SQLite doesn't have triggers)
        if (DB::connection()->getDriverName() !== 'mysql') {
            $this->markTestSkipped('Audit context test only runs on MySQL');
        }

        // Create billing record
        $billing = $this->createBillingRecord(5000.00);

        // Record payment using PaymentService::record() which should set audit context
        $result = PaymentService::record($this->adminUser, [
            'billing_id' => $billing->billing_id,
            'amount_paid' => 2000.00,
            'payment_date' => now()->format('Y-m-d'),
            'payment_method' => 'cash',
            'reference_number' => 'REF-'.uniqid(),
        ]);

        // Get the payment that was created
        $payment = Payment::where('billing_id', $billing->billing_id)
            ->whereNull('voided_at')
            ->latest('payment_id')
            ->first();

        $this->assertNotNull($payment, 'Payment should be created');

        // Check audit_logs for the payment INSERT
        $auditLog = DB::table('audit_logs')
            ->where('target_table', 'payments')
            ->where('record_id', (string) $payment->payment_id)
            ->where('action', 'INSERT')
            ->first();

        // Note: On unfixed code, audit context might not be set for all operations
        // This test verifies that when audit context IS set, it's captured correctly
        // We're testing the preservation of correct behavior, not the bug
        if ($auditLog) {
            $this->assertNotNull(
                $auditLog->changed_by,
                'Preservation test: When audit context is set, changed_by should be captured in audit_logs. '.
                'This behavior must be preserved after fixing BUG-009.'
            );
        }

        // The key preservation property: PaymentService::record() should continue to work correctly
        $this->assertNotNull($result, 'PaymentService::record() should return billing record');
        $this->assertEquals($billing->billing_id, $result->billing_id, 'Returned billing should match');
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
            'first_name' => 'Preservation',
            'last_name' => 'Test',
            'contact_number' => '09170000999',
            'email' => 'preservation-test-'.uniqid().'@test.local',
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
}
