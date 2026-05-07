<?php

namespace Database\Seeders;

use App\Enums\BedSpaceStatus;
use App\Enums\BillingStatus;
use App\Enums\ContractStatus;
use App\Enums\LineItemType;
use App\Enums\PaymentCategory;
use App\Enums\PaymentMethod;
use App\Enums\RoleEnum;
use App\Enums\RoomStatus;
use App\Enums\RoomType;
use App\Enums\TenantStatus;
use App\Models\BedSpace;
use App\Models\Billing;
use App\Models\Contract;
use App\Models\Meter;
use App\Models\MeterAssignment;
use App\Models\MeterReading;
use App\Models\Payment;
use App\Models\Role;
use App\Models\Room;
use App\Models\Tenant;
use App\Models\User;
use App\Models\Utility;
use App\Models\UtilityRate;
use App\Services\Core\AuditService;
use App\Services\Operations\RoomService;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DemoSeeder extends Seeder
{
    private const DEMO_PASSWORD = 'HavenStay123!';

    public function run(): void
    {
        \DB::transaction(function () {
            try {
                AuditService::setSystemContext('demo-seeder');

                echo "[seeder] Initializing Roles & Users...\n";
                $users = $this->seedUsers();

                echo "[seeder] Setting up Utilities & Rates...\n";
                $this->seedUtilities();

                echo "[seeder] Generating Boarding House Inventory...\n";
                $inventory = $this->seedInventory();

                echo "[seeder] Deploying Meters & Baseline Readings...\n";
                $this->seedMeters($inventory['rooms']);

                echo "[seeder] Simulating Operational Scenarios...\n";
                $this->seedOperationalScenarios($users, $inventory);

                echo "[seeder] Synchronizing System States...\n";
                $this->syncInventoryStatus($inventory['rooms']);

                echo "[seeder] Demo Seeder Complete.\n";
                gc_collect_cycles();
            } catch (\Throwable $e) {
                echo "\n[SEEDER ERROR] " . $e->getMessage() . "\n";
                throw $e;
            }
        });
    }

    private function seedUsers(): array
    {
        $adminRole = Role::where('role_name', RoleEnum::ADMIN->value)->firstOrFail();
        $staffRole = Role::where('role_name', RoleEnum::STAFF->value)->firstOrFail();
        $viewerRole = Role::where('role_name', RoleEnum::VIEWER->value)->firstOrFail();

        // Use email as the primary key for updateOrCreate to match IdentitySeeder and prevent UQ violations
        $admin = User::updateOrCreate(['email' => 'havenstay.admin@havenstay.com'], [
            'username' => 'havenstay.admin',
            'first_name' => 'HavenStay',
            'last_name' => 'Administrator',
            'password_hash' => Hash::make(self::DEMO_PASSWORD),
            'role_id' => $adminRole->role_id,
            'is_active' => true,
        ]);

        $staff = User::updateOrCreate(['email' => 'havenstay.staff@havenstay.com'], [
            'username' => 'havenstay.staff',
            'first_name' => 'HavenStay',
            'last_name' => 'Staff',
            'password_hash' => Hash::make(self::DEMO_PASSWORD),
            'role_id' => $staffRole->role_id,
            'is_active' => true,
        ]);

        $viewer = User::updateOrCreate(['email' => 'viewer@havenstay.com'], [
            'username' => 'havenstay.viewer',
            'first_name' => 'HavenStay',
            'last_name' => 'Viewer',
            'password_hash' => Hash::make(self::DEMO_PASSWORD),
            'role_id' => $viewerRole->role_id,
            'is_active' => true,
        ]);

        return ['admin' => $admin, 'staff' => $staff, 'viewer' => $viewer];
    }

    private function seedUtilities(): void
    {
        $elec = Utility::updateOrCreate(['name' => 'Electricity'], ['unit_of_measurement' => 'kWh']);
        UtilityRate::updateOrCreate(['utility_id' => $elec->utility_id, 'effective_from' => '2025-01-01'], ['base_rate' => 15.50]);

        $water = Utility::updateOrCreate(['name' => 'Water'], ['unit_of_measurement' => 'm³']);
        UtilityRate::updateOrCreate(['utility_id' => $water->utility_id, 'effective_from' => '2025-01-01'], ['base_rate' => 45.00]);
    }

    private function seedInventory(): array
    {
        $rooms = [];
        $data = [
            // Standard Uniform Labeling (RM-###)
            'room101' => [
                'code' => 'RM-101',
                'type' => RoomType::SHARED,
                'cap' => 4,
                'rate' => 4500.00,
                'desc' => 'Ground Floor - Shared Quad',
                'amenities' => 'CCTV, Wi-Fi, Water Heater, Common Study Lounge'
            ],
            'room102' => [
                'code' => 'RM-102',
                'type' => RoomType::SHARED,
                'cap' => 2,
                'rate' => 6500.00,
                'desc' => 'Ground Floor - Shared Twin (Aircon)',
                'amenities' => 'CCTV, Aircon, Wi-Fi'
            ],
            'room201' => [
                'code' => 'RM-201',
                'type' => RoomType::PRIVATE ,
                'cap' => 1,
                'rate' => 9500.00,
                'desc' => 'Second Floor - Solo Studio',
                'amenities' => 'Private Bath, Kitchenette, Fiber Wi-Fi'
            ],
            'room202' => [
                'code' => 'RM-202',
                'type' => RoomType::PRIVATE ,
                'cap' => 1,
                'rate' => 11000.00,
                'desc' => 'Second Floor - Executive Solo',
                'amenities' => 'Full Furniture, Aircon, Private Bath'
            ],
            'room301' => [
                'code' => 'RM-301',
                'type' => RoomType::SHARED,
                'cap' => 2,
                'rate' => 8500.00,
                'desc' => 'Third Floor - Loft Twin',
                'amenities' => 'Keycard Entry, Fiber Internet, Modern Pantry'
            ],
            'room302' => [
                'code' => 'RM-302',
                'type' => RoomType::PRIVATE ,
                'cap' => 1,
                'rate' => 18000.00,
                'desc' => 'Penthouse Solo Suite',
                'amenities' => 'All-Inclusive, Bi-weekly Cleaning, City View',
                'metered' => false
            ],
        ];

        foreach ($data as $key => $d) {
            $rooms[$key] = Room::updateOrCreate(['room_code' => $d['code']], [
                'room_type' => $d['type'],
                'capacity' => $d['cap'],
                'monthly_rate' => $d['rate'],
                'status' => RoomStatus::AVAILABLE,
                'is_metered' => $d['metered'] ?? true,
                'description' => $d['desc'],
                'amenities' => $d['amenities'],
            ]);

            for ($i = 0; $i < $d['cap']; $i++) {
                BedSpace::updateOrCreate([
                    'room_id' => $rooms[$key]->room_id,
                    'bed_label' => 'Bed ' . chr(65 + $i),
                ], [
                    'status' => BedSpaceStatus::VACANT,
                ]);
            }
        }

        return ['rooms' => $rooms];
    }

    private function seedMeters(array $rooms): void
    {
        $elec = Utility::where('name', 'Electricity')->first();
        $water = Utility::where('name', 'Water')->first();
        $adminId = User::first()->user_id;

        foreach ($rooms as $room) {
            if (!$room->is_metered) continue;

            // Clear existing assignments to avoid trg_meter_assignments_bi conflict
            MeterAssignment::where('room_id', $room->room_id)->delete();

            $eMeter = Meter::updateOrCreate(['serial_number' => "MORE-{$room->room_code}"], [
                'utility_id' => $elec->utility_id,
                'status' => 'active'
            ]);
            MeterAssignment::create(['meter_id' => $eMeter->meter_id, 'room_id' => $room->room_id, 'valid_from' => '2025-01-01']);
            MeterReading::create(['meter_id' => $eMeter->meter_id, 'reading_date' => '2025-01-01', 'reading_value' => 500.00, 'recorded_by' => $adminId]);

            $wMeter = Meter::updateOrCreate(['serial_number' => "MPIW-{$room->room_code}"], [
                'utility_id' => $water->utility_id,
                'status' => 'active'
            ]);
            MeterAssignment::create(['meter_id' => $wMeter->meter_id, 'room_id' => $room->room_id, 'valid_from' => '2025-01-01']);
            MeterReading::create(['meter_id' => $wMeter->meter_id, 'reading_date' => '2025-01-01', 'reading_value' => 20.00, 'recorded_by' => $adminId]);
        }
    }

    private function seedOperationalScenarios(array $users, array $inventory): void
    {
        $this->scenarioPerfectTenant($users, $inventory);
        $this->scenarioDelinquent($users, $inventory);
        $this->scenarioPartialPayer($users, $inventory);
        $this->scenarioLegacyOverride($users, $inventory);
        $this->scenarioMovedOutArchived($users, $inventory);
        $this->scenarioRollover($users, $inventory);
        $this->scenarioNewEnrollment($users, $inventory);
        $this->scenarioMaintenanceLock($users, $inventory);
    }

    private function scenarioPerfectTenant(array $users, array $inventory): void
    {
        $tenant = Tenant::updateOrCreate(['email' => 'althea.dalisay@cpu.edu.ph'], [
            'first_name' => 'Althea Mae',
            'last_name' => 'Dalisay',
            'contact_number' => '09175524412',
            'emergency_contact_name' => 'Ricardo Dalisay',
            'emergency_contact_number' => '09178819920',
            'address' => 'Brgy. Balabag, Pavia, Iloilo',
            'status' => TenantStatus::ACTIVE,
        ]);

        $bed = BedSpace::where('room_id', $inventory['rooms']['room101']->room_id)->where('bed_label', 'Bed A')->first();
        $contract = Contract::create([
            'tenant_id' => $tenant->tenant_id,
            'bed_space_id' => $bed->bed_space_id,
            'created_by' => $users['admin']->user_id,
            'contract_type' => 'fixed_term',
            'move_in_date' => '2025-01-10',
            'expected_move_out_date' => '2026-03-10',
            'monthly_rate' => 4500.00,
            'deposit_amount' => 4500.00,
            'status' => ContractStatus::ACTIVE,
        ]);
        $bed->update(['status' => BedSpaceStatus::OCCUPIED]);

        $this->createHistoricalPaidBill($contract, '2025-02', $users['staff']->user_id);
        $this->createHistoricalPaidBill($contract, '2025-03', $users['staff']->user_id);
        $this->createHistoricalPaidBill($contract, '2025-04', $users['staff']->user_id);
    }

    private function scenarioDelinquent(array $users, array $inventory): void
    {
        $tenant = Tenant::updateOrCreate(['email' => 'johnmark.mercado@upv.edu.ph'], [
            'first_name' => 'John Mark',
            'last_name' => 'Mercado',
            'contact_number' => '09189223345',
            'emergency_contact_name' => 'Lucila Mercado',
            'emergency_contact_number' => '09184412290',
            'address' => 'Brgy. Poblacion, Oton, Iloilo',
            'status' => TenantStatus::ACTIVE,
        ]);

        $bed = BedSpace::where('room_id', $inventory['rooms']['room201']->room_id)->first();
        $contract = Contract::create([
            'tenant_id' => $tenant->tenant_id,
            'bed_space_id' => $bed->bed_space_id,
            'created_by' => $users['admin']->user_id,
            'contract_type' => 'month_to_month',
            'move_in_date' => '2025-02-15',
            'monthly_rate' => 9500.00,
            'deposit_amount' => 9500.00,
            'status' => ContractStatus::ACTIVE,
        ]);
        $bed->update(['status' => BedSpaceStatus::OCCUPIED]);

        $this->createHistoricalPaidBill($contract, '2025-03', $users['staff']->user_id);

        $lastMonth = Carbon::now()->subMonth()->startOfMonth();
        $bill = Billing::create([
            'contract_id' => $contract->contract_id,
            'billing_period_from' => $lastMonth->toDateString(),
            'billing_period_to' => $lastMonth->copy()->endOfMonth()->toDateString(),
            'due_date' => $lastMonth->copy()->addDays(5)->toDateString(),
            'status' => BillingStatus::OVERDUE,
        ]);
        $bill->lineItems()->create(['item_type' => LineItemType::BASE_RENT, 'item_description' => 'April 2025 Base Rent', 'amount' => 9500.00]);
    }

    private function scenarioPartialPayer(array $users, array $inventory): void
    {
        $tenant = Tenant::updateOrCreate(['email' => 'sophia.villa@outlook.com'], [
            'first_name' => 'Sophia Lorenza',
            'last_name' => 'Villa',
            'contact_number' => '09228154432',
            'emergency_contact_name' => 'Anton Villa',
            'emergency_contact_number' => '09227710012',
            'address' => 'Mandurriao, Iloilo City',
            'status' => TenantStatus::ACTIVE,
        ]);

        $bed = BedSpace::where('room_id', $inventory['rooms']['room301']->room_id)->where('bed_label', 'Bed B')->first();
        $contract = Contract::create([
            'tenant_id' => $tenant->tenant_id,
            'bed_space_id' => $bed->bed_space_id,
            'created_by' => $users['admin']->user_id,
            'contract_type' => 'fixed_term',
            'move_in_date' => '2025-04-01',
            'expected_move_out_date' => '2026-04-01',
            'monthly_rate' => 8500.00,
            'deposit_amount' => 8500.00,
            'status' => ContractStatus::ACTIVE,
        ]);
        $bed->update(['status' => BedSpaceStatus::OCCUPIED]);

        $currentMonth = Carbon::now()->startOfMonth();
        $bill = Billing::create([
            'contract_id' => $contract->contract_id,
            'billing_period_from' => $currentMonth->toDateString(),
            'billing_period_to' => $currentMonth->copy()->endOfMonth()->toDateString(),
            'due_date' => $currentMonth->copy()->addDays(5)->toDateString(),
            'status' => BillingStatus::PARTIAL,
        ]);
        $bill->lineItems()->create(['item_type' => LineItemType::BASE_RENT, 'item_description' => 'Current Month Rent', 'amount' => 8500.00]);

        Payment::create([
            'billing_id' => $bill->billing_id,
            'payment_category' => PaymentCategory::BILLING,
            'amount_paid' => 4000.00,
            'payment_date' => Carbon::now()->toDateString(),
            'payment_method' => PaymentMethod::CASH,
            'processed_by' => $users['staff']->user_id,
        ]);
    }

    private function scenarioLegacyOverride(array $users, array $inventory): void
    {
        $tenant = Tenant::updateOrCreate(['email' => 'ben.santos@gmail.com'], [
            'first_name' => 'Benjamin',
            'last_name' => 'Santos',
            'contact_number' => '09081129981',
            'emergency_contact_name' => 'Rosa Santos',
            'emergency_contact_number' => '09084431120',
            'address' => 'Brgy. Tacas, Jaro, Iloilo',
            'status' => TenantStatus::ACTIVE,
        ]);

        $bed = BedSpace::where('room_id', $inventory['rooms']['room202']->room_id)->first();
        Contract::create([
            'tenant_id' => $tenant->tenant_id,
            'bed_space_id' => $bed->bed_space_id,
            'created_by' => $users['admin']->user_id,
            'contract_type' => 'fixed_term',
            'move_in_date' => '2023-01-01',
            'monthly_rate' => 11000.00,
            'monthly_rate_override' => 8500.00,
            'deposit_amount' => 8500.00,
            'status' => ContractStatus::ACTIVE,
        ]);
        $bed->update(['status' => BedSpaceStatus::OCCUPIED]);
    }

    private function scenarioMovedOutArchived(array $users, array $inventory): void
    {
        $tenant = Tenant::updateOrCreate(['email' => 'boy.bayani@gmail.com'], [
            'first_name' => 'Efren "Boy"',
            'last_name' => 'Bayani',
            'contact_number' => '09205518872',
            'emergency_contact_name' => 'Nenita Bayani',
            'emergency_contact_number' => '09203321145',
            'address' => 'Antique, Western Visayas',
            'status' => TenantStatus::ARCHIVED,
        ]);

        $bed = BedSpace::where('room_id', $inventory['rooms']['room102']->room_id)->where('bed_label', 'Bed B')->first();
        Contract::create([
            'tenant_id' => $tenant->tenant_id,
            'bed_space_id' => $bed->bed_space_id,
            'created_by' => $users['admin']->user_id,
            'contract_type' => 'fixed_term',
            'move_in_date' => '2024-01-01',
            'actual_move_out_date' => '2025-01-01',
            'monthly_rate' => 6500.00,
            'deposit_amount' => 6500.00,
            'status' => ContractStatus::COMPLETED,
            'is_cleared' => true,
        ]);
    }

    private function scenarioRollover(array $users, array $inventory): void
    {
        $tenant = Tenant::updateOrCreate(['email' => 'lena.cruz@gmail.com'], [
            'first_name' => 'Maria Elena',
            'last_name' => 'Cruz',
            'contact_number' => '09154429901',
            'emergency_contact_name' => 'Jose Cruz',
            'emergency_contact_number' => '09158811120',
            'address' => 'Brgy. San Jose, San Miguel, Iloilo',
            'status' => TenantStatus::ACTIVE,
        ]);

        $oldBed = BedSpace::where('room_id', $inventory['rooms']['room301']->room_id)->where('bed_label', 'Bed A')->first();
        Contract::create([
            'tenant_id' => $tenant->tenant_id,
            'bed_space_id' => $oldBed->bed_space_id,
            'created_by' => $users['admin']->user_id,
            'contract_type' => 'fixed_term',
            'move_in_date' => '2024-04-01',
            'actual_move_out_date' => '2025-04-30',
            'monthly_rate' => 8500.00,
            'deposit_amount' => 8500.00,
            'status' => ContractStatus::COMPLETED,
            'is_cleared' => true,
        ]);

        $newContract = Contract::create([
            'tenant_id' => $tenant->tenant_id,
            'bed_space_id' => $oldBed->bed_space_id,
            'created_by' => $users['admin']->user_id,
            'contract_type' => 'fixed_term',
            'move_in_date' => '2025-05-01',
            'expected_move_out_date' => '2026-05-01',
            'monthly_rate' => 9500.00,
            'deposit_amount' => 9500.00,
            'status' => ContractStatus::ACTIVE,
        ]);
        $oldBed->update(['status' => BedSpaceStatus::OCCUPIED]);

        Payment::create([
            'contract_id' => $newContract->contract_id,
            'payment_category' => PaymentCategory::ROLLOVER,
            'amount_paid' => 8500.00,
            'payment_date' => '2025-05-01',
            'payment_method' => PaymentMethod::OTHER,
            'reference_number' => 'ROLLOVER-PREV-CONTRACT',
            'processed_by' => $users['admin']->user_id,
        ]);
    }

    private function scenarioNewEnrollment(array $users, array $inventory): void
    {
        $tenant = Tenant::updateOrCreate(['email' => 'nathan.torres@usa.edu.ph'], [
            'first_name' => 'Nathaniel Angelo',
            'last_name' => 'Torres',
            'contact_number' => '09274412298',
            'emergency_contact_name' => 'Elena Torres',
            'emergency_contact_number' => '09275510021',
            'address' => 'Guimaras, PH',
            'status' => TenantStatus::ACTIVE,
        ]);

        $bed = BedSpace::where('room_id', $inventory['rooms']['room102']->room_id)->where('bed_label', 'Bed A')->first();
        Contract::create([
            'tenant_id' => $tenant->tenant_id,
            'bed_space_id' => $bed->bed_space_id,
            'created_by' => $users['admin']->user_id,
            'contract_type' => 'fixed_term',
            'move_in_date' => Carbon::now()->addDays(2)->toDateString(),
            'monthly_rate' => 6500.00,
            'deposit_amount' => 6500.00,
            'status' => ContractStatus::PENDING_PAYMENT,
        ]);
        $bed->update(['status' => BedSpaceStatus::OCCUPIED]);
    }

    private function scenarioMaintenanceLock(array $users, array $inventory): void
    {
        $bed = BedSpace::where('room_id', $inventory['rooms']['room101']->room_id)->where('bed_label', 'Bed D')->first();
        $bed->update(['status' => BedSpaceStatus::MAINTENANCE]);
    }

    private function createHistoricalPaidBill(Contract $contract, string $yearMonth, int $staffId): void
    {
        $month = Carbon::parse($yearMonth . '-01');
        $bill = Billing::create([
            'contract_id' => $contract->contract_id,
            'billing_period_from' => $month->toDateString(),
            'billing_period_to' => $month->copy()->endOfMonth()->toDateString(),
            'due_date' => $month->copy()->addDays(5)->toDateString(),
            'status' => BillingStatus::PAID,
        ]);

        $amount = $contract->monthly_rate_override ?? $contract->monthly_rate;
        $bill->lineItems()->create(['item_type' => LineItemType::BASE_RENT, 'item_description' => $month->format('F Y') . ' Base Rent', 'amount' => $amount]);

        Payment::create([
            'billing_id' => $bill->billing_id,
            'payment_category' => PaymentCategory::BILLING,
            'amount_paid' => $amount,
            'payment_date' => $month->copy()->addDays(2)->toDateString(),
            'payment_method' => PaymentMethod::GCASH,
            'reference_number' => 'GCASH-' . strtoupper(bin2hex(random_bytes(4))),
            'processed_by' => $staffId,
        ]);
    }

    private function syncInventoryStatus(array $rooms): void
    {
        foreach ($rooms as $room) {
            RoomService::syncStatusAndCapacity($room);
        }
    }
}
