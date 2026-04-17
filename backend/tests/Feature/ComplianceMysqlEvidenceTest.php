<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * Compliance scaffolding — CCR-007 (transaction_logs), CCR-008 (audit_logs).
 *
 * Portable checks run on SQLite CI. MySQL-only checks skip unless `DB_CONNECTION=mysql`.
 * Run full suite on MySQL: `composer test:mysql` (see phpunit.mysql.xml).
 */
class ComplianceMysqlEvidenceTest extends TestCase
{
    use RefreshDatabase;

    public function test_schema_includes_transaction_logs_table(): void
    {
        $this->assertTrue(Schema::hasTable('transaction_logs'));
    }

    public function test_schema_includes_audit_logs_table(): void
    {
        $this->assertTrue(Schema::hasTable('audit_logs'));
    }

    public function test_mysql_supports_current_user_id_session_variable(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            $this->markTestSkipped('SET @current_user_id requires MySQL (triggers read session vars per SDD §5.4).');
        }

        DB::statement('SET @current_user_id = ?', [1]);
        $row = DB::selectOne('SELECT @current_user_id AS v');

        $this->assertSame(1, (int) $row->v);
    }

    public function test_mysql_reports_server_version(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            $this->markTestSkipped('MySQL-only assertion.');
        }

        $row = DB::selectOne('SELECT VERSION() AS v');

        $this->assertIsString($row->v);
        $this->assertStringContainsString('.', $row->v);
    }

    public function test_core_tables_use_innodb_when_mysql(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            $this->markTestSkipped('information_schema.TABLES check requires MySQL.');
        }

        $db = DB::getDatabaseName();

        foreach (['contracts', 'billing', 'payments', 'audit_logs'] as $table) {
            $engine = DB::selectOne(
                'SELECT ENGINE AS e FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?',
                [$db, $table]
            );
            $this->assertNotNull($engine, "Table {$table} should exist on MySQL test DB.");
            $this->assertSame('InnoDB', $engine->e, "Table {$table} should use InnoDB (schema / CCR).");
        }
    }
}
