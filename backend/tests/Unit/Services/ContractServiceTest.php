<?php

namespace Tests\Unit\Services;

use App\Models\BedSpace;
use App\Models\Contract;
use App\Models\Role;
use App\Models\Room;
use App\Models\Tenant;
use App\Models\User;
use App\Enums\ContractStatus;
use App\Services\Operations\ContractService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class ContractServiceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();
    }

    public function test_it_prohibits_deposit_exceeding_two_months_rent_per_ra_9653()
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
        $room = Room::create($this->roomAttributes(['monthly_rate' => 10000]));
        $bed = BedSpace::create($this->bedSpaceAttributes(['room_id' => $room->room_id]));

        $data = [
            'tenant_id' => $tenant->tenant_id,
            'bed_space_id' => $bed->bed_space_id,
            'move_in_date' => now()->toDateString(),
            'deposit_amount' => 20000.01, // > 2 months
        ];

        $this->expectException(ValidationException::class);
        $this->expectExceptionMessage('R.A. 9653 Violation');

        ContractService::create($admin, $data);
    }

    public function test_it_allows_deposit_at_exactly_two_months_rent()
    {
        $admin = User::create([
            'first_name' => 'Admin',
            'last_name' => 'User',
            'username' => 'admin2',
            'email' => 'admin2@example.com',
            'password_hash' => bcrypt('password'),
            'role_id' => Role::where('role_name', Role::ADMIN)->first()->role_id,
        ]);
        $tenant = Tenant::create($this->tenantAttributes());
        $room = Room::create($this->roomAttributes(['monthly_rate' => 10000]));
        $bed = BedSpace::create($this->bedSpaceAttributes(['room_id' => $room->room_id]));

        $data = [
            'tenant_id' => $tenant->tenant_id,
            'bed_space_id' => $bed->bed_space_id,
            'move_in_date' => now()->toDateString(),
            'deposit_amount' => 20000.00, // Exactly 2 months
        ];

        $contract = ContractService::create($admin, $data);
        $this->assertInstanceOf(Contract::class, $contract);
        $this->assertEquals(20000.00, $contract->deposit_amount);
    }

    public function test_it_validates_rent_control_cap_on_price_updates()
    {
        $admin = User::create([
            'first_name' => 'Admin',
            'last_name' => 'User',
            'username' => 'admin3',
            'email' => 'admin3@example.com',
            'password_hash' => bcrypt('password'),
            'role_id' => Role::where('role_name', Role::ADMIN)->first()->role_id,
        ]);
        $tenant = Tenant::create($this->tenantAttributes());
        $room = Room::create($this->roomAttributes(['monthly_rate' => 5000]));
        $bed = BedSpace::create($this->bedSpaceAttributes(['room_id' => $room->room_id]));

        // Create historical contract (from 6 months ago)
        Contract::create([
            'tenant_id' => $tenant->tenant_id,
            'bed_space_id' => $bed->bed_space_id,
            'created_by' => $admin->user_id,
            'move_in_date' => now()->subMonths(6)->toDateString(),
            'monthly_rate' => 5000,
            'monthly_rate_override' => 5000,
            'deposit_amount' => 5000,
            'status' => ContractStatus::COMPLETED->value,
            'contract_type' => \App\Enums\ContractType::FIXED_TERM->value,
            'created_at' => now()->subMonths(6),
        ]);

        // Create current contract
        $contract = Contract::create([
            'tenant_id' => $tenant->tenant_id,
            'bed_space_id' => $bed->bed_space_id,
            'created_by' => $admin->user_id,
            'move_in_date' => now()->toDateString(),
            'monthly_rate' => 5000,
            'monthly_rate_override' => 5000,
            'deposit_amount' => 5000,
            'status' => ContractStatus::ACTIVE->value,
            'contract_type' => \App\Enums\ContractType::FIXED_TERM->value,
            'created_at' => now(),
        ]);

        $this->expectException(ValidationException::class);
        $this->expectExceptionMessage('Rent Control Act Violation');

        ContractService::update($admin, $contract, [
            'monthly_rate_override' => 6000, // > 1% increase from the 5000 rate found in history
        ]);
    }
}
