<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;

/**
 * Asserts that the master migration's SQLite fallback table definitions
 * in 2026_04_09_092954_create_havenstay_master_schema.php match the required
 * schema columns for payments.remarks and users.avatar_url.
 */
class SQLiteSchemaMigrationParityTest extends TestCase
{
    private string $migrationContent;

    protected function setUp(): void
    {
        parent::setUp();

        $path = dirname(__DIR__, 2).DIRECTORY_SEPARATOR.'database'.DIRECTORY_SEPARATOR.'migrations'.DIRECTORY_SEPARATOR.'2026_04_09_092954_create_havenstay_master_schema.php';
        $this->assertFileExists($path, 'Master migration file must exist.');
        $this->migrationContent = (string) file_get_contents($path);
    }

    public function test_sqlite_fallback_payments_table_contains_remarks_column(): void
    {
        $this->assertMatchesRegularExpression(
            '/Schema::create\(\'payments\'[\s\S]*?\$table->string\(\'remarks\',\s*255\)->nullable\(\);[\s\S]*?\);/',
            $this->migrationContent,
            'SQLite fallback definition in create_havenstay_master_schema.php must define remarks VARCHAR(255) NULL on payments.'
        );
    }

    public function test_sqlite_fallback_users_table_contains_avatar_url_column(): void
    {
        $this->assertMatchesRegularExpression(
            '/Schema::create\(\'users\'[\s\S]*?\$table->text\(\'avatar_url\'\)->nullable\(\);[\s\S]*?\);/',
            $this->migrationContent,
            'SQLite fallback definition in create_havenstay_master_schema.php must define avatar_url TEXT NULL on users.'
        );
    }
}
