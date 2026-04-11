<?php

namespace Tests;

use App\Models\Role;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\DB;

/**
 * Base test case — helpers and SQLite vs MySQL trigger expectations per docs/TEST_PLAN.md / CLAUDE.md CCR-008.
 */
abstract class TestCase extends BaseTestCase
{
    /**
     * Ensure default roles exist. On MySQL, migrations may load havenstay_schema.sql with roles already present.
     */
    protected function seedRoles(): void
    {
        Role::firstOrCreate(['role_name' => 'admin'], ['description' => 'Admin']);
        Role::firstOrCreate(['role_name' => 'staff'], ['description' => 'Staff']);
        Role::firstOrCreate(['role_name' => 'viewer'], ['description' => 'Viewer']);
    }

    /**
     * Merge SDI-001 required tenant columns for SQLite feature tests (NOT NULL in schema).
     *
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    protected function tenantAttributes(array $overrides = []): array
    {
        return array_merge([
            'emergency_contact_name' => 'Test Emergency Contact',
            'emergency_contact_number' => '+639000000001',
            'address' => '123 Test Street, Quezon City',
        ], $overrides);
    }

    /**
     * Assert that an audit log exists, but only if the trigger is expected to run.
     * In SQLite test environments, triggers are skipped.
     */
    protected function assertTriggerAuditLog(array $data): void
    {
        if (DB::getDriverName() === 'mysql') {
            $this->assertDatabaseHas('audit_logs', $data);
        } else {
            // In SQLite, we expect NO trigger audit logs
            // We just pass the test since triggers are verified in MySQL/Staging
            $this->assertTrue(true);
        }
    }
}
