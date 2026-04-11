<?php

namespace Database\Seeders;

use App\Models\BedSpace;
use App\Models\Billing;
use App\Models\BillingLineItem;
use App\Models\Contract;
use App\Models\Payment;
use App\Models\Role;
use App\Models\Room;
use App\Models\Tenant;
use App\Models\User;
use App\Services\RoomService;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * DemoUatSeeder
 *
 * Populates the system with realistic Philippine-context data.
 * Simulates a system that has been operating since January 2025.
 */
class DemoUatSeeder extends Seeder
{
    private const DEMO_PASSWORD = 'HavenStay123!';

    public function run(): void
    {
        // 1. Roles & Users
        $adminRole = Role::where('role_name', 'admin')->firstOrFail();
        $staffRole = Role::where('role_name', 'staff')->firstOrFail();
        $viewerRole = Role::where('role_name', 'viewer')->firstOrFail();

        $adminUser = User::updateOrCreate(
            ['username' => 'admin'],
            [
                'first_name' => 'Juan',
                'last_name' => 'Dela Cruz',
                'email' => 'admin@havenstay.ph',
                'password_hash' => Hash::make(self::DEMO_PASSWORD),
                'role_id' => $adminRole->role_id,
                'is_active' => true,
            ]
        );

        $staffUser = User::updateOrCreate(
            ['username' => 'staff'],
            [
                'first_name' => 'Elena',
                'last_name' => 'Santos',
                'email' => 'elena.santos@havenstay.ph',
                'password_hash' => Hash::make(self::DEMO_PASSWORD),
                'role_id' => $staffRole->role_id,
                'is_active' => true,
            ]
        );

        User::updateOrCreate(
            ['username' => 'viewer'],
            [
                'first_name' => 'Ricardo',
                'last_name' => 'Dalisay',
                'email' => 'rdalisay@havenstay.ph',
                'password_hash' => Hash::make(self::DEMO_PASSWORD),
                'role_id' => $viewerRole->role_id,
                'is_active' => true,
            ]
        );

        // 2. Rooms & Bed Spaces
        $sharedRoom = Room::updateOrCreate(
            ['room_code' => 'R-101'],
            [
                'room_type' => 'shared',
                'capacity' => 4,
                'monthly_rate' => 4500.00,
                'status' => 'available',
                'amenities' => 'WiFi, Ceiling Fan, Study Desk, Individual Lockers',
                'description' => 'Four-bed sharing unit on the first floor.',
            ]
        );
        foreach (['A', 'B', 'C', 'D'] as $label) {
            BedSpace::updateOrCreate(
                ['room_id' => $sharedRoom->room_id, 'bed_label' => "Bed $label"],
                ['status' => 'vacant']
            );
        }

        $soloRoom1 = Room::updateOrCreate(
            ['room_code' => 'R-201'],
            [
                'room_type' => 'solo',
                'capacity' => 1,
                'monthly_rate' => 8000.00,
                'status' => 'available',
                'amenities' => 'Aircon, Private Toilet, WiFi',
                'description' => 'Solo unit with garden view.',
            ]
        );
        $bedSolo1 = BedSpace::updateOrCreate(
            ['room_id' => $soloRoom1->room_id, 'bed_label' => 'Solo Bed'],
            ['status' => 'vacant']
        );

        $soloRoom2 = Room::updateOrCreate(
            ['room_code' => 'R-202'],
            [
                'room_type' => 'solo',
                'capacity' => 1,
                'monthly_rate' => 8500.00,
                'status' => 'available',
                'amenities' => 'Aircon, Private Toilet, WiFi, Water Heater',
                'description' => 'Premium solo unit with balcony.',
            ]
        );
        $bedSolo2 = BedSpace::updateOrCreate(
            ['room_id' => $soloRoom2->room_id, 'bed_label' => 'Solo Bed'],
            ['status' => 'vacant']
        );

        $maintenanceRoom = Room::updateOrCreate(
            ['room_code' => 'R-301'],
            [
                'room_type' => 'shared',
                'capacity' => 2,
                'monthly_rate' => 5000.00,
                'status' => 'maintenance',
                'amenities' => 'WiFi, Fan',
                'description' => 'Undergoing repainting.',
            ]
        );
        BedSpace::updateOrCreate(['room_id' => $maintenanceRoom->room_id, 'bed_label' => 'Bed A'], ['status' => 'maintenance']);
        BedSpace::updateOrCreate(['room_id' => $maintenanceRoom->room_id, 'bed_label' => 'Bed B'], ['status' => 'maintenance']);

        // 3. Tenants & Contracts (Scenarios)

        // Scenario A: Maria Clara - Operating since mid-2025, perfect payment history.
        $tenantMaria = Tenant::create([
            'first_name' => 'Maria Clara',
            'last_name' => 'de los Santos',
            'contact_number' => '09171234567',
            'email' => 'maria.clara@example.ph',
            'address' => 'Binondo, Manila',
            'emergency_contact_name' => 'Capitan Tiago',
            'emergency_contact_number' => '09170001111',
            'status' => 'active',
        ]);
        $sharedRoom->bedSpaces()->where('bed_label', 'Bed A')->update(['status' => 'occupied']);
        $bedMaria = $sharedRoom->bedSpaces()->where('bed_label', 'Bed A')->first();
        $contractMaria = Contract::create([
            'tenant_id' => $tenantMaria->tenant_id,
            'bed_space_id' => $bedMaria->bed_space_id,
            'created_by' => $adminUser->user_id,
            'move_in_date' => '2025-06-01',
            'deposit_amount' => 4500.00,
            'monthly_rate' => 4500.00,
            'status' => 'active',
        ]);
        // Generate historical bills for Maria from June 2025 to last month
        $start = Carbon::parse('2025-06-01');
        $end = Carbon::now()->subMonth()->startOfMonth();
        while ($start <= $end) {
            $bill = Billing::create([
                'contract_id' => $contractMaria->contract_id,
                'billing_period_from' => $start->toDateString(),
                'billing_period_to' => $start->copy()->endOfMonth()->toDateString(),
                'due_date' => $start->copy()->addDays(5)->toDateString(),
                'status' => 'paid',
            ]);
            BillingLineItem::create(['billing_id' => $bill->billing_id, 'item_type' => 'base_rent', 'amount' => 4500.00]);
            Payment::create([
                'billing_id' => $bill->billing_id,
                'processed_by' => $staffUser->user_id,
                'amount_paid' => 4500.00,
                'payment_date' => $start->copy()->addDays(2)->toDateString(),
                'payment_method' => 'gcash',
                'reference_number' => 'GC-'.rand(100000, 999999),
            ]);
            $start->addMonth();
        }

        // Scenario B: Crisostomo Ibarra - Active, forgot to pay this current month.
        $tenantIbarra = Tenant::create([
            'first_name' => 'Crisostomo',
            'last_name' => 'Ibarra',
            'contact_number' => '09187654321',
            'email' => 'ibarra.c@example.ph',
            'address' => 'San Diego, Bulacan',
            'emergency_contact_name' => 'Don Rafael Ibarra',
            'emergency_contact_number' => '09180002222',
            'status' => 'active',
        ]);
        $bedSolo1->update(['status' => 'occupied']);
        $contractIbarra = Contract::create([
            'tenant_id' => $tenantIbarra->tenant_id,
            'bed_space_id' => $bedSolo1->bed_space_id,
            'created_by' => $adminUser->user_id,
            'move_in_date' => '2025-08-15',
            'deposit_amount' => 8000.00,
            'monthly_rate' => 8000.00,
            'status' => 'active',
        ]);
        // Last 2 months paid
        for ($i = 2; $i >= 1; $i--) {
            $dt = Carbon::now()->subMonths($i)->startOfMonth();
            $bill = Billing::create([
                'contract_id' => $contractIbarra->contract_id,
                'billing_period_from' => $dt->toDateString(),
                'billing_period_to' => $dt->copy()->endOfMonth()->toDateString(),
                'due_date' => $dt->copy()->addDays(5)->toDateString(),
                'status' => 'paid',
            ]);
            BillingLineItem::create(['billing_id' => $bill->billing_id, 'item_type' => 'base_rent', 'amount' => 8000.00]);
            Payment::create([
                'billing_id' => $bill->billing_id,
                'processed_by' => $staffUser->user_id,
                'amount_paid' => 8000.00,
                'payment_date' => $dt->copy()->addDays(1)->toDateString(),
                'payment_method' => 'bank_transfer',
                'reference_number' => 'BDO-'.rand(100000, 999999),
            ]);
        }
        // Current month: UNPAID
        $billCurrentIbarra = Billing::create([
            'contract_id' => $contractIbarra->contract_id,
            'billing_period_from' => Carbon::now()->startOfMonth()->toDateString(),
            'billing_period_to' => Carbon::now()->endOfMonth()->toDateString(),
            'due_date' => Carbon::now()->startOfMonth()->addDays(5)->toDateString(),
            'status' => 'unpaid',
        ]);
        BillingLineItem::create(['billing_id' => $billCurrentIbarra->billing_id, 'item_type' => 'base_rent', 'amount' => 8000.00]);

        // Scenario C: Padre Damaso - Partially paid with adjustments
        $tenantDamaso = Tenant::create([
            'first_name' => 'Damaso',
            'last_name' => 'Verdolagas',
            'contact_number' => '09201112222',
            'email' => 'padre.damaso@example.ph',
            'address' => 'Vigan, Ilocos Sur',
            'emergency_contact_name' => 'Fray Bernardo Salvi',
            'emergency_contact_number' => '09200003333',
            'status' => 'active',
        ]);
        $bedSolo2->update(['status' => 'occupied']);
        $contractDamaso = Contract::create([
            'tenant_id' => $tenantDamaso->tenant_id,
            'bed_space_id' => $bedSolo2->bed_space_id,
            'created_by' => $adminUser->user_id,
            'move_in_date' => '2025-10-01',
            'deposit_amount' => 8500.00,
            'monthly_rate' => 8500.00,
            'status' => 'active',
        ]);
        // Current month: Partial
        $billDamaso = Billing::create([
            'contract_id' => $contractDamaso->contract_id,
            'billing_period_from' => Carbon::now()->startOfMonth()->toDateString(),
            'billing_period_to' => Carbon::now()->endOfMonth()->toDateString(),
            'due_date' => Carbon::now()->startOfMonth()->addDays(5)->toDateString(),
            'status' => 'partial',
        ]);
        BillingLineItem::create(['billing_id' => $billDamaso->billing_id, 'item_type' => 'base_rent', 'amount' => 8500.00]);
        BillingLineItem::create(['billing_id' => $billDamaso->billing_id, 'item_type' => 'penalty', 'item_description' => 'Late payment fee', 'amount' => 500.00]);
        Payment::create([
            'billing_id' => $billDamaso->billing_id,
            'processed_by' => $staffUser->user_id,
            'amount_paid' => 4000.00,
            'payment_date' => Carbon::now()->toDateString(),
            'payment_method' => 'cash',
            'remarks' => 'Will pay the rest on the 15th',
        ]);

        // Scenario D: Sisa - Historical tenant who moved out
        $tenantSisa = Tenant::create([
            'first_name' => 'Sisa',
            'last_name' => 'Narciso',
            'contact_number' => '09339998888',
            'email' => 'sisa@example.ph',
            'address' => 'Taytay, Rizal',
            'emergency_contact_name' => 'Crispin Narciso',
            'emergency_contact_number' => '09330004444',
            'status' => 'moved_out',
        ]);
        $bedSisa = $sharedRoom->bedSpaces()->where('bed_label', 'Bed B')->first();
        $contractSisa = Contract::create([
            'tenant_id' => $tenantSisa->tenant_id,
            'bed_space_id' => $bedSisa->bed_space_id,
            'created_by' => $adminUser->user_id,
            'move_in_date' => '2025-01-01',
            'actual_move_out_date' => '2025-05-30',
            'deposit_amount' => 4500.00,
            'monthly_rate' => 4500.00,
            'status' => 'completed',
        ]);
        // History for Sisa (Jan to May 2025)
        for ($m = 1; $m <= 5; $m++) {
            $dt = Carbon::parse("2025-$m-01");
            $bill = Billing::create([
                'contract_id' => $contractSisa->contract_id,
                'billing_period_from' => $dt->toDateString(),
                'billing_period_to' => $dt->copy()->endOfMonth()->toDateString(),
                'due_date' => $dt->copy()->addDays(5)->toDateString(),
                'status' => 'paid',
            ]);
            BillingLineItem::create(['billing_id' => $bill->billing_id, 'item_type' => 'base_rent', 'amount' => 4500.00]);
            Payment::create([
                'billing_id' => $bill->billing_id,
                'processed_by' => $adminUser->user_id,
                'amount_paid' => 4500.00,
                'payment_date' => $dt->copy()->toDateString(),
                'payment_method' => 'cash',
            ]);
        }

        // Scenario E: Basilio - Prospective tenant
        Tenant::create([
            'first_name' => 'Basilio',
            'last_name' => 'Narciso',
            'contact_number' => '09440001111',
            'email' => 'basilio@example.ph',
            'address' => 'Basco, Batanes',
            'emergency_contact_name' => 'Sisa Narciso',
            'emergency_contact_number' => '09440005555',
            'status' => 'archived',
        ]);

        // 4. Sync Room Statuses
        RoomService::syncStatusAndCapacity($sharedRoom);
        RoomService::syncStatusAndCapacity($soloRoom1);
        RoomService::syncStatusAndCapacity($soloRoom2);
        RoomService::syncStatusAndCapacity($maintenanceRoom);
    }
}
