<?php

namespace Tests\Feature;

use App\Enums\BedSpaceStatus;
use App\Enums\BillingStatus;
use App\Enums\ContractStatus;
use App\Enums\ContractType;
use App\Enums\PaymentMethod;
use App\Enums\RoomStatus;
use App\Enums\RoomType;
use App\Enums\TenantStatus;
use App\Models\BedSpace;
use App\Models\Billing;
use App\Models\BillingLineItem;
use App\Models\Contract;
use App\Models\Payment;
use App\Models\Role;
use App\Models\Room;
use App\Models\Tenant;
use App\Models\User;
use App\Services\Analytics\ReportService;
use App\Services\Core\AuthorizationService;
use App\Services\Operations\PaymentService;
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
     */
    public function test_preservation_non_voided_payment_calculation(): void
    {
        // Arrange: Create billing record with $10000 due
        $billing = $this->createBillingRecord(10000.00);

        // Property test: Test with various payment scenarios
        $testCases = [
            [
                'payments' => [
                    ['amount' => 2000.00, 'voided' => false],
                ],
                'expected_total' => 2000.00,
                'description' => 'Single non-voided payment',
            ],
            [
                'payments' => [
                    ['amount' => 1500.00, 'voided' => false],
                    ['amount' => 2500.00, 'voided' => false],
                    ['amount' => 1000.00, 'voided' => false],
                ],
                'expected_total' => 5000.00,
                'description' => 'Multiple non-voided payments',
            ],
        ];

        foreach ($testCases as $testCase) {
            Payment::where('billing_id', $billing->billing_id)->delete();

            $actualSum = 0.0;
            foreach ($testCase['payments'] as $paymentData) {
                $payment = Payment::create([
                    'billing_id' => $billing->billing_id,
                    'processed_by' => $this->adminUser->user_id,
                    'amount_paid' => $paymentData['amount'],
                    'payment_date' => now(),
                    'payment_method' => PaymentMethod::CASH->value,
                    'reference_number' => 'REF-'.uniqid(),
                ]);

                if (! $paymentData['voided']) {
                    $actualSum += $paymentData['amount'];
                }
            }

            $billing->refresh();

            $this->assertEquals(
                $testCase['expected_total'],
                $billing->total_paid,
                "Preservation test failed for case: {$testCase['description']}"
            );
        }
    }

    /**
     * Property 2: Preservation - Room Status for Available/Maintenance
     */
    public function test_preservation_room_status_for_vacancy_lifecycle_and_maintenance(): void
    {
        $testCases = [
            [
                'room_type' => RoomType::PRIVATE->value,
                'bed_spaces' => [
                    ['bed_label' => 'Bed 1', 'status' => BedSpaceStatus::VACANT->value],
                ],
                'expected_status' => RoomStatus::AVAILABLE,
                'description' => 'Private room with vacant bed should be available',
            ],
            [
                'room_type' => RoomType::SHARED->value,
                'bed_spaces' => [
                    ['bed_label' => 'Bed A', 'status' => BedSpaceStatus::VACANT->value],
                    ['bed_label' => 'Bed B', 'status' => BedSpaceStatus::VACANT->value],
                ],
                'expected_status' => RoomStatus::AVAILABLE,
                'description' => 'Shared room with vacant beds should be available',
            ],
            [
                'room_type' => RoomType::PRIVATE->value,
                'bed_spaces' => [
                    ['bed_label' => 'Bed 1', 'status' => BedSpaceStatus::VACANT->value],
                ],
                'manual_status' => RoomStatus::MAINTENANCE->value,
                'expected_status' => RoomStatus::MAINTENANCE,
                'description' => 'Room manually set to maintenance should preserve status',
            ],
        ];

        foreach ($testCases as $testCase) {
            $room = Room::create([
                'room_code' => 'R'.rand(1000, 9999),
                'room_type' => $testCase['room_type'],
                'capacity' => count($testCase['bed_spaces']),
                'monthly_rate' => 5000,
                'status' => $testCase['manual_status'] ?? RoomStatus::AVAILABLE->value,
            ]);

            foreach ($testCase['bed_spaces'] as $bedData) {
                BedSpace::create([
                    'room_id' => $room->room_id,
                    'bed_label' => $bedData['bed_label'],
                    'status' => $bedData['status'],
                ]);
            }

            RoomService::syncStatusAndCapacity($room);
            $room->refresh();

            $this->assertEquals(
                $testCase['expected_status'],
                $room->status,
                "Preservation test failed for case: {$testCase['description']}"
            );
        }
    }

    public function test_preservation_existing_transaction_logs(): void
    {
        $billing = $this->createBillingRecord(5000.00);

        PaymentService::record($this->adminUser, [
            'billing_id' => $billing->billing_id,
            'amount_paid' => 5000.00,
            'payment_date' => now()->format('Y-m-d'),
            'payment_method' => 'cash',
            'reference_number' => 'REF-'.uniqid(),
        ]);

        $txLog = DB::table('transaction_logs')
            ->where('action', 'POST_PAYMENT')
            ->latest('id')
            ->first();

        $this->assertNotNull($txLog);
        $this->assertEquals('committed', $txLog->status);
    }

    public function test_preservation_report_queries_without_filters(): void
    {
        for ($i = 0; $i < 3; $i++) {
            $billing = $this->createBillingRecord(5000.00);

            Payment::create([
                'billing_id' => $billing->billing_id,
                'processed_by' => $this->adminUser->user_id,
                'amount_paid' => 1000.00 + ($i * 500),
                'payment_date' => now(),
                'payment_method' => PaymentMethod::CASH->value,
                'reference_number' => 'REF-'.uniqid(),
            ]);
        }

        $report = ReportService::outstandingBalances([]);
        $this->assertGreaterThanOrEqual(3, $report['summary']['account_count']);
    }

    public function test_preservation_authorization_service_existing_usage(): void
    {
        $viewerRole = Role::where('role_name', 'viewer')->first();
        $viewerUser = User::factory()->create([
            'role_id' => $viewerRole->role_id,
            'is_active' => true,
        ]);

        $this->assertTrue(AuthorizationService::canViewBilling($this->adminUser));
        $this->assertFalse(AuthorizationService::canManageBilling($viewerUser));
    }

    private function createBillingRecord(float $amountDue): Billing
    {
        $contract = $this->createActiveContract();

        $billing = Billing::create([
            'contract_id' => $contract->contract_id,
            'billing_period_from' => '2026-05-01',
            'billing_period_to' => '2026-05-31',
            'due_date' => '2026-06-05',
            'status' => BillingStatus::UNPAID->value,
        ]);

        BillingLineItem::create([
            'billing_id' => $billing->billing_id,
            'item_type' => 'base_rent',
            'item_description' => 'Base rent',
            'amount' => $amountDue,
        ]);

        return $billing;
    }

    private function createActiveContract(): Contract
    {
        $tenant = Tenant::create($this->tenantAttributes([
            'status' => TenantStatus::ACTIVE->value,
        ]));

        $room = Room::create([
            'room_code' => 'R'.rand(100, 999),
            'room_type' => RoomType::PRIVATE->value,
            'capacity' => 1,
            'monthly_rate' => 5000,
            'status' => RoomStatus::AVAILABLE->value,
        ]);

        $bedSpace = BedSpace::create([
            'room_id' => $room->room_id,
            'bed_label' => 'Bed 1',
            'status' => BedSpaceStatus::OCCUPIED->value,
        ]);

        return Contract::create([
            'tenant_id' => $tenant->tenant_id,
            'bed_space_id' => $bedSpace->bed_space_id,
            'created_by' => $this->adminUser->user_id,
            'move_in_date' => '2026-04-01',
            'expected_move_out_date' => '2026-10-01',
            'deposit_amount' => 1000,
            'monthly_rate' => 5000,
            'contract_type' => ContractType::FIXED_TERM->value,
            'status' => ContractStatus::ACTIVE->value,
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
            'status' => TenantStatus::ACTIVE->value,
        ], $overrides);
    }
}
