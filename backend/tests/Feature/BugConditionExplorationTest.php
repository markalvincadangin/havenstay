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
use App\Enums\BillingStatus;
use App\Enums\RoomStatus;
use App\Enums\RoomType;
use App\Enums\ContractStatus;
use App\Enums\TenantStatus;
use App\Enums\BedSpaceStatus;
use App\Services\Core\AuthorizationService;
use App\Services\Operations\BillingService;
use App\Services\Operations\PaymentService;
use App\Services\Analytics\ReportService;
use App\Services\Operations\RoomService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Regression tests for behaviors described in CLAUDE.md §13 (BUG-001–009 resolved).
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

    public function test_bug_001_voided_payments_are_counted_in_total_paid(): void
    {
        $billing = $this->createBillingRecord(5000.00);

        $payment = Payment::create([
            'billing_id' => $billing->billing_id,
            'processed_by' => $this->adminUser->user_id,
            'amount_paid' => 2000.00,
            'payment_date' => now(),
            'payment_method' => PaymentMethod::CASH->value,
            'reference_number' => 'REF-'.uniqid(),
        ]);

        $payment->update([
            'voided_at' => now(),
            'voided_by' => $this->adminUser->user_id,
            'void_reason' => 'Test void',
        ]);

        $billing->refresh();
        $this->assertEquals(0.0, (float)$billing->total_paid);
    }

    public function test_bug_003_room_status_set_to_invalid_occupied_enum(): void
    {
        $room = Room::create([
            'room_code' => 'R303',
            'room_type' => RoomType::PRIVATE->value,
            'capacity' => 1,
            'monthly_rate' => 5000,
            'status' => RoomStatus::AVAILABLE->value,
        ]);

        $bedSpace = BedSpace::create([
            'room_id' => $room->room_id,
            'bed_label' => 'Bed 1',
            'status' => BedSpaceStatus::VACANT->value,
        ]);

        $tenant = Tenant::create($this->tenantAttributes());

        $contract = Contract::create([
            'tenant_id' => $tenant->tenant_id,
            'bed_space_id' => $bedSpace->bed_space_id,
            'created_by' => $this->adminUser->user_id,
            'move_in_date' => '2026-04-01',
            'expected_move_out_date' => '2026-10-01',
            'deposit_amount' => 1000,
            'monthly_rate' => 5000,
            'contract_type' => \App\Enums\ContractType::FIXED_TERM->value,
            'status' => ContractStatus::ACTIVE->value,
        ]);

        RoomService::occupyBedSpace($this->adminUser, $bedSpace->fresh());
        $room->refresh();

        $this->assertNotEquals('occupied', $room->status);
        $this->assertEquals(RoomStatus::UNAVAILABLE, $room->status);
    }

    public function test_bug_005_payment_void_missing_transaction_log(): void
    {
        $billing = $this->createBillingRecord(5000.00);

        $payment = Payment::create([
            'billing_id' => $billing->billing_id,
            'processed_by' => $this->adminUser->user_id,
            'amount_paid' => 2000.00,
            'payment_date' => now(),
            'payment_method' => PaymentMethod::CASH->value,
            'payment_category' => 'billing',
            'reference_number' => 'REF-'.uniqid(),
        ]);

        PaymentService::void($this->adminUser, $payment);

        $this->assertDatabaseHas('transaction_logs', [
            'action' => 'VOID_PAYMENT',
            'status' => 'committed',
        ]);
    }

    public function test_bug_006_outstanding_balances_filters_silently_dropped(): void
    {
        $tenant1 = Tenant::create($this->tenantAttributes(['email' => 't1@test.local']));
        $contract1 = $this->createContractForTenant($tenant1);

        $billing1 = Billing::create([
            'contract_id' => $contract1->contract_id,
            'billing_period_from' => '2026-05-01',
            'billing_period_to' => '2026-05-31',
            'due_date' => '2026-06-05',
            'status' => BillingStatus::UNPAID->value,
        ]);
        
        BillingLineItem::create([
            'billing_id' => $billing1->billing_id,
            'item_type' => 'base_rent',
            'item_description' => 'Rent',
            'amount' => 5000.00,
        ]);

        $filters = [
            'tenant_id' => $tenant1->tenant_id,
            'due_from' => '2026-06-01',
            'due_to' => '2026-06-15',
        ];

        $result = ReportService::outstandingBalances($filters);
        $this->assertCount(1, $result['rows']);
    }

    private function createBillingRecord(float $amountDue): Billing
    {
        $tenant = Tenant::create($this->tenantAttributes());
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
        $contract = Contract::create([
            'tenant_id' => $tenant->tenant_id,
            'bed_space_id' => $bedSpace->bed_space_id,
            'created_by' => $this->adminUser->user_id,
            'move_in_date' => '2026-04-01',
            'expected_move_out_date' => '2026-10-01',
            'deposit_amount' => 1000,
            'monthly_rate' => 5000,
            'contract_type' => \App\Enums\ContractType::FIXED_TERM->value,
            'status' => ContractStatus::ACTIVE->value,
        ]);

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
            'item_description' => 'Rent',
            'amount' => $amountDue,
        ]);

        return $billing;
    }

    private function createContractForTenant(Tenant $tenant): Contract
    {
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
            'contract_type' => \App\Enums\ContractType::FIXED_TERM->value,
            'status' => ContractStatus::ACTIVE->value,
        ]);
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
            'status' => TenantStatus::ACTIVE->value,
        ], $overrides);
    }
}
