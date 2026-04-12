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
 * Demo / UAT seed — realistic Philippine boarding-house data for dashboard, billing, and reports.
 *
 * Assumes **fresh migrate** (`php artisan migrate:fresh --seed`). Uses `Carbon::now()` so “current month”
 * matches the date you run the seeder (e.g. April 2026: unpaid / overdue / partial scenarios align with “today”).
 *
 * **Alignment (sources of truth):**
 * - `backend/database/sql/havenstay_schema.sql` — all ENUM values (`tenants.status`, `rooms.status`, `bed_spaces.status`,
 *   `contracts.status`, `billing.status`, `billing_line_items.item_type`, `payments.payment_method`) match the DDL.
 *   Line items satisfy `amount <> 0`; payments satisfy `amount_paid > 0`; billing cycles are unique per `uq_billing_cycle`.
 * - `docs/SRS.md` §6.3 & §7 — **BR-004** (`overdue` when nothing paid and past due): Ramon (no payments), Miguel (past due, unpaid)
 *   follow that; **Paolo** is `partial` (not BR-004 overdue). **FR-013/FR-039**: `RoomService::syncStatusAndCapacity()` runs after seed;
 *   `rooms.status` never uses invalid `occupied` (FR-015a).
 *
 * **Not replicated (demo shortcut):** rows are inserted with Eloquent, not `BillingService::create` / `PaymentService::record`,
 * so **CCR-007 `transaction_logs`** and trigger-written **audit** rows are not created for these inserts, and **`BillingService::autoUpdateStatus()`**
 * (BR-008) is not run — `billing.status` is set explicitly so UI/views match intended scenarios. Production paths remain authoritative.
 *
 * Login (demo only): admin / staff / viewer — password `HavenStay123!` (see `DEMO_PASSWORD` constant).
 */
class DemoUatSeeder extends Seeder
{
    private const DEMO_PASSWORD = 'HavenStay123!';

    /** Standard room codes (`rooms.room_code`, max 20 chars) — HS-{floor}{unit}. */
    private const ROOM_SHARED_FOUR_BED = 'HS-101';

    private const ROOM_SHARED_TWIN = 'HS-102';

    private const ROOM_SOLO_STANDARD = 'HS-201';

    private const ROOM_SOLO_PREMIUM = 'HS-202';

    private const ROOM_SHARED_MAINTENANCE = 'HS-301';

    public function run(): void
    {
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

        // --- Inventory: rooms & beds (Katipunan / QC–style rates, PHP, 2025–2026) ---
        $sharedFour = Room::updateOrCreate(
            ['room_code' => self::ROOM_SHARED_FOUR_BED],
            [
                'room_type' => 'shared',
                'capacity' => 4,
                'monthly_rate' => 4500.00,
                'status' => 'available',
                'amenities' => 'Wi‑Fi, ceiling fan, study desk, shared pantry access',
                'description' => 'Ground floor quad — common for students and young professionals.',
            ]
        );
        foreach (['A', 'B', 'C', 'D'] as $label) {
            BedSpace::updateOrCreate(
                ['room_id' => $sharedFour->room_id, 'bed_label' => "Bed $label"],
                ['status' => 'vacant']
            );
        }

        $sharedTwin = Room::updateOrCreate(
            ['room_code' => self::ROOM_SHARED_TWIN],
            [
                'room_type' => 'shared',
                'capacity' => 2,
                'monthly_rate' => 5200.00,
                'status' => 'available',
                'amenities' => 'Wi‑Fi, air‑con (evening hours), lockers',
                'description' => 'Second floor twin — two beds, quieter wing.',
            ]
        );
        foreach (['A', 'B'] as $label) {
            BedSpace::updateOrCreate(
                ['room_id' => $sharedTwin->room_id, 'bed_label' => "Bed $label"],
                ['status' => 'vacant']
            );
        }

        $soloStandard = Room::updateOrCreate(
            ['room_code' => self::ROOM_SOLO_STANDARD],
            [
                'room_type' => 'solo',
                'capacity' => 1,
                'monthly_rate' => 8000.00,
                'status' => 'available',
                'amenities' => 'Aircon, private toilet, Wi‑Fi',
                'description' => 'Solo unit — rear building, garden view.',
            ]
        );
        $bedSoloStd = BedSpace::updateOrCreate(
            ['room_id' => $soloStandard->room_id, 'bed_label' => 'Solo Bed'],
            ['status' => 'vacant']
        );

        $soloPremium = Room::updateOrCreate(
            ['room_code' => self::ROOM_SOLO_PREMIUM],
            [
                'room_type' => 'solo',
                'capacity' => 1,
                'monthly_rate' => 8500.00,
                'status' => 'available',
                'amenities' => 'Aircon, private toilet, Wi‑Fi, water heater',
                'description' => 'Premium solo with small balcony.',
            ]
        );
        $bedSoloPrem = BedSpace::updateOrCreate(
            ['room_id' => $soloPremium->room_id, 'bed_label' => 'Solo Bed'],
            ['status' => 'vacant']
        );

        $maintenanceRoom = Room::updateOrCreate(
            ['room_code' => self::ROOM_SHARED_MAINTENANCE],
            [
                'room_type' => 'shared',
                'capacity' => 2,
                'monthly_rate' => 5000.00,
                'status' => 'maintenance',
                'amenities' => 'Wi‑Fi, fan',
                'description' => 'Temporarily closed — repainting & electrical check.',
            ]
        );
        BedSpace::updateOrCreate(
            ['room_id' => $maintenanceRoom->room_id, 'bed_label' => 'Bed A'],
            ['status' => 'maintenance']
        );
        BedSpace::updateOrCreate(
            ['room_id' => $maintenanceRoom->room_id, 'bed_label' => 'Bed B'],
            ['status' => 'maintenance']
        );

        // --- Tenants & contracts (scenarios for billing / reports / occupancy) ---

        // 1) Long‑term good payer — shared Bed A, history through **current month** (incl. utility on current month).
        $tenantCheska = Tenant::create([
            'first_name' => 'Francesca',
            'last_name' => 'Reyes',
            'contact_number' => '09171234567',
            'email' => 'cheska.reyes@example.ph',
            'address' => 'Loyola Heights, Quezon City',
            'emergency_contact_name' => 'Teresa Reyes',
            'emergency_contact_number' => '09170001111',
            'status' => 'active',
        ]);
        $bedCheska = $sharedFour->bedSpaces()->where('bed_label', 'Bed A')->firstOrFail();
        $bedCheska->update(['status' => 'occupied']);
        $contractCheska = Contract::create([
            'tenant_id' => $tenantCheska->tenant_id,
            'bed_space_id' => $bedCheska->bed_space_id,
            'created_by' => $adminUser->user_id,
            'move_in_date' => '2025-06-01',
            'deposit_amount' => 4500.00,
            'monthly_rate' => 4500.00,
            'status' => 'active',
        ]);
        $cursor = Carbon::parse('2025-06-01')->startOfMonth();
        $lastMonth = Carbon::now()->startOfMonth();
        while ($cursor->lte($lastMonth)) {
            $isCurrentMonth = $cursor->isSameMonth(Carbon::now());
            $extras = [];
            if ($isCurrentMonth) {
                $extras[] = [
                    'item_type' => 'utility',
                    'item_description' => 'Shared utilities (Meralco estimate)',
                    'amount' => 280.00,
                ];
            }
            $this->seedPaidBillingMonth(
                $contractCheska,
                $cursor->copy(),
                4500.00,
                $staffUser->user_id,
                $cursor->month % 3 === 0 ? 'bank_transfer' : 'gcash',
                $extras
            );
            $cursor->addMonth();
        }

        // 2) Current month not yet paid — solo standard.
        $tenantMiguel = Tenant::create([
            'first_name' => 'Miguel Antonio',
            'last_name' => 'Torres',
            'contact_number' => '09187654321',
            'email' => 'miguel.torres@example.ph',
            'address' => 'Marikina City',
            'emergency_contact_name' => 'Rosa Torres',
            'emergency_contact_number' => '09180002222',
            'status' => 'active',
        ]);
        $bedSoloStd->update(['status' => 'occupied']);
        $contractMiguel = Contract::create([
            'tenant_id' => $tenantMiguel->tenant_id,
            'bed_space_id' => $bedSoloStd->bed_space_id,
            'created_by' => $adminUser->user_id,
            'move_in_date' => '2025-08-15',
            'deposit_amount' => 8000.00,
            'monthly_rate' => 8000.00,
            'status' => 'active',
        ]);
        for ($i = 2; $i >= 1; $i--) {
            $dt = Carbon::now()->subMonths($i)->startOfMonth();
            $this->seedPaidBillingMonth(
                $contractMiguel,
                $dt,
                8000.00,
                $staffUser->user_id,
                'bank_transfer',
                []
            );
        }
        $miguelDue = Carbon::now()->startOfMonth()->addDays(5)->startOfDay();
        $billMiguelCurrent = Billing::create([
            'contract_id' => $contractMiguel->contract_id,
            'billing_period_from' => Carbon::now()->startOfMonth()->toDateString(),
            'billing_period_to' => Carbon::now()->endOfMonth()->toDateString(),
            'due_date' => $miguelDue->toDateString(),
            // After due date with no payment → overdue (BR-004); before due → unpaid
            'status' => Carbon::now()->greaterThan($miguelDue) ? 'overdue' : 'unpaid',
        ]);
        BillingLineItem::create(['billing_id' => $billMiguelCurrent->billing_id, 'item_type' => 'base_rent', 'amount' => 8000.00]);

        // 3) Partial pay + penalty — solo premium.
        $tenantPaolo = Tenant::create([
            'first_name' => 'Paolo Lorenzo',
            'last_name' => 'Mendoza',
            'contact_number' => '09201112222',
            'email' => 'paolo.mendoza@example.ph',
            'address' => 'Teachers Village, Quezon City',
            'emergency_contact_name' => 'Luis Mendoza',
            'emergency_contact_number' => '09200003333',
            'status' => 'active',
        ]);
        $bedSoloPrem->update(['status' => 'occupied']);
        $contractPaolo = Contract::create([
            'tenant_id' => $tenantPaolo->tenant_id,
            'bed_space_id' => $bedSoloPrem->bed_space_id,
            'created_by' => $adminUser->user_id,
            'move_in_date' => '2025-10-01',
            'deposit_amount' => 8500.00,
            'monthly_rate' => 8500.00,
            'status' => 'active',
        ]);
        $billPaolo = Billing::create([
            'contract_id' => $contractPaolo->contract_id,
            'billing_period_from' => Carbon::now()->startOfMonth()->toDateString(),
            'billing_period_to' => Carbon::now()->endOfMonth()->toDateString(),
            'due_date' => Carbon::now()->startOfMonth()->addDays(5)->toDateString(),
            'status' => 'partial',
        ]);
        BillingLineItem::create(['billing_id' => $billPaolo->billing_id, 'item_type' => 'base_rent', 'amount' => 8500.00]);
        BillingLineItem::create([
            'billing_id' => $billPaolo->billing_id,
            'item_type' => 'penalty',
            'item_description' => 'Late posting fee (house rule)',
            'amount' => 500.00,
        ]);
        Payment::create([
            'billing_id' => $billPaolo->billing_id,
            'processed_by' => $staffUser->user_id,
            'amount_paid' => 4000.00,
            'payment_date' => Carbon::now()->toDateString(),
            'payment_method' => 'cash',
            'remarks' => 'Partial — balance by 20th',
        ]);

        // 4) Overdue — shared Bed D, moved in March; March & April cycles unpaid (past due dates).
        $tenantRamon = Tenant::create([
            'first_name' => 'Ramon',
            'last_name' => 'Dela Peña',
            'contact_number' => '09381234567',
            'email' => 'ramon.delapena@example.ph',
            'address' => 'Project 4, Quezon City',
            'emergency_contact_name' => 'Irma Dela Peña',
            'emergency_contact_number' => '09380009999',
            'status' => 'active',
        ]);
        $bedRamon = $sharedFour->bedSpaces()->where('bed_label', 'Bed D')->firstOrFail();
        $bedRamon->update(['status' => 'occupied']);
        $contractRamon = Contract::create([
            'tenant_id' => $tenantRamon->tenant_id,
            'bed_space_id' => $bedRamon->bed_space_id,
            'created_by' => $adminUser->user_id,
            'move_in_date' => '2026-03-01',
            'deposit_amount' => 4500.00,
            'monthly_rate' => 4500.00,
            'status' => 'active',
        ]);
        $mar = Carbon::create(2026, 3, 1)->startOfMonth();
        $apr = Carbon::create(2026, 4, 1)->startOfMonth();
        foreach ([$mar, $apr] as $m) {
            $billOverdue = Billing::create([
                'contract_id' => $contractRamon->contract_id,
                'billing_period_from' => $m->toDateString(),
                'billing_period_to' => $m->copy()->endOfMonth()->toDateString(),
                'due_date' => $m->copy()->addDays(5)->toDateString(),
                'status' => 'overdue',
            ]);
            BillingLineItem::create([
                'billing_id' => $billOverdue->billing_id,
                'item_type' => 'base_rent',
                'amount' => 4500.00,
            ]);
        }

        // 5) Twin shared — HS-102 Bed A; short good history.
        $tenantLena = Tenant::create([
            'first_name' => 'Lena Marie',
            'last_name' => 'Fernandez',
            'contact_number' => '09451239876',
            'email' => 'lena.fernandez@example.ph',
            'address' => 'Commonwealth, Quezon City',
            'emergency_contact_name' => 'Joel Fernandez',
            'emergency_contact_number' => '09450001122',
            'status' => 'active',
        ]);
        $bedLena = $sharedTwin->bedSpaces()->where('bed_label', 'Bed A')->firstOrFail();
        $bedLena->update(['status' => 'occupied']);
        $contractLena = Contract::create([
            'tenant_id' => $tenantLena->tenant_id,
            'bed_space_id' => $bedLena->bed_space_id,
            'created_by' => $adminUser->user_id,
            'move_in_date' => '2026-01-15',
            'deposit_amount' => 2600.00,
            'monthly_rate' => 2600.00,
            'status' => 'active',
        ]);
        $lenaStart = Carbon::create(2026, 1, 1)->startOfMonth();
        $lenaEnd = Carbon::now()->startOfMonth();
        $lc = $lenaStart->copy();
        while ($lc->lte($lenaEnd)) {
            $this->seedPaidBillingMonth(
                $contractLena,
                $lc->copy(),
                2600.00,
                $staffUser->user_id,
                $lc->month % 2 === 0 ? 'gcash' : 'other',
                []
            );
            $lc->addMonth();
        }

        // 6) Completed lease — bed returned to vacant.
        $tenantClarissa = Tenant::create([
            'first_name' => 'Clarissa Anne',
            'last_name' => 'Ocampo',
            'contact_number' => '09339998888',
            'email' => 'clarissa.ocampo@example.ph',
            'address' => 'Taytay, Rizal',
            'emergency_contact_name' => 'Benjamin Ocampo',
            'emergency_contact_number' => '09330004444',
            'status' => 'moved_out',
        ]);
        $bedClarissa = $sharedFour->bedSpaces()->where('bed_label', 'Bed B')->firstOrFail();
        $bedClarissa->update(['status' => 'occupied']);
        $contractClarissa = Contract::create([
            'tenant_id' => $tenantClarissa->tenant_id,
            'bed_space_id' => $bedClarissa->bed_space_id,
            'created_by' => $adminUser->user_id,
            'move_in_date' => '2025-01-01',
            'actual_move_out_date' => '2025-05-30',
            'deposit_amount' => 4500.00,
            'monthly_rate' => 4500.00,
            'status' => 'completed',
        ]);
        for ($m = 1; $m <= 5; $m++) {
            $dt = Carbon::create(2025, $m, 1)->startOfMonth();
            $this->seedPaidBillingMonth(
                $contractClarissa,
                $dt,
                4500.00,
                $adminUser->user_id,
                'cash',
                []
            );
        }
        $bedClarissa->update(['status' => 'vacant']);

        // 7) Archived inquiry — no contract.
        Tenant::create([
            'first_name' => 'Leandro',
            'last_name' => 'Cruz',
            'contact_number' => '09440001111',
            'email' => 'leandro.cruz@example.ph',
            'address' => 'Basco, Batanes',
            'emergency_contact_name' => 'Marina Cruz',
            'emergency_contact_number' => '09440005555',
            'status' => 'archived',
        ]);

        // Reconcile room roll‑ups (available vs unavailable vs maintenance).
        foreach ([$sharedFour, $sharedTwin, $soloStandard, $soloPremium, $maintenanceRoom] as $room) {
            RoomService::syncStatusAndCapacity($room);
        }
    }

    /**
     * @param  list<array{item_type: string, item_description?: string, amount: float|string}>  $extraLineItems
     */
    private function seedPaidBillingMonth(
        Contract $contract,
        Carbon $monthStart,
        float $baseRent,
        int $processedByUserId,
        string $paymentMethod,
        array $extraLineItems = []
    ): void {
        $from = $monthStart->copy()->startOfMonth();
        $to = $from->copy()->endOfMonth();
        $bill = Billing::create([
            'contract_id' => $contract->contract_id,
            'billing_period_from' => $from->toDateString(),
            'billing_period_to' => $to->toDateString(),
            'due_date' => $from->copy()->addDays(5)->toDateString(),
            'status' => 'paid',
        ]);
        BillingLineItem::create([
            'billing_id' => $bill->billing_id,
            'item_type' => 'base_rent',
            'amount' => $baseRent,
        ]);
        foreach ($extraLineItems as $row) {
            BillingLineItem::create(array_merge(['billing_id' => $bill->billing_id], $row));
        }
        $totalDue = $baseRent + array_sum(array_column($extraLineItems, 'amount'));
        $ref = match ($paymentMethod) {
            'gcash' => 'GC-'.$from->format('Ym').'-'.random_int(100000, 999999),
            'bank_transfer' => 'BTR-'.$from->format('Ym').'-'.random_int(100000, 999999),
            default => 'REF-'.$from->format('Ym').'-'.random_int(100000, 999999),
        };
        Payment::create([
            'billing_id' => $bill->billing_id,
            'processed_by' => $processedByUserId,
            'amount_paid' => $totalDue,
            'payment_date' => $from->copy()->addDays(2)->toDateString(),
            'payment_method' => $paymentMethod,
            'reference_number' => $ref,
        ]);
    }
}
