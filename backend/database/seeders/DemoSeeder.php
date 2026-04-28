<?php

namespace Database\Seeders;

use App\Models\Utility;
use App\Models\UtilityRate;
use App\Models\Meter;
use App\Models\MeterAssignment;
use App\Models\MeterReading;
use App\Models\BedSpace;
use App\Models\Billing;
use App\Models\Contract;
use App\Models\Payment;
use App\Models\Role;
use App\Models\Room;
use App\Models\Tenant;
use App\Models\User;
use App\Enums\RoomType;
use App\Enums\RoomStatus;
use App\Enums\ContractStatus;
use App\Enums\BillingStatus;
use App\Enums\LineItemType;
use App\Enums\BedSpaceStatus;
use App\Enums\TenantStatus;
use App\Enums\PaymentMethod;
use App\Enums\PaymentCategory;
use App\Services\Core\AuditService;
use App\Services\Operations\RoomService;
use App\Services\Operations\TenantService;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;

class DemoSeeder extends Seeder
{
    private const DEMO_PASSWORD = 'HavenStay123!';

    public function run(): void
    {
        try {
            echo "[seeder] Starting users...\n";
            $users = $this->seedUsers();
            echo "[seeder] Users seeded.\n";

            AuditService::setSystemContext();
            echo "[seeder] Audit context set.\n";

            echo "[seeder] Starting utilities...\n";
            $this->seedUtilities();
            echo "[seeder] Utilities seeded.\n";

            echo "[seeder] Starting inventory...\n";
            $inventory = $this->seedInventory();
            echo "[seeder] Inventory seeded (Rooms: " . count($inventory['rooms']) . ").\n";
            
            echo "[seeder] Starting meters...\n";
            $this->seedMeters($inventory['rooms']);
            echo "[seeder] Meters seeded.\n";

            echo "[seeder] Starting operational data scenarios...\n";
            $this->seedOperationalData($users, $inventory);
            echo "[seeder] Operational scenarios complete.\n";
            gc_collect_cycles();

            echo "[seeder] Starting final sync...\n";
            $this->syncInventoryStatus($inventory['rooms']);
            echo "[seeder] Final sync complete.\n";
            gc_collect_cycles();
        } catch (\Throwable $e) {
            echo "\n[SEEDER ERROR] " . $e->getMessage() . "\n";
            echo "[SEEDER TRACE] " . $e->getTraceAsString() . "\n";
            throw $e;
        }
    }

    private function seedUsers(): array
    {
        $adminRole = Role::where('role_name', \App\Enums\RoleEnum::ADMIN->value)->firstOrFail();
        $staffRole = Role::where('role_name', \App\Enums\RoleEnum::STAFF->value)->firstOrFail();

        $admin = User::updateOrCreate(['username' => 'admin'], [
            'first_name' => 'System', 
            'last_name' => 'Admin', 
            'email' => 'admin@havenstay.com',
            'password_hash' => Hash::make(self::DEMO_PASSWORD), 
            'role_id' => $adminRole->role_id, 
            'is_active' => true,
        ]);

        $staff = User::updateOrCreate(['username' => 'elena.santos'], [
            'first_name' => 'Elena', 
            'last_name' => 'Santos', 
            'email' => 'elena.santos@havenstay.ph',
            'password_hash' => Hash::make(self::DEMO_PASSWORD), 
            'role_id' => $staffRole->role_id, 
            'is_active' => true,
        ]);

        return ['admin' => $admin, 'staff' => $staff];
    }

    private function seedUtilities(): void
    {
        // Electricity (Meralco + Admin Overhead)
        $elec = Utility::updateOrCreate(['name' => 'Electricity'], ['unit_of_measurement' => 'kWh']);
        UtilityRate::updateOrCreate(['utility_id' => $elec->utility_id, 'effective_from' => '2025-01-01'], ['base_rate' => 18.50]);

        // Water (Maynilad/Manila Water Commercial Rate)
        $water = Utility::updateOrCreate(['name' => 'Water'], ['unit_of_measurement' => 'm³']);
        UtilityRate::updateOrCreate(['utility_id' => $water->utility_id, 'effective_from' => '2025-01-01'], ['base_rate' => 62.00]);
    }

    private function seedInventory(): array
    {
        $rooms = [];
        $roomData = [
            'sharedFour' => ['code' => 'UNIT-101', 'type' => RoomType::SHARED, 'cap' => 4, 'rate' => 5800.00, 'desc' => 'Sampaloc Shared-4 (U-Belt)'],
            'sharedTwin' => ['code' => 'UNIT-102', 'type' => RoomType::SHARED, 'cap' => 2, 'rate' => 8200.00, 'desc' => 'España Twin (Quiet Zone)'],
            'soloStandard' => ['code' => 'UNIT-201', 'type' => RoomType::PRIVATE, 'cap' => 1, 'rate' => 14500.00, 'desc' => 'Loyola Studio (Student Solo)', 'metered' => true],
            'soloExecutive' => ['code' => 'UNIT-202', 'type' => RoomType::PRIVATE, 'cap' => 1, 'rate' => 16800.00, 'desc' => 'Katipunan Executive (Professional Solo)', 'metered' => true],
            'soloInclusive' => ['code' => 'UNIT-301', 'type' => RoomType::PRIVATE, 'cap' => 1, 'rate' => 18500.00, 'desc' => 'BGC Premium (All-Inclusive)', 'metered' => false],
        ];

        foreach ($roomData as $key => $d) {
            $rooms[$key] = Room::updateOrCreate(['room_code' => $d['code']], [
                'room_type' => $d['type'], 
                'capacity' => $d['cap'], 
                'monthly_rate' => $d['rate'], 
                'status' => RoomStatus::AVAILABLE,
                'is_metered' => $d['metered'] ?? true,
                'description' => $d['desc'],
                'amenities' => 'CCTV, Wi-Fi, Water Heater',
            ]);
            for ($i = 0; $i < $d['cap']; $i++) {
                BedSpace::updateOrCreate([
                    'room_id' => $rooms[$key]->room_id, 
                    'bed_label' => "Bed " . chr(65 + $i)
                ], [
                    'status' => BedSpaceStatus::VACANT
                ]);
            }
        }

        return ['rooms' => $rooms];
    }

    private function seedMeters(array $rooms): void
    {
        $elec = Utility::where('name', 'Electricity')->first();
        $water = Utility::where('name', 'Water')->first();

        foreach ($rooms as $room) {
            if (!$room->is_metered) {
                echo "[seeder] Skipping hardware for all-inclusive room: {$room->room_code}\n";
                continue;
            }

            // Electricity Meter
            $eMeter = Meter::updateOrCreate(['serial_number' => "E-{$room->room_code}"], [
                'utility_id' => $elec->utility_id, 
                'status' => 'active',
            ]);
            MeterAssignment::updateOrCreate(['meter_id' => $eMeter->meter_id, 'room_id' => $room->room_id], ['valid_from' => '2025-01-01']);
            
            // Initial Reading
            MeterReading::create([
                'meter_id' => $eMeter->meter_id,
                'reading_date' => '2025-01-01',
                'reading_value' => 100.00,
                'recorded_by' => User::first()->user_id,
            ]);

            // Water Meter
            $wMeter = Meter::updateOrCreate(['serial_number' => "W-{$room->room_code}"], [
                'utility_id' => $water->utility_id, 
                'status' => 'active',
            ]);
            MeterAssignment::updateOrCreate(['meter_id' => $wMeter->meter_id, 'room_id' => $room->room_id], ['valid_from' => '2025-01-01']);
            
            // Initial Reading
            MeterReading::create([
                'meter_id' => $wMeter->meter_id,
                'reading_date' => '2025-01-01',
                'reading_value' => 10.00,
                'recorded_by' => User::first()->user_id,
            ]);
        }
    }

    private function seedOperationalData(array $users, array $inventory): void
    {
        // 1. Scenario: The Consistent Payer (Cheska)
        $this->seedScenarioConsistentPayer($users, $inventory);

        // 2. Scenario: The New Enrollment (Miguel) - Pending Payment
        $this->seedScenarioNewEnrollment($users, $inventory);

        // 3. Scenario: The Overdue Account (Paolo)
        $this->seedScenarioOverdueAccount($users, $inventory);

        // 4. Scenario: The Moved Out Record (Liza)
        $this->seedScenarioMovedOut($users, $inventory);

        // 5. Scenario: The Discounted Veteran (Mang Ben) - Rate Override
        $this->seedScenarioRateOverride($users, $inventory);

        // 6. Scenario: The All-Inclusive Executive (Rico)
        $this->seedScenarioAllInclusive($users, $inventory);
    }

    private function seedScenarioConsistentPayer(array $users, array $inventory): void
    {
        $tenant = Tenant::updateOrCreate(['email' => 'cheska.reyes@example.ph'], [
            'first_name' => 'Francesca', 'last_name' => 'Reyes', 'contact_number' => '09171234567',
            'emergency_contact_name' => 'Mario Reyes', 'emergency_contact_number' => '09170001111', 
            'address' => 'Brgy. Loyola Heights, Quezon City, PH', 'status' => TenantStatus::ACTIVE,
        ]);
        
        $bed = BedSpace::where('room_id', $inventory['rooms']['sharedFour']->room_id)->where('bed_label', 'Bed A')->firstOrFail();
        
        $contract = Contract::create([
            'tenant_id' => $tenant->tenant_id, 'bed_space_id' => $bed->bed_space_id, 'created_by' => $users['admin']->user_id,
            'contract_type' => 'fixed_term', 'move_in_date' => '2025-02-01', 
            'expected_move_out_date' => '2026-02-01', 'monthly_rate' => 5800.00,
            'deposit_amount' => 5800.00, 'status' => ContractStatus::ACTIVE,
        ]);

        $bed->update(['status' => BedSpaceStatus::OCCUPIED]);
        
        // Paid for Feb, Mar
        $this->seedPaidBilling($contract, Carbon::parse('2025-02-01'), $users['staff']->user_id);
        $this->seedPaidBilling($contract, Carbon::parse('2025-03-01'), $users['staff']->user_id);
    }

    private function seedScenarioNewEnrollment(array $users, array $inventory): void
    {
        $tenant = Tenant::updateOrCreate(['email' => 'miguel.torres@example.ph'], [
            'first_name' => 'Juan Miguel', 'last_name' => 'Torres', 'contact_number' => '09187654321',
            'emergency_contact_name' => 'Elena Torres', 'emergency_contact_number' => '09180002222', 
            'address' => 'Sampaloc, Manila, PH', 'status' => TenantStatus::ACTIVE,
        ]);
        
        $bed = BedSpace::where('room_id', $inventory['rooms']['soloStandard']->room_id)->firstOrFail();
        
        Contract::create([
            'tenant_id' => $tenant->tenant_id, 'bed_space_id' => $bed->bed_space_id, 'created_by' => $users['admin']->user_id,
            'contract_type' => 'month_to_month', 'move_in_date' => Carbon::now()->startOfMonth()->toDateString(), 
            'monthly_rate' => 14500.00, 'deposit_amount' => 14500.00, 'status' => ContractStatus::PENDING_PAYMENT,
        ]);

        $bed->update(['status' => BedSpaceStatus::OCCUPIED]);
    }

    private function seedScenarioOverdueAccount(array $users, array $inventory): void
    {
        $tenant = Tenant::updateOrCreate(['email' => 'paolo.mercado@example.ph'], [
            'first_name' => 'Paolo', 'last_name' => 'Mercado', 'contact_number' => '09192223333',
            'emergency_contact_name' => 'Lucia Mercado', 'emergency_contact_number' => '09190004444', 
            'address' => 'Makati City, PH', 'status' => TenantStatus::ACTIVE,
        ]);
        
        $bed = BedSpace::where('room_id', $inventory['rooms']['sharedTwin']->room_id)->where('bed_label', 'Bed A')->firstOrFail();
        
        $contract = Contract::create([
            'tenant_id' => $tenant->tenant_id, 'bed_space_id' => $bed->bed_space_id, 'created_by' => $users['admin']->user_id,
            'contract_type' => 'fixed_term', 'move_in_date' => '2025-01-15', 
            'monthly_rate' => 8200.00, 'deposit_amount' => 8200.00, 'status' => ContractStatus::ACTIVE,
        ]);

        $bed->update(['status' => BedSpaceStatus::OCCUPIED]);

        // Unpaid bill for previous month
        $lastMonth = Carbon::now()->subMonth()->startOfMonth();
        $bill = Billing::create([
            'contract_id' => $contract->contract_id,
            'billing_period_from' => $lastMonth->toDateString(),
            'billing_period_to' => $lastMonth->copy()->endOfMonth()->toDateString(),
            'due_date' => $lastMonth->copy()->addDays(5)->toDateString(),
            'status' => BillingStatus::OVERDUE,
        ]);

        $bill->lineItems()->create([
            'item_type' => LineItemType::BASE_RENT,
            'item_description' => 'March Rent (Delinquent)',
            'amount' => 8200.00,
        ]);
    }

    private function seedScenarioMovedOut(array $users, array $inventory): void
    {
        $tenant = Tenant::updateOrCreate(['email' => 'liza.v@example.ph'], [
            'first_name' => 'Liza', 'last_name' => 'Villaluz', 'contact_number' => '09205556666',
            'emergency_contact_name' => 'Vicente Villaluz', 'emergency_contact_number' => '09200007777', 
            'address' => 'Cebu City, PH', 'status' => TenantStatus::MOVED_OUT,
        ]);
        
        $bed = BedSpace::where('room_id', $inventory['rooms']['sharedTwin']->room_id)->where('bed_label', 'Bed B')->firstOrFail();
        
        Contract::create([
            'tenant_id' => $tenant->tenant_id, 'bed_space_id' => $bed->bed_space_id, 'created_by' => $users['admin']->user_id,
            'contract_type' => 'fixed_term', 'move_in_date' => '2024-01-01', 
            'actual_move_out_date' => '2025-01-01', 'monthly_rate' => 8200.00,
            'deposit_amount' => 8200.00, 'status' => ContractStatus::COMPLETED,
            'is_cleared' => true,
        ]);
    }

    private function seedScenarioRateOverride(array $users, array $inventory): void
    {
        $tenant = Tenant::updateOrCreate(['email' => 'mangben@example.ph'], [
            'first_name' => 'Benjamin', 'last_name' => 'Santos', 'contact_number' => '09218889999',
            'emergency_contact_name' => 'Rosa Santos', 'emergency_contact_number' => '09210008888', 
            'address' => 'Marikina City, PH', 'status' => TenantStatus::ACTIVE,
        ]);
        
        $bed = BedSpace::where('room_id', $inventory['rooms']['soloExecutive']->room_id)->firstOrFail();
        
        Contract::create([
            'tenant_id' => $tenant->tenant_id, 'bed_space_id' => $bed->bed_space_id, 'created_by' => $users['admin']->user_id,
            'contract_type' => 'fixed_term', 'move_in_date' => '2025-01-01', 
            'monthly_rate' => 16800.00, 'monthly_rate_override' => 15500.00, // Loyalty Discount
            'deposit_amount' => 15500.00, 'status' => ContractStatus::ACTIVE,
        ]);

        $bed->update(['status' => BedSpaceStatus::OCCUPIED]);
    }

    private function seedScenarioAllInclusive(array $users, array $inventory): void
    {
        $tenant = Tenant::updateOrCreate(['email' => 'rico.m@example.ph'], [
            'first_name' => 'Rico', 'last_name' => 'Manila', 'contact_number' => '09223334444',
            'emergency_contact_name' => 'Teresa Manila', 'emergency_contact_number' => '09220001111', 
            'address' => 'BGC, Taguig, PH', 'status' => TenantStatus::ACTIVE,
        ]);
        
        $bed = BedSpace::where('room_id', $inventory['rooms']['soloInclusive']->room_id)->firstOrFail();
        
        Contract::create([
            'tenant_id' => $tenant->tenant_id, 'bed_space_id' => $bed->bed_space_id, 'created_by' => $users['admin']->user_id,
            'contract_type' => 'fixed_term', 'move_in_date' => '2025-04-01', 
            'monthly_rate' => 18500.00, 'deposit_amount' => 18500.00, 'status' => ContractStatus::ACTIVE,
        ]);

        $bed->update(['status' => BedSpaceStatus::OCCUPIED]);
    }

    private function seedPaidBilling(Contract $contract, Carbon $month, int $staffId): void
    {
        $bill = Billing::create([
            'contract_id' => $contract->contract_id, 
            'billing_period_from' => $month->copy()->startOfMonth()->toDateString(),
            'billing_period_to' => $month->copy()->endOfMonth()->toDateString(), 
            'due_date' => $month->copy()->startOfMonth()->addDays(5)->toDateString(), 
            'status' => BillingStatus::PAID,
        ]);

        $amount = $contract->monthly_rate_override ?? $contract->monthly_rate;

        $bill->lineItems()->create([
            'item_type' => LineItemType::BASE_RENT, 
            'item_description' => 'Monthly Base Rent', 
            'amount' => $amount,
        ]);

        Payment::create([
            'billing_id' => $bill->billing_id,
            'payment_category' => PaymentCategory::BILLING,
            'processed_by' => $staffId, 
            'amount_paid' => $amount,
            'payment_date' => $month->copy()->startOfMonth()->addDays(2)->toDateString(), 
            'payment_method' => PaymentMethod::GCASH, 
            'reference_number' => 'GCASH-' . random_int(100000, 999999),
        ]);
    }

    private function syncInventoryStatus(array $rooms): void
    {
        foreach ($rooms as $room) {
            RoomService::syncStatusAndCapacity($room);
        }
    }
}
