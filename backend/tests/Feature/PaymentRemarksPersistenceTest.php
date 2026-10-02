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
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * End-to-end verification of payment remarks persistence across API, service,
 * model, and database layers (HS-BL-01).
 */
class PaymentRemarksPersistenceTest extends TestCase
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

    public function test_sqlite_schema_has_required_slice_1_columns(): void
    {
        $this->assertTrue(
            Schema::hasColumn('payments', 'remarks'),
            'payments table must contain remarks column in test database'
        );

        $this->assertTrue(
            Schema::hasColumn('users', 'avatar_url'),
            'users table must contain avatar_url column in test database'
        );
    }

    public function test_post_payments_persists_remarks_and_returns_in_resource(): void
    {
        $billing = $this->createBillingRecord(5000.00);

        $testRemarks = 'Check #48291 deposited via BDO';

        $response = $this->actingAs($this->adminUser)->postJson('/api/payments', [
            'billing_id' => $billing->billing_id,
            'payment_category' => 'billing',
            'amount_paid' => 5000.00,
            'payment_date' => now()->toDateString(),
            'payment_method' => PaymentMethod::BANK_TRANSFER->value,
            'reference_number' => 'BDO-987654321',
            'remarks' => $testRemarks,
        ]);

        $response->assertCreated();
        $response->assertJsonPath('data.remarks', $testRemarks);
        $response->assertJsonPath('data.notes', $testRemarks);

        $paymentId = $response->json('data.payment_id');
        $this->assertNotNull($paymentId);

        // Verify direct database persistence
        $this->assertDatabaseHas('payments', [
            'payment_id' => $paymentId,
            'remarks' => $testRemarks,
        ]);

        // Verify retrieval through GET endpoint
        $getResponse = $this->actingAs($this->adminUser)->getJson("/api/payments/{$paymentId}");
        $getResponse->assertOk();
        $getResponse->assertJsonPath('data.remarks', $testRemarks);
        $getResponse->assertJsonPath('data.notes', $testRemarks);
    }

    public function test_post_payments_with_null_remarks_persists_as_null(): void
    {
        $billing = $this->createBillingRecord(3000.00);

        $response = $this->actingAs($this->adminUser)->postJson('/api/payments', [
            'billing_id' => $billing->billing_id,
            'payment_category' => 'billing',
            'amount_paid' => 3000.00,
            'payment_date' => now()->toDateString(),
            'payment_method' => PaymentMethod::CASH->value,
        ]);

        $response->assertCreated();
        $response->assertJsonPath('data.remarks', null);
        $response->assertJsonPath('data.notes', null);

        $paymentId = $response->json('data.payment_id');
        $this->assertDatabaseHas('payments', [
            'payment_id' => $paymentId,
            'remarks' => null,
        ]);
    }

    public function test_composite_initial_payment_preserves_remarks_on_both_payments(): void
    {
        $contract = $this->createActiveContract();
        $billing = Billing::create([
            'contract_id' => $contract->contract_id,
            'billing_period_from' => '2026-05-01',
            'billing_period_to' => '2026-05-31',
            'due_date' => '2026-05-05',
            'status' => BillingStatus::UNPAID->value,
        ]);

        BillingLineItem::create([
            'billing_id' => $billing->billing_id,
            'item_type' => 'base_rent',
            'item_description' => 'Initial rent',
            'amount' => 5000.00,
        ]);

        $response = $this->actingAs($this->adminUser)->postJson('/api/payments/composite-initial', [
            'billing_id' => $billing->billing_id,
            'contract_id' => $contract->contract_id,
            'rent_amount' => 5000.00,
            'deposit_amount' => 5000.00,
            'payment_date' => now()->toDateString(),
            'payment_method' => PaymentMethod::CASH->value,
            'remarks' => 'Initial onboarding package',
        ]);

        $response->assertCreated();

        // Rent payment assertion
        $this->assertDatabaseHas('payments', [
            'billing_id' => $billing->billing_id,
            'payment_category' => 'billing',
            'remarks' => 'Initial onboarding package (Part of composite initial settlement)',
        ]);

        // Deposit payment assertion
        $this->assertDatabaseHas('payments', [
            'contract_id' => $contract->contract_id,
            'payment_category' => 'deposit',
            'remarks' => 'Initial onboarding package (Part of composite initial settlement)',
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
        $tenant = Tenant::create([
            'first_name' => 'Alice',
            'last_name' => 'Smith',
            'email' => 'alice'.uniqid().'@example.com',
            'contact_number' => '+639170000000',
            'emergency_contact_name' => 'Bob Smith',
            'emergency_contact_number' => '+639170000001',
            'address' => '456 Sample St, Manila',
            'status' => TenantStatus::ACTIVE->value,
        ]);

        $room = Room::create([
            'room_code' => 'R'.uniqid(),
            'room_type' => RoomType::SHARED->value,
            'capacity' => 2,
            'monthly_rate' => 5000.00,
            'status' => RoomStatus::AVAILABLE->value,
        ]);

        $bedSpace = BedSpace::create([
            'room_id' => $room->room_id,
            'bed_label' => 'A1',
            'status' => BedSpaceStatus::OCCUPIED->value,
        ]);

        return Contract::create([
            'tenant_id' => $tenant->tenant_id,
            'bed_space_id' => $bedSpace->bed_space_id,
            'created_by' => $this->adminUser->user_id,
            'contract_type' => ContractType::FIXED_TERM->value,
            'move_in_date' => '2026-05-01',
            'expected_move_out_date' => '2026-11-01',
            'monthly_rate' => 5000.00,
            'deposit_amount' => 5000.00,
            'status' => ContractStatus::ACTIVE->value,
        ]);
    }
}
