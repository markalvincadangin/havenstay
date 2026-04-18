<?php

namespace Tests\Unit\Services;

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

class BillingServiceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
    }

    public function test_it_reconciles_status_in_correct_priority_paid_over_overdue()
    {
        $admin = User::create([
            'first_name' => 'Admin',
            'last_name' => 'User',
            'username' => 'admin',
            'email' => 'admin@example.com',
            'password_hash' => bcrypt('password'),
            'role_id' => Role::where('role_name', Role::ADMIN)->first()->role_id,
        ]);

        $tenant = Tenant::create($this->tenantAttributes());
        $room = Room::create($this->roomAttributes());
        $bed = BedSpace::create($this->bedSpaceAttributes(['room_id' => $room->room_id]));
        $contract = Contract::create($this->contractAttributes([
            'tenant_id' => $tenant->tenant_id,
            'bed_space_id' => $bed->bed_space_id,
            'created_by' => $admin->user_id,
        ]));

        $billing = Billing::create([
            'contract_id' => $contract->contract_id,
            'due_date' => now()->subDays(5)->toDateString(),
            'status' => Billing::STATUS_UNPAID,
            'billing_period_from' => now()->subMonth()->toDateString(),
            'billing_period_to' => now()->toDateString(),
        ]);
        
        BillingLineItem::create(['billing_id' => $billing->billing_id, 'amount' => 1000, 'item_description' => 'Rent', 'item_type' => 'base_rent']);
        Payment::create([
            'billing_id' => $billing->billing_id, 
            'amount_paid' => 1000, 
            'payment_date' => now()->toDateString(),
            'processed_by' => $admin->user_id,
        ]);
        
        BillingService::syncBillingStatus($billing);
        $this->assertEquals(Billing::STATUS_PAID, $billing->status);
    }

    public function test_it_reconciles_status_as_overdue_if_past_due_and_not_fully_paid()
    {
        $admin = User::create([
            'first_name' => 'Admin',
            'last_name' => 'User',
            'username' => 'admin_overdue',
            'email' => 'admin_overdue@example.com',
            'password_hash' => bcrypt('password'),
            'role_id' => Role::where('role_name', Role::ADMIN)->first()->role_id,
        ]);

        $tenant = Tenant::create($this->tenantAttributes());
        $room = Room::create($this->roomAttributes());
        $bed = BedSpace::create($this->bedSpaceAttributes(['room_id' => $room->room_id]));
        $contract = Contract::create($this->contractAttributes([
            'tenant_id' => $tenant->tenant_id,
            'bed_space_id' => $bed->bed_space_id,
            'created_by' => $admin->user_id,
        ]));

        $billing = Billing::create([
            'contract_id' => $contract->contract_id,
            'due_date' => now()->subDays(5)->toDateString(),
            'status' => Billing::STATUS_UNPAID,
            'billing_period_from' => now()->subMonth()->toDateString(),
            'billing_period_to' => now()->toDateString(),
        ]);
        
        BillingLineItem::create(['billing_id' => $billing->billing_id, 'amount' => 1000, 'item_description' => 'Rent', 'item_type' => 'base_rent']);
        Payment::create([
            'billing_id' => $billing->billing_id, 
            'amount_paid' => 500,
            'payment_date' => now()->toDateString(),
            'processed_by' => $admin->user_id,
        ]);
        
        BillingService::syncBillingStatus($billing);
        $this->assertEquals(Billing::STATUS_OVERDUE, $billing->status);
    }

    public function test_it_reconciles_status_as_partial_if_paid_but_not_due_yet()
    {
        $admin = User::create([
            'first_name' => 'Admin',
            'last_name' => 'User',
            'username' => 'admin_partial',
            'email' => 'admin_partial@example.com',
            'password_hash' => bcrypt('password'),
            'role_id' => Role::where('role_name', Role::ADMIN)->first()->role_id,
        ]);

        $tenant = Tenant::create($this->tenantAttributes());
        $room = Room::create($this->roomAttributes());
        $bed = BedSpace::create($this->bedSpaceAttributes(['room_id' => $room->room_id]));
        $contract = Contract::create($this->contractAttributes([
            'tenant_id' => $tenant->tenant_id,
            'bed_space_id' => $bed->bed_space_id,
            'created_by' => $admin->user_id,
        ]));

        $billing = Billing::create([
            'contract_id' => $contract->contract_id,
            'due_date' => now()->addDays(5)->toDateString(),
            'status' => Billing::STATUS_UNPAID,
            'billing_period_from' => now()->toDateString(),
            'billing_period_to' => now()->addMonth()->toDateString(),
        ]);
        
        BillingLineItem::create(['billing_id' => $billing->billing_id, 'amount' => 1000, 'item_description' => 'Rent', 'item_type' => 'base_rent']);
        Payment::create([
            'billing_id' => $billing->billing_id, 
            'amount_paid' => 500,
            'payment_date' => now()->toDateString(),
            'processed_by' => $admin->user_id,
        ]);
        
        BillingService::syncBillingStatus($billing);
        $this->assertEquals(Billing::STATUS_PARTIAL, $billing->status);
    }

    public function test_it_reconciles_status_as_unpaid_if_no_payments_and_not_due_yet()
    {
        $admin = User::create([
            'first_name' => 'Admin',
            'last_name' => 'User',
            'username' => 'admin_unpaid',
            'email' => 'admin_unpaid@example.com',
            'password_hash' => bcrypt('password'),
            'role_id' => Role::where('role_name', Role::ADMIN)->first()->role_id,
        ]);

        $tenant = Tenant::create($this->tenantAttributes());
        $room = Room::create($this->roomAttributes());
        $bed = BedSpace::create($this->bedSpaceAttributes(['room_id' => $room->room_id]));
        $contract = Contract::create($this->contractAttributes([
            'tenant_id' => $tenant->tenant_id,
            'bed_space_id' => $bed->bed_space_id,
            'created_by' => $admin->user_id,
        ]));

        $billing = Billing::create([
            'contract_id' => $contract->contract_id,
            'due_date' => now()->addDays(5)->toDateString(),
            'status' => Billing::STATUS_PARTIAL, // start from different status
            'billing_period_from' => now()->toDateString(),
            'billing_period_to' => now()->addMonth()->toDateString(),
        ]);
        
        BillingLineItem::create(['billing_id' => $billing->billing_id, 'amount' => 1000, 'item_description' => 'Rent', 'item_type' => 'base_rent']);
        
        BillingService::syncBillingStatus($billing);
        $this->assertEquals(Billing::STATUS_UNPAID, $billing->status);
    }
}
