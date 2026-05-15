<?php

namespace Tests\Feature;

use App\Models\Meter;
use App\Models\User;
use App\Services\Operations\MeterService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

/**
 * MetrologyForensicTest
 *
 * Demonstrates CCR-008 (Audit Triggers) and Forensic Business Rules (Monotonicity).
 */
class MetrologyForensicTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;

    protected Meter $meter;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRoles();

        // Setup basic actors and assets
        $this->admin = User::factory()->create(['role_id' => 1]); // Admin

        $utility = DB::table('utilities')->insertGetId([
            'name' => 'Electricity',
            'unit_of_measurement' => 'kWh',
        ]);

        $this->meter = Meter::create([
            'utility_id' => $utility,
            'serial_number' => 'MTR-TEST-001',
            'status' => 'active',
        ]);
    }

    public function test_meter_reading_monotonicity_rule(): void
    {
        // 1. Record an initial reading
        MeterService::recordReading($this->admin, $this->meter->meter_id, [
            'reading_date' => '2026-01-01',
            'reading_value' => 100.00,
            'is_rollover' => false,
        ]);

        // 2. Attempt to record a lower reading without rollover flag
        $this->expectException(ValidationException::class);
        $this->expectExceptionMessage('Validation Error');

        MeterService::recordReading($this->admin, $this->meter->meter_id, [
            'reading_date' => '2026-01-02',
            'reading_value' => 90.00, // Invalid: Lower than 100
            'is_rollover' => false,
        ]);
    }

    public function test_meter_reading_allows_rollover(): void
    {
        // 1. Record an initial reading
        MeterService::recordReading($this->admin, $this->meter->meter_id, [
            'reading_date' => '2026-01-01',
            'reading_value' => 999.00,
            'is_rollover' => false,
        ]);

        // 2. Record a lower reading WITH rollover flag (e.g. meter reset)
        $reading = MeterService::recordReading($this->admin, $this->meter->meter_id, [
            'reading_date' => '2026-01-02',
            'reading_value' => 5.00,
            'is_rollover' => true,
        ]);

        $this->assertEquals(5.00, $reading->reading_value);
        $this->assertTrue((bool) $reading->is_rollover);
    }

    public function test_audit_logs_capture_meter_reading_insertion(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            $this->markTestSkipped('Trigger-based audit logging requires MySQL.');
        }

        // Set session vars for trigger context using the new engine
        \App\Services\Core\AuditService::setFullForensicContext(
            $this->admin->user_id,
            'test_correlation',
            'test_request',
            'test_endpoint',
            'TEST'
        );

        MeterService::recordReading($this->admin, $this->meter->meter_id, [
            'reading_date' => '2026-01-01',
            'reading_value' => 123.45,
            'is_rollover' => false,
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'target_table' => 'meter_readings',
            'action' => 'CREATE', // Trigger uses 'CREATE' for inserts
            'changed_by' => $this->admin->user_id,
        ]);
    }
}
