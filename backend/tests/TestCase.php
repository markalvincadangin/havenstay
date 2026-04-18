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
            'first_name' => 'John',
            'last_name' => 'Doe',
            'email' => 'test@example.com',
            'contact_number' => '+639000000000',
            'emergency_contact_name' => 'Test Emergency Contact',
            'emergency_contact_number' => '+639000000001',
            'address' => '123 Test Street, Quezon City',
        ], $overrides);
    }

    protected function roomAttributes(array $overrides = []): array
    {
        return array_merge([
            'room_code' => 'R101',
            'room_type' => 'shared',
            'monthly_rate' => 5000,
            'status' => 'active',
        ], $overrides);
    }

    protected function bedSpaceAttributes(array $overrides = []): array
    {
        return array_merge([
            'bed_label' => 'B1',
            'status' => 'vacant',
        ], $overrides);
    }

    protected function contractAttributes(array $overrides = []): array
    {
        return array_merge([
            'move_in_date' => now()->toDateString(),
            'monthly_rate_override' => null,
            'deposit_amount' => 5000,
            'status' => 'pending_payment',
        ], $overrides);
    }

    /**
     * Assert that an audit log exists, but only if the trigger is expected to run.
     * In SQLite test environments, triggers are skipped.
     */
    protected function assertTriggerAuditLog(array $data): void
    {
        if (DB::getDriverName() === 'mysql') {
            $userId = $data['user_id'] ?? null;
            $params = $data;
            unset($params['user_id']);
            if ($userId) {
                $params['changed_by'] = $userId;
            }
            $this->assertDatabaseHas('audit_logs', $params);
        } else {
            // In SQLite, we expect NO trigger audit logs
            // We just pass the test since triggers are verified in MySQL/Staging
            $this->assertTrue(true);
        }
    }
}
