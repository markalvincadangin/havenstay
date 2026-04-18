<?php

namespace Database\Seeders;

use App\Models\AddOn;
use App\Models\BedSpace;
use App\Models\Billing;
use App\Models\BillingLineItem;
use App\Models\Contract;
use App\Models\ContractAddOn;
use App\Models\Payment;
use App\Models\Role;
use App\Models\Room;
use App\Models\Tenant;
use App\Models\User;
use App\Services\Analytics\AuditService;
use App\Services\Operations\RoomService;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * Demo / UAT seed — realistic Philippine boarding-house data for dashboard, billing, and reports.
 *
 * Assumes **fresh migrate** (`php artisan migrate:fresh --seed`). Uses `Carbon::now()` so "current month"
 * matches the date you run the seeder (e.g. April 2026: unpaid / overdue / partial scenarios align with "today").
 *
 * Refactored to decompose the large run() method into specialized scenario methods to improve 
 * type inference performance and maintainability.
 */
class DemoSeeder extends Seeder
{
    private const DEMO_PASSWORD = 'HavenStay123!';

    // ── Room code constants (UNIT-{floor}{unit}, max 20 chars) ──
    private const ROOM_SHARED_FOUR_BED    = 'UNIT-101';
    private const ROOM_SHARED_TWIN        = 'UNIT-102';
    private const ROOM_SHARED_TRIPLE      = 'UNIT-103';
    private const ROOM_SOLO_STANDARD      = 'UNIT-201';
    private const ROOM_SOLO_PREMIUM       = 'UNIT-202';
    private const ROOM_SOLO_DELUXE        = 'UNIT-203';
    private const ROOM_SHARED_MAINTENANCE = 'UNIT-301';
    private const ROOM_ARCHIVED           = 'UNIT-401';

    public function run(): void
    {
        $users = $this->seedUsers();
        
        // CCR-008: Set audit context so database triggers attribute seeder actions to the admin user
        AuditService::setAuditUserContext($users['admin']->user_id);

        $inventory = $this->seedInventory();
        
        $this->seedOperationalData($users, $inventory);

        $this->syncInventoryStatus($inventory['rooms']);
    }

    /**
     * Seed roles and system operators.
     * @return array<string, User>
     */
    private function seedUsers(): array
    {
        $adminRole  = Role::where('role_name', 'admin')->firstOrFail();
        $staffRole  = Role::where('role_name', 'staff')->firstOrFail();
        $viewerRole = Role::where('role_name', 'viewer')->firstOrFail();

        $admin = User::updateOrCreate(
            ['username' => 'admin'],
            [
                'first_name'    => 'System',
                'last_name'     => 'Admin',
                'email'         => 'admin@havenstay.ph',
                'password_hash' => Hash::make(self::DEMO_PASSWORD),
                'role_id'       => $adminRole->role_id,
                'is_active'     => true,
            ]
        );

        $staff = User::updateOrCreate(
            ['username' => 'staff'],
            [
                'first_name'    => 'Elena',
                'last_name'     => 'Santos',
                'email'         => 'elena.santos@havenstay.ph',
                'password_hash' => Hash::make(self::DEMO_PASSWORD),
                'role_id'       => $staffRole->role_id,
                'is_active'     => true,
            ]
        );

        User::updateOrCreate(
            ['username' => 'viewer'],
            [
                'first_name'    => 'Ricardo',
                'last_name'     => 'Dalisay',
                'email'         => 'rdalisay@havenstay.ph',
                'password_hash' => Hash::make(self::DEMO_PASSWORD),
                'role_id'       => $viewerRole->role_id,
                'is_active'     => true,
            ]
        );

        return ['admin' => $admin, 'staff' => $staff];
    }

    /**
     * Seed rooms, bed spaces, and add-on registry.
     * @return array{rooms: array<string, Room>, addons: array<string, AddOn>}
     */
    private function seedInventory(): array
    {
        $rooms = [];
        
        // UNIT-101: 4-bed shared
        $rooms['sharedFour'] = Room::updateOrCreate(
            ['room_code' => self::ROOM_SHARED_FOUR_BED],
            [
                'room_type'    => 'shared',
                'capacity'     => 4,
                'monthly_rate' => 4500.00,
                'status'       => 'vacant',
                'amenities'    => 'Wi‑Fi, ceiling fan, study desk, shared pantry access',
                'description'  => 'Ground floor quad — common for students and young professionals.',
            ]
        );
        foreach (['A', 'B', 'C', 'D'] as $label) {
            BedSpace::updateOrCreate(
                ['room_id' => $rooms['sharedFour']->room_id, 'bed_label' => "Bed $label"],
                ['status' => 'vacant']
            );
        }

        // UNIT-102: 2-bed shared
        $rooms['sharedTwin'] = Room::updateOrCreate(
            ['room_code' => self::ROOM_SHARED_TWIN],
            [
                'room_type'    => 'shared',
                'capacity'     => 2,
                'monthly_rate' => 5500.00,
                'status'       => 'vacant',
                'amenities'    => 'Wi‑Fi, air‑con (evening hours), lockers, shared CR',
                'description'  => 'Second floor twin — quieter wing with air-conditioning access.',
            ]
        );
        foreach (['A', 'B'] as $label) {
            BedSpace::updateOrCreate(
                ['room_id' => $rooms['sharedTwin']->room_id, 'bed_label' => "Bed $label"],
                ['status' => 'vacant']
            );
        }

        // UNIT-103: 3-bed shared
        $rooms['sharedTriple'] = Room::updateOrCreate(
            ['room_code' => self::ROOM_SHARED_TRIPLE],
            [
                'room_type'    => 'shared',
                'capacity'     => 3,
                'monthly_rate' => 5000.00,
                'status'       => 'vacant',
                'amenities'    => 'Wi‑Fi, ceiling fan, study area, CR access',
                'description'  => 'Ground floor triple — spacious room near the common area.',
            ]
        );
        foreach (['A', 'B', 'C'] as $label) {
            BedSpace::updateOrCreate(
                ['room_id' => $rooms['sharedTriple']->room_id, 'bed_label' => "Bed $label"],
                ['status' => 'vacant']
            );
        }

        // UNIT-201: Solo standard
        $rooms['soloStandard'] = Room::updateOrCreate(
            ['room_code' => self::ROOM_SOLO_STANDARD],
            [
                'room_type'    => 'solo',
                'capacity'     => 1,
                'monthly_rate' => 8000.00,
                'status'       => 'vacant',
                'amenities'    => 'Aircon, private toilet, Wi‑Fi',
                'description'  => 'Solo unit — rear building, garden view.',
            ]
        );
        BedSpace::updateOrCreate(
            ['room_id' => $rooms['soloStandard']->room_id, 'bed_label' => 'Solo Bed'],
            ['status' => 'vacant']
        );

        // UNIT-202: Solo premium
        $rooms['soloPremium'] = Room::updateOrCreate(
            ['room_code' => self::ROOM_SOLO_PREMIUM],
            [
                'room_type'    => 'solo',
                'capacity'     => 1,
                'monthly_rate' => 8500.00,
                'status'       => 'vacant',
                'amenities'    => 'Aircon, private toilet, Wi‑Fi, water heater',
                'description'  => 'Premium solo with small balcony.',
            ]
        );
        BedSpace::updateOrCreate(
            ['room_id' => $rooms['soloPremium']->room_id, 'bed_label' => 'Solo Bed'],
            ['status' => 'vacant']
        );

        // UNIT-203: Solo deluxe
        $rooms['soloDeluxe'] = Room::updateOrCreate(
            ['room_code' => self::ROOM_SOLO_DELUXE],
            [
                'room_type'    => 'solo',
                'capacity'     => 1,
                'monthly_rate' => 10000.00,
                'status'       => 'vacant',
                'amenities'    => 'Inverter aircon, private toilet & bath, Wi‑Fi, water heater, mini‑kitchen',
                'description'  => 'Corner unit deluxe — largest solo, panoramic window, street side.',
            ]
        );
        BedSpace::updateOrCreate(
            ['room_id' => $rooms['soloDeluxe']->room_id, 'bed_label' => 'Solo Bed'],
            ['status' => 'vacant']
        );

        // UNIT-301: Maintenance
        $rooms['maintenance'] = Room::updateOrCreate(
            ['room_code' => self::ROOM_SHARED_MAINTENANCE],
            [
                'room_type'    => 'shared',
                'capacity'     => 2,
                'monthly_rate' => 5000.00,
                'status'       => 'maintenance',
                'amenities'    => 'Wi‑Fi, fan',
                'description'  => 'Temporarily closed — repainting & electrical check.',
            ]
        );
        BedSpace::updateOrCreate(['room_id' => $rooms['maintenance']->room_id, 'bed_label' => 'Bed A'], ['status' => 'maintenance']);
        BedSpace::updateOrCreate(['room_id' => $rooms['maintenance']->room_id, 'bed_label' => 'Bed B'], ['status' => 'maintenance']);

        // UNIT-401: Archived
        $rooms['archivedRoom'] = Room::updateOrCreate(
            ['room_code' => self::ROOM_ARCHIVED],
            [
                'room_type'    => 'shared',
                'capacity'     => 2,
                'monthly_rate' => 5000.00,
                'status'       => 'archived',
                'amenities'    => 'N/A',
                'description'  => 'Decommissioned wing — structural observation.',
            ]
        );
        BedSpace::updateOrCreate(['room_id' => $rooms['archivedRoom']->room_id, 'bed_label' => 'Bed A'], ['status' => 'maintenance']);
        BedSpace::updateOrCreate(['room_id' => $rooms['archivedRoom']->room_id, 'bed_label' => 'Bed B'], ['status' => 'maintenance']);

        // Add-ons
        $addons = [];
        $addons['fridge'] = AddOn::updateOrCreate(['item_name' => 'Mini Refrigerator'], ['default_monthly_rate' => 300.00, 'is_active' => true]);
        $addons['fan']    = AddOn::updateOrCreate(['item_name' => 'Electric Fan'], ['default_monthly_rate' => 150.00, 'is_active' => true]);
        $addons['router'] = AddOn::updateOrCreate(['item_name' => 'Personal Wi‑Fi Router'], ['default_monthly_rate' => 200.00, 'is_active' => true]);
        
        AddOn::updateOrCreate(['item_name' => 'Rice Cooker'], ['default_monthly_rate' => 120.00, 'is_active' => true]);
        AddOn::updateOrCreate(['item_name' => 'Water Dispenser (Hot/Cold)'], ['default_monthly_rate' => 250.00, 'is_active' => true]);
        AddOn::updateOrCreate(['item_name' => 'Night Lamp'], ['default_monthly_rate' => 50.00, 'is_active' => true]);
        AddOn::updateOrCreate(['item_name' => 'Air Purifier'], ['default_monthly_rate' => 200.00, 'is_active' => true]);
        AddOn::updateOrCreate(['item_name' => 'Personal Kettle'], ['default_monthly_rate' => 150.00, 'is_active' => true]);
        AddOn::updateOrCreate(['item_name' => 'Laundry Service (8kg/mo)'], ['default_monthly_rate' => 600.00, 'is_active' => true]);

        return ['rooms' => $rooms, 'addons' => $addons];
    }

    /**
     * Orchestrate scenario seeding.
     */
    private function seedOperationalData(array $users, array $inventory): void
    {
        $this->seedHistoricalMeterReadings($users, $inventory['rooms']);
        
        $this->seedScenarioCheska($users, $inventory);
        $this->seedScenarioMiguel($users, $inventory);
        $this->seedScenarioPaolo($users, $inventory);
        $this->seedScenarioRamon($users, $inventory);
        $this->seedScenarioLena($users, $inventory);
        $this->seedScenarioClarissa($users, $inventory);
        $this->seedScenarioGabriel($users, $inventory);
        $this->seedScenarioMaricel($users, $inventory);
        $this->seedScenarioJoaquin($users, $inventory);
        $this->seedScenarioJosiah($users, $inventory);
        $this->seedScenarioArchived();
    }

    private function seedScenarioCheska(array $users, array $inventory): void
    {
        $tenant = Tenant::updateOrCreate(
            ['email' => 'cheska.reyes@example.ph'],
            [
                'first_name' => 'Francesca', 'last_name' => 'Reyes', 'contact_number' => '09171234567',
                'address' => '42 Ateneo Ave, Loyola Heights, Quezon City 1108',
                'emergency_contact_name' => 'Teresa Reyes', 'emergency_contact_number' => '09170001111',
                'status' => 'active',
            ]
        );

        $bed = BedSpace::where('room_id', $inventory['rooms']['sharedFour']->room_id)->where('bed_label', 'Bed A')->firstOrFail();
        $bed->update(['status' => 'occupied']);

        $contract = Contract::updateOrCreate(
            ['tenant_id' => $tenant->tenant_id, 'bed_space_id' => $bed->bed_space_id],
            [
                'created_by' => $users['admin']->user_id, 'move_in_date' => '2025-06-01', 'expected_move_out_date' => '2026-06-01',
                'deposit_amount' => 4500.00, 'monthly_rate_override' => 4500.00, 'status' => 'active',
            ]
        );

        ContractAddOn::updateOrCreate(['contract_id' => $contract->contract_id, 'add_on_id' => $inventory['addons']['fridge']->add_on_id], ['actual_rate' => 300.00]);

        $cursor = Carbon::parse('2025-06-01')->startOfMonth();
        $lastMonth = Carbon::now()->startOfMonth();
        while ($cursor->lte($lastMonth)) {
            $isCurrentMonth = $cursor->isSameMonth(Carbon::now());
            $extras = [['item_type' => 'add_on', 'item_description' => 'Mini Refrigerator (appliance add-on)', 'amount' => 300.00]];
            if ($cursor->month % 3 === 0 || $isCurrentMonth) {
                $extras[] = ['item_type' => 'utility', 'item_description' => 'Shared utilities (Meralco/Manila Water)', 'amount' => 350.00];
            }
            $this->seedPaidBillingMonth($contract, $cursor->copy(), 4500.00, $users['staff']->user_id, $cursor->month % 3 === 0 ? 'bank_transfer' : 'gcash', $extras);
            $cursor->addMonth();
        }
    }

    private function seedScenarioMiguel(array $users, array $inventory): void
    {
        $tenant = Tenant::updateOrCreate(
            ['email' => 'miguel.torres@example.ph'],
            [
                'first_name' => 'Miguel Antonio', 'last_name' => 'Torres', 'contact_number' => '09187654321',
                'address' => '15-B Shoe Ave, Sto. Niño, Marikina City 1800',
                'emergency_contact_name' => 'Rosa Torres', 'emergency_contact_number' => '09180002222',
                'status' => 'active',
            ]
        );

        $bed = BedSpace::where('room_id', $inventory['rooms']['soloStandard']->room_id)->firstOrFail();
        $bed->update(['status' => 'occupied']);

        $contract = Contract::updateOrCreate(
            ['tenant_id' => $tenant->tenant_id, 'bed_space_id' => $bed->bed_space_id],
            [
                'created_by' => $users['admin']->user_id, 'move_in_date' => '2025-08-15', 'expected_move_out_date' => '2026-08-15',
                'deposit_amount' => 8000.00, 'monthly_rate_override' => 8000.00, 'status' => 'active',
            ]
        );

        for ($i = 3; $i >= 1; $i--) {
            $this->seedPaidBillingMonth($contract, Carbon::now()->subMonths($i), 8000.00, $users['staff']->user_id, 'bank_transfer', []);
        }

        $due = Carbon::now()->startOfMonth()->addDays(5);
        $bill = Billing::updateOrCreate(
            ['contract_id' => $contract->contract_id, 'billing_period_from' => Carbon::now()->startOfMonth()->toDateString(), 'billing_period_to' => Carbon::now()->endOfMonth()->toDateString()],
            ['due_date' => $due->toDateString(), 'status' => Carbon::now()->greaterThan($due) ? 'overdue' : 'unpaid']
        );
        BillingLineItem::updateOrCreate(['billing_id' => $bill->billing_id, 'item_type' => 'base_rent'], ['item_description' => "Monthly Base Rent ({$inventory['rooms']['soloStandard']->room_code})", 'amount' => 8000.00]);
    }

    private function seedScenarioPaolo(array $users, array $inventory): void
    {
        $tenant = Tenant::updateOrCreate(
            ['email' => 'paolo.mendoza@example.ph'],
            [
                'first_name' => 'Paolo Lorenzo', 'last_name' => 'Mendoza', 'contact_number' => '09201112222',
                'address' => '88 Maginhawa St, Teachers Village, Quezon City 1101',
                'emergency_contact_name' => 'Luis Mendoza', 'emergency_contact_number' => '09200003333',
                'status' => 'active',
            ]
        );

        $bed = BedSpace::where('room_id', $inventory['rooms']['soloPremium']->room_id)->firstOrFail();
        $bed->update(['status' => 'occupied']);

        $contract = Contract::updateOrCreate(
            ['tenant_id' => $tenant->tenant_id, 'bed_space_id' => $bed->bed_space_id],
            [
                'created_by' => $users['admin']->user_id, 'move_in_date' => '2025-10-01', 'expected_move_out_date' => '2026-10-01',
                'deposit_amount' => 8500.00, 'monthly_rate_override' => 8500.00, 'status' => 'active',
            ]
        );

        ContractAddOn::updateOrCreate(['contract_id' => $contract->contract_id, 'add_on_id' => $inventory['addons']['fridge']->add_on_id], ['actual_rate' => 300.00]);
        ContractAddOn::updateOrCreate(['contract_id' => $contract->contract_id, 'add_on_id' => $inventory['addons']['fan']->add_on_id], ['actual_rate' => 150.00]);

        for ($i = 2; $i >= 1; $i--) {
            $dt = Carbon::now()->subMonths($i)->startOfMonth();
            $this->seedPaidBillingMonth($contract, $dt, 8500.00, $users['staff']->user_id, 'gcash', [
                ['item_type' => 'add_on', 'item_description' => 'Mini Refrigerator', 'amount' => 300.00],
                ['item_type' => 'add_on', 'item_description' => 'Electric Fan', 'amount' => 150.00],
            ]);
        }

        $bill = Billing::updateOrCreate(
            ['contract_id' => $contract->contract_id, 'billing_period_from' => Carbon::now()->startOfMonth()->toDateString(), 'billing_period_to' => Carbon::now()->endOfMonth()->toDateString()],
            ['due_date' => Carbon::now()->startOfMonth()->addDays(5)->toDateString(), 'status' => 'partial']
        );
        BillingLineItem::updateOrCreate(['billing_id' => $bill->billing_id, 'item_type' => 'base_rent'], ['item_description' => "Monthly Base Rent ({$inventory['rooms']['soloPremium']->room_code})", 'amount' => 8500.00]);
        BillingLineItem::updateOrCreate(['billing_id' => $bill->billing_id, 'item_description' => 'Mini Refrigerator'], ['item_type' => 'add_on', 'amount' => 300.00]);
        BillingLineItem::updateOrCreate(['billing_id' => $bill->billing_id, 'item_description' => 'Electric Fan'], ['item_type' => 'add_on', 'amount' => 150.00]);
        BillingLineItem::updateOrCreate(['billing_id' => $bill->billing_id, 'item_description' => 'Late posting fee (house rule)'], ['item_type' => 'penalty', 'amount' => 500.00]);

        Payment::updateOrCreate(['billing_id' => $bill->billing_id, 'reference_number' => 'GC-' . Carbon::now()->format('Ym') . '-550123'], [
            'processed_by' => $users['staff']->user_id, 'amount_paid' => 5000.00, 'payment_date' => Carbon::now()->startOfMonth()->addDays(8)->toDateString(),
            'payment_method' => 'gcash', 'remarks' => 'Partial — balance of ₱4,450 due by 20th',
        ]);
    }

    private function seedScenarioRamon(array $users, array $inventory): void
    {
        $tenant = Tenant::updateOrCreate(
            ['email' => 'ramon.delapena@example.ph'],
            [
                'first_name' => 'Ramon', 'last_name' => 'Dela Peña', 'contact_number' => '09381234567',
                'address' => 'Blk 12 Lot 5, Project 4, Quezon City 1109',
                'emergency_contact_name' => 'Irma Dela Peña', 'emergency_contact_number' => '09380009999',
                'status' => 'active',
            ]
        );

        $bed = BedSpace::where('room_id', $inventory['rooms']['sharedFour']->room_id)->where('bed_label', 'Bed D')->firstOrFail();
        $bed->update(['status' => 'occupied']);

        $contract = Contract::updateOrCreate(
            ['tenant_id' => $tenant->tenant_id, 'bed_space_id' => $bed->bed_space_id],
            [
                'created_by' => $users['admin']->user_id, 'move_in_date' => '2026-03-01', 'expected_move_out_date' => '2026-09-01',
                'deposit_amount' => 4500.00, 'monthly_rate_override' => 4500.00, 'status' => 'active',
            ]
        );

        foreach ([Carbon::create(2026, 3, 1), Carbon::now()->startOfMonth()] as $m) {
            $bill = Billing::updateOrCreate(
                ['contract_id' => $contract->contract_id, 'billing_period_from' => $m->toDateString(), 'billing_period_to' => $m->copy()->endOfMonth()->toDateString()],
                ['due_date' => $m->copy()->addDays(5)->toDateString(), 'status' => 'overdue']
            );
            BillingLineItem::updateOrCreate(['billing_id' => $bill->billing_id, 'item_type' => 'base_rent'], ['item_description' => "Monthly Base Rent ({$inventory['rooms']['sharedFour']->room_code})", 'amount' => 4500.00]);
        }
    }

    private function seedScenarioLena(array $users, array $inventory): void
    {
        $tenant = Tenant::updateOrCreate(
            ['email' => 'lena.fernandez@example.ph'],
            [
                'first_name' => 'Lena Marie', 'last_name' => 'Fernandez', 'contact_number' => '09451239876',
                'address' => '27 Regalado Ave, Commonwealth, Quezon City 1121',
                'emergency_contact_name' => 'Joel Fernandez', 'emergency_contact_number' => '09450001122',
                'status' => 'active',
            ]
        );

        $bed = BedSpace::where('room_id', $inventory['rooms']['sharedTwin']->room_id)->where('bed_label', 'Bed A')->firstOrFail();
        $bed->update(['status' => 'occupied']);

        $contract = Contract::updateOrCreate(
            ['tenant_id' => $tenant->tenant_id, 'bed_space_id' => $bed->bed_space_id],
            [
                'created_by' => $users['admin']->user_id, 'move_in_date' => '2026-01-15', 'expected_move_out_date' => '2026-07-15',
                'deposit_amount' => 5500.00, 'monthly_rate_override' => 5500.00, 'status' => 'active',
            ]
        );

        $lc = Carbon::create(2026, 1, 1)->startOfMonth();
        while ($lc->lte(Carbon::now()->startOfMonth())) {
            $this->seedPaidBillingMonth($contract, $lc->copy(), 5500.00, $users['staff']->user_id, $lc->month % 2 === 0 ? 'gcash' : 'cash', []);
            $lc->addMonth();
        }
    }

    private function seedScenarioClarissa(array $users, array $inventory): void
    {
        $tenant = Tenant::updateOrCreate(
            ['email' => 'clarissa.ocampo@example.ph'],
            [
                'first_name' => 'Clarissa Anne', 'last_name' => 'Ocampo', 'contact_number' => '09339998888',
                'address' => '9 Rizal St, Taytay, Rizal 1920',
                'emergency_contact_name' => 'Benjamin Ocampo', 'emergency_contact_number' => '09330004444',
                'status' => 'moved_out',
            ]
        );

        $bed = BedSpace::where('room_id', $inventory['rooms']['sharedFour']->room_id)->where('bed_label', 'Bed B')->firstOrFail();

        $contract = Contract::updateOrCreate(
            ['tenant_id' => $tenant->tenant_id, 'bed_space_id' => $bed->bed_space_id],
            [
                'created_by' => $users['admin']->user_id, 'move_in_date' => '2025-01-01', 'expected_move_out_date' => '2025-12-30',
                'actual_move_out_date' => '2025-05-30', 'deposit_amount' => 4500.00, 'monthly_rate_override' => 4500.00,
                'status' => 'completed', 'is_cleared' => true, 'notes' => 'Moved out early for job relocation. Clearance passed, deposit refunded.',
            ]
        );

        for ($m = 1; $m <= 5; $m++) {
            $this->seedPaidBillingMonth($contract, Carbon::create(2025, $m, 1), 4500.00, $users['admin']->user_id, 'cash', []);
        }
    }

    private function seedScenarioGabriel(array $users, array $inventory): void
    {
        $tenant = Tenant::updateOrCreate(
            ['email' => 'gabriel.santos@example.ph'],
            [
                'first_name' => 'Gabriel', 'last_name' => 'Santos', 'contact_number' => '09561234567',
                'address' => '5 Kalayaan Ave, Diliman, Quezon City 1100',
                'emergency_contact_name' => 'Patricia Santos', 'emergency_contact_number' => '09560007777',
                'status' => 'active',
            ]
        );

        $bed = BedSpace::where('room_id', $inventory['rooms']['sharedTriple']->room_id)->where('bed_label', 'Bed A')->firstOrFail();

        $contract = Contract::updateOrCreate(
            ['tenant_id' => $tenant->tenant_id, 'bed_space_id' => $bed->bed_space_id],
            [
                'created_by' => $users['staff']->user_id, 'move_in_date' => Carbon::now()->addDays(14)->toDateString(),
                'expected_move_out_date' => Carbon::now()->addMonths(6)->endOfMonth()->toDateString(),
                'deposit_amount' => 5000.00, 'monthly_rate_override' => 5000.00, 'status' => 'pending_payment',
                'notes' => 'Awaiting advance rent + deposit. Scheduled move-in on the 15th.',
            ]
        );

        $bill = Billing::updateOrCreate(
            ['contract_id' => $contract->contract_id, 'billing_period_from' => Carbon::now()->startOfMonth()->toDateString(), 'billing_period_to' => Carbon::now()->endOfMonth()->toDateString()],
            ['due_date' => Carbon::now()->startOfMonth()->addDays(12)->toDateString(), 'status' => 'unpaid']
        );
        BillingLineItem::updateOrCreate(['billing_id' => $bill->billing_id, 'item_type' => 'base_rent'], ['item_description' => "Advance Rent ({$inventory['rooms']['sharedTriple']->room_code})", 'amount' => 5000.00]);
    }

    private function seedScenarioMaricel(array $users, array $inventory): void
    {
        $tenant = Tenant::updateOrCreate(
            ['email' => 'maricel.bautista@example.ph'],
            [
                'first_name' => 'Maricel', 'last_name' => 'Bautista', 'contact_number' => '09271234567',
                'address' => '120 Aurora Blvd, New Manila, Quezon City 1112',
                'emergency_contact_name' => 'Eduardo Bautista', 'emergency_contact_number' => '09270008888',
                'status' => 'active',
            ]
        );

        $bed = BedSpace::where('room_id', $inventory['rooms']['soloDeluxe']->room_id)->firstOrFail();
        $bed->update(['status' => 'occupied']);

        $contract = Contract::updateOrCreate(
            ['tenant_id' => $tenant->tenant_id, 'bed_space_id' => $bed->bed_space_id],
            [
                'created_by' => $users['staff']->user_id, 'move_in_date' => '2026-01-01', 'expected_move_out_date' => '2026-12-31',
                'deposit_amount' => 10000.00, 'monthly_rate_override' => 10000.00, 'status' => 'active',
            ]
        );

        ContractAddOn::updateOrCreate(['contract_id' => $contract->contract_id, 'add_on_id' => $inventory['addons']['router']->add_on_id], ['actual_rate' => 200.00]);

        $mc = Carbon::create(2026, 1, 1)->startOfMonth();
        while ($mc->lte(Carbon::now()->startOfMonth())) {
            $extras = [['item_type' => 'add_on', 'item_description' => 'Personal Wi‑Fi Router', 'amount' => 200.00]];
            if ($mc->month % 2 === 0) {
                $extras[] = ['item_type' => 'utility', 'item_description' => 'Electric & water (sub-meter reading)', 'amount' => 650.00];
            }
            $this->seedPaidBillingMonth($contract, $mc->copy(), 10000.00, $users['staff']->user_id, 'bank_transfer', $extras);
            $mc->addMonth();
        }
    }

    private function seedScenarioJoaquin(array $users, array $inventory): void
    {
        $tenant = Tenant::updateOrCreate(
            ['email' => 'joaquin.villanueva@example.ph'],
            [
                'first_name' => 'Joaquin', 'last_name' => 'Villanueva', 'contact_number' => '09651234567',
                'address' => 'San Mateo, Rizal 1850',
                'emergency_contact_name' => 'Carmen Villanueva', 'emergency_contact_number' => '09650006666',
                'status' => 'moved_out',
            ]
        );

        $bed = BedSpace::where('room_id', $inventory['rooms']['sharedTwin']->room_id)->where('bed_label', 'Bed B')->firstOrFail();

        $contract = Contract::updateOrCreate(
            ['tenant_id' => $tenant->tenant_id, 'bed_space_id' => $bed->bed_space_id],
            [
                'created_by' => $users['admin']->user_id, 'move_in_date' => '2025-11-01', 'expected_move_out_date' => '2026-05-01',
                'actual_move_out_date' => '2026-02-15', 'deposit_amount' => 5500.00, 'monthly_rate_override' => 5500.00,
                'status' => 'terminated', 'is_cleared' => false, 'notes' => 'Tenant vacated without formal clearance. Deposit withheld pending inspection.',
            ]
        );

        $this->seedPaidBillingMonth($contract, Carbon::create(2025, 11, 1), 5500.00, $users['staff']->user_id, 'cash', []);

        $billDec = Billing::updateOrCreate(
            ['contract_id' => $contract->contract_id, 'billing_period_from' => '2025-12-01', 'billing_period_to' => '2025-12-31'],
            ['due_date' => '2025-12-06', 'status' => 'paid']
        );
        BillingLineItem::updateOrCreate(['billing_id' => $billDec->billing_id, 'item_type' => 'base_rent', 'item_description' => 'Monthly Base Rent'], ['amount' => 5500.00]);
        Payment::updateOrCreate(['billing_id' => $billDec->billing_id, 'reference_number' => 'REF-202512-VALID'], [
            'processed_by' => $users['staff']->user_id, 'amount_paid' => 5500.00, 'payment_date' => '2025-12-03', 'payment_method' => 'cash',
        ]);
        Payment::updateOrCreate(['billing_id' => $billDec->billing_id, 'reference_number' => 'REF-202512-VOIDED'], [
            'processed_by' => $users['staff']->user_id, 'amount_paid' => 5500.00, 'payment_date' => '2025-12-03', 'payment_method' => 'cash',
            'remarks' => 'Duplicate entry — voided by admin', 'voided_at' => Carbon::create(2025, 12, 4, 9, 30, 0),
            'voided_by' => $users['admin']->user_id, 'void_reason' => 'Duplicate payment recorded in error. Original REF-202512-VALID is the valid record.',
        ]);

        $this->seedPaidBillingMonth($contract, Carbon::create(2026, 1, 1), 5500.00, $users['staff']->user_id, 'gcash', []);

        $billFeb = Billing::updateOrCreate(
            ['contract_id' => $contract->contract_id, 'billing_period_from' => '2026-02-01', 'billing_period_to' => '2026-02-28'],
            ['due_date' => '2026-02-06', 'status' => 'overdue']
        );
        BillingLineItem::updateOrCreate(['billing_id' => $billFeb->billing_id, 'item_type' => 'base_rent'], ['item_description' => "Prorated Rent ({$inventory['rooms']['sharedTwin']->room_code}, 15 days)", 'amount' => 2750.00]);
    }

    private function seedScenarioJosiah(array $users, array $inventory): void
    {
        $tenant = Tenant::updateOrCreate(
            ['email' => 'josiah.lim@example.ph'],
            [
                'first_name' => 'Josiah', 'last_name' => 'Lim', 'contact_number' => '09123456789',
                'address' => 'Quezon City',
                'emergency_contact_name' => 'Mary Lim', 'emergency_contact_number' => '09123456780',
                'status' => 'active',
            ]
        );

        $bed = BedSpace::where('room_id', $inventory['rooms']['sharedTriple']->room_id)->where('bed_label', 'Bed B')->firstOrFail();

        Contract::updateOrCreate(
            ['tenant_id' => $tenant->tenant_id, 'bed_space_id' => $bed->bed_space_id],
            [
                'created_by' => $users['staff']->user_id, 'move_in_date' => Carbon::now()->subDays(30)->toDateString(),
                'expected_move_out_date' => Carbon::now()->addMonths(5)->toDateString(),
                'deposit_amount' => 5000.00, 'monthly_rate_override' => 5000.00, 'status' => 'voided',
                'notes' => 'Contract voided after background check failure. Deposit refunded.',
            ]
        );
    }

    private function seedScenarioArchived(): void
    {
        Tenant::updateOrCreate(
            ['email' => 'leandro.cruz@example.ph'],
            [
                'first_name' => 'Leandro', 'last_name' => 'Cruz', 'contact_number' => '09440001111',
                'address' => 'National Road, Basco, Batanes 3900', 'emergency_contact_name' => 'Marina Cruz',
                'emergency_contact_number' => '09440005555', 'status' => 'archived',
            ]
        );
    }

    private function syncInventoryStatus(array $rooms): void
    {
        // Explicitly include the archived room for sync
        foreach ($rooms as $room) {
            RoomService::syncStatusAndCapacity($room);
        }
    }

    private function seedHistoricalMeterReadings(array $users, array $rooms): void
    {
        foreach ($rooms as $room) {
            // Seed 6 months of readings
            $electricValue = 1200.5;
            $waterValue = 45.2;
            
            for ($i = 6; $i >= 0; $i--) {
                $date = Carbon::now()->subMonths($i)->startOfMonth()->addDays(25);
                
                \App\Models\RoomMeterReading::create([
                    'room_id' => $room->room_id,
                    'utility_type' => 'electric',
                    'reading_date' => $date->toDateString(),
                    'reading_value' => $electricValue,
                    'recorded_by' => $users['staff']->user_id,
                ]);
                
                \App\Models\RoomMeterReading::create([
                    'room_id' => $room->room_id,
                    'utility_type' => 'water',
                    'reading_date' => $date->toDateString(),
                    'reading_value' => $waterValue,
                    'recorded_by' => $users['staff']->user_id,
                ]);
                
                $electricValue += random_int(80, 150);
                $waterValue += random_int(5, 12);
            }
        }
    }

    /**
     * Helper: Seed a fully-paid billing month.
     */
    private function seedPaidBillingMonth(Contract $contract, Carbon $monthStart, float $baseRent, int $processedByUserId, string $paymentMethod, array $extraLineItems = []): void
    {
        $from = $monthStart->copy()->startOfMonth();
        $to   = $from->copy()->endOfMonth();

        $bill = Billing::updateOrCreate(
            ['contract_id' => $contract->contract_id, 'billing_period_from' => $from->toDateString(), 'billing_period_to' => $to->toDateString()],
            ['due_date' => $from->copy()->addDays(5)->toDateString(), 'status' => 'paid']
        );

        BillingLineItem::updateOrCreate(['billing_id' => $bill->billing_id, 'item_type' => 'base_rent', 'item_description' => 'Monthly Base Rent'], ['amount' => $baseRent]);

        foreach ($extraLineItems as $row) {
            BillingLineItem::updateOrCreate(['billing_id' => $bill->billing_id, 'item_description' => $row['item_description']], array_merge(['billing_id' => $bill->billing_id], $row));
        }

        $totalDue = $baseRent + array_sum(array_column($extraLineItems, 'amount'));
        $ref = match ($paymentMethod) {
            'gcash'         => 'GC-' . $from->format('Ym') . '-' . random_int(100000, 999999),
            'bank_transfer' => 'BTR-' . $from->format('Ym') . '-' . random_int(100000, 999999),
            default         => 'REF-' . $from->format('Ym') . '-' . random_int(100000, 999999),
        };

        Payment::updateOrCreate(['billing_id' => $bill->billing_id, 'reference_number' => $ref], [
            'processed_by'   => $processedByUserId, 'amount_paid'    => $totalDue,
            'payment_date'   => $from->copy()->addDays(2)->toDateString(), 'payment_method' => $paymentMethod,
        ]);
    }
}
