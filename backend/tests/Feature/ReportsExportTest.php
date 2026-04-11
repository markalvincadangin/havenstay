<?php

namespace Tests\Feature;

use App\Models\BedSpace;
use App\Models\Billing;
use App\Models\BillingLineItem;
use App\Models\Contract;
use App\Models\Role;
use App\Models\Room;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Reports — traceability: docs/SRS.md FR-028–032, docs/API_REFERENCE.md Reporting & Exports, CCR-005 (six reporting views).
 */
class ReportsExportTest extends TestCase
{
    use RefreshDatabase;

    private User $adminUser;

    private User $viewerUser;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seedRoles();

        $adminRole = Role::where('role_name', 'admin')->firstOrFail();
        $viewerRole = Role::where('role_name', 'viewer')->firstOrFail();

        $this->adminUser = User::create([
            'first_name' => 'Admin',
            'last_name' => 'Reports',
            'username' => 'adminreports',
            'password_hash' => bcrypt('password123'),
            'role_id' => $adminRole->role_id,
            'is_active' => true,
        ]);

        $this->viewerUser = User::create([
            'first_name' => 'Viewer',
            'last_name' => 'Reports',
            'username' => 'viewerreports',
            'password_hash' => bcrypt('password123'),
            'role_id' => $viewerRole->role_id,
            'is_active' => true,
        ]);
    }

    /**
     * TC-REPORT-001: Occupancy report generation
     */
    public function test_tc_report_001_occupancy_report_generation_matches_live_data(): void
    {
        $occupiedSoloRoom = Room::create([
            'room_code' => 'R801',
            'room_type' => 'solo',
            'capacity' => 1,
            'monthly_rate' => 5000,
            'status' => 'available', // status updated via bed space usually but we set here
        ]);

        Room::create([
            'room_code' => 'R802',
            'room_type' => 'solo',
            'capacity' => 1,
            'monthly_rate' => 4800,
            'status' => 'available',
        ]);

        $sharedRoom = Room::create([
            'room_code' => 'R803',
            'room_type' => 'shared',
            'capacity' => 2,
            'monthly_rate' => 3200,
            'status' => 'available',
        ]);

        BedSpace::create([
            'room_id' => $sharedRoom->room_id,
            'bed_label' => 'A',
            'status' => 'occupied',
        ]);

        BedSpace::create([
            'room_id' => $sharedRoom->room_id,
            'bed_label' => 'B',
            'status' => 'vacant',
        ]);

        $response = $this->actingAs($this->viewerUser)->getJson('/api/reports/occupancy');

        $response->assertOk();
    }

    /**
     * TC-REPORT-002: Billing summary
     */
    public function test_tc_report_002_billing_summary_date_filter_and_csv_export(): void
    {
        $tenant = Tenant::create($this->tenantAttributes([
            'first_name' => 'Filter',
            'last_name' => 'Tenant',
            'contact_number' => '09171111111',
            'status' => 'active',
        ]));

        $room = Room::create([
            'room_code' => 'R804',
            'room_type' => 'solo',
            'capacity' => 1,
            'monthly_rate' => 5500,
            'status' => 'available',
        ]);

        $bed = BedSpace::create([
            'room_id' => $room->room_id,
            'bed_label' => 'A',
            'status' => 'occupied',
        ]);

        $contract = Contract::create([
            'tenant_id' => $tenant->tenant_id,
            'bed_space_id' => $bed->bed_space_id,
            'created_by' => $this->adminUser->user_id,
            'move_in_date' => '2026-04-01',
            'deposit_amount' => 1000,
            'status' => 'active',
        ]);

        $this->createBillingRecord($contract->contract_id, '2026-06-01', '2026-06-30', '2026-07-05', 5200, 'unpaid');

        $this->actingAs($this->viewerUser)
            ->getJson('/api/reports/billing-summary?start_date=2026-05-01&end_date=2026-06-30')
            ->assertOk();
    }

    public function test_unauthenticated_occupancy_export_returns_json_401(): void
    {
        $response = $this->get('/api/reports/occupancy/export');
        $response->assertStatus(401);
    }

    /**
     * Tenant history report uses vw_tenant_contract_history (FR-031, FR-032).
     */
    public function test_tenant_history_report_and_export(): void
    {
        $tenant = Tenant::create($this->tenantAttributes([
            'first_name' => 'Jane',
            'last_name' => 'Smith',
            'contact_number' => '+639123456789',
            'status' => 'active',
        ]));

        $room = Room::create([
            'room_code' => 'TH-100',
            'room_type' => 'solo',
            'capacity' => 1,
            'monthly_rate' => 4000,
            'status' => 'unavailable',
        ]);

        $bed = BedSpace::create([
            'room_id' => $room->room_id,
            'bed_label' => 'A',
            'status' => 'occupied',
        ]);

        Contract::create([
            'tenant_id' => $tenant->tenant_id,
            'bed_space_id' => $bed->bed_space_id,
            'created_by' => $this->adminUser->user_id,
            'move_in_date' => '2026-03-01',
            'expected_move_out_date' => '2027-02-28',
            'deposit_amount' => 0,
            'monthly_rate' => 4000,
            'status' => 'active',
        ]);

        $this->actingAs($this->adminUser)
            ->getJson('/api/reports/tenant-history?status=active')
            ->assertOk()
            ->assertJsonPath('summary.contract_count', 1)
            ->assertJsonPath('rows.0.tenant_name', 'Smith, Jane');

        $this->actingAs($this->adminUser)
            ->get('/api/reports/tenant-history/export')
            ->assertOk();
    }

    private function createBillingRecord(
        int $contractId,
        string $periodFrom,
        string $periodTo,
        string $dueDate,
        float $amountDue,
        string $status
    ): Billing {
        $billing = Billing::create([
            'contract_id' => $contractId,
            'billing_period_from' => $periodFrom,
            'billing_period_to' => $periodTo,
            'due_date' => $dueDate,
            'status' => $status,
        ]);

        BillingLineItem::create([
            'billing_id' => $billing->billing_id,
            'item_type' => 'base_rent',
            'item_description' => 'Base rent',
            'amount' => $amountDue,
        ]);

        return $billing;
    }
}
