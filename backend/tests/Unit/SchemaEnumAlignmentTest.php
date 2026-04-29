<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;

/**
 * Asserts Laravel `in:` validation lists match `db/havenstay_schema.sql` ENUM columns (API ↔ DB contract).
 *
 * Extends PHPUnit directly (no app bootstrap) — paths are resolved from `backend/tests/Unit`.
 */
class SchemaEnumAlignmentTest extends TestCase
{
    private static string $schemaSql;

    public static function setUpBeforeClass(): void
    {
        $path = dirname(__DIR__, 2).DIRECTORY_SEPARATOR.'database'.DIRECTORY_SEPARATOR.'sql'.DIRECTORY_SEPARATOR.'havenstay_schema.sql';
        self::assertFileExists($path, 'DDL mirror: backend/database/sql/havenstay_schema.sql (must match root db/havenstay_schema.sql)');
        self::$schemaSql = (string) file_get_contents($path);
    }

    private function backendPath(string $relative): string
    {
        return dirname(__DIR__, 2).DIRECTORY_SEPARATOR.$relative;
    }

    /**
     * @return list<string>
     */
    private function parseMysqlEnum(string $table, string $column): array
    {
        $this->assertMatchesRegularExpression(
            '/CREATE TABLE\s+'.$table.'\s*\(([\s\S]*?)\)\s*ENGINE/i',
            self::$schemaSql,
            "CREATE TABLE {$table}"
        );
        preg_match('/CREATE TABLE\s+'.$table.'\s*\(([\s\S]*?)\)\s*ENGINE/i', self::$schemaSql, $block);
        $inner = $block[1];
        $this->assertMatchesRegularExpression(
            '/\b'.$column.'\s+ENUM\s*\(([^)]+)\)/i',
            $inner,
            "ENUM {$table}.{$column}"
        );
        preg_match('/\b'.$column.'\s+ENUM\s*\(([^)]+)\)/i', $inner, $m);
        preg_match_all("/'([^']+)'/", $m[1], $vals);

        return $vals[1];
    }

    /**
     * @param  list<string>  $expectedSorted
     */
    private function assertFileInRuleMatches(string $relativePath, string $fieldPattern, array $expectedSorted): void
    {
        $path = $this->backendPath($relativePath);
        $this->assertFileExists($path);
        $content = (string) file_get_contents($path);
        $hasEnum = preg_match("/Rule::enum\(\w+::class\)/", $content);
        $hasInRule = preg_match($fieldPattern, $content, $m);

        $this->assertTrue(
            $hasInRule || $hasEnum,
            $relativePath.' validation vs schema (expected '.$fieldPattern.' or Rule::enum)'
        );

        if (empty($m)) {
            return;
        }

        $actual = explode(',', $m[1]);
        sort($actual);
        $this->assertSame($expectedSorted, $actual, $relativePath.' validation vs schema');
    }

    public function test_payment_method_matches_payments_table(): void
    {
        $expected = $this->parseMysqlEnum('payments', 'payment_method');
        sort($expected);
        $this->assertFileInRuleMatches(
            'app'.DIRECTORY_SEPARATOR.'Http'.DIRECTORY_SEPARATOR.'Requests'.DIRECTORY_SEPARATOR.'Payment'.DIRECTORY_SEPARATOR.'StorePaymentRequest.php',
            "/'payment_method'\s*=>\s*\[[^\]]*'in:([^']+)'/",
            $expected
        );
    }

    public function test_tenant_status_matches_tenants_table(): void
    {
        $expected = $this->parseMysqlEnum('tenants', 'status');
        sort($expected);
        $this->assertFileInRuleMatches(
            'app'.DIRECTORY_SEPARATOR.'Http'.DIRECTORY_SEPARATOR.'Requests'.DIRECTORY_SEPARATOR.'Tenant'.DIRECTORY_SEPARATOR.'IndexTenantRequest.php',
            "/'status'\s*=>\s*\[[^\]]*'in:([^']+)'/",
            $expected
        );
    }

    public function test_contract_status_matches_contracts_table(): void
    {
        $expected = $this->parseMysqlEnum('contracts', 'status');
        sort($expected);
        $this->assertFileInRuleMatches(
            'app'.DIRECTORY_SEPARATOR.'Http'.DIRECTORY_SEPARATOR.'Requests'.DIRECTORY_SEPARATOR.'Contract'.DIRECTORY_SEPARATOR.'UpdateContractRequest.php',
            "/'status'\s*=>\s*\[[^\]]*'in:([^']+)'/",
            $expected
        );
    }

    public function test_billing_line_item_type_matches_billing_line_items_table(): void
    {
        $expected = $this->parseMysqlEnum('billing_line_items', 'item_type');
        sort($expected);
        $this->assertFileInRuleMatches(
            'app'.DIRECTORY_SEPARATOR.'Http'.DIRECTORY_SEPARATOR.'Requests'.DIRECTORY_SEPARATOR.'Billing'.DIRECTORY_SEPARATOR.'StoreBillingRequest.php',
            "/'line_items\.\*\.item_type'\s*=>\s*\[[^\]]*'in:([^']+)'/",
            $expected
        );
    }

    public function test_audit_log_action_matches_audit_logs_table(): void
    {
        // audit_logs.action is VARCHAR(32) in schema, not ENUM.
        // We match against the set of actions allowed in the Controller validation.
        $schemaActions = ['INSERT', 'UPDATE', 'DELETE', 'login', 'logout', 'access_denied', 'status_change', 'archive', 'restore'];
        sort($schemaActions);

        $this->assertFileInRuleMatches(
            'app'.DIRECTORY_SEPARATOR.'Http'.DIRECTORY_SEPARATOR.'Requests'.DIRECTORY_SEPARATOR.'User'.DIRECTORY_SEPARATOR.'IndexAuditLogRequest.php',
            "/'action'\s*=>\s*\[[^\]]*'in:([^']+)'/",
            $schemaActions
        );
    }

    public function test_room_fields_match_schema(): void
    {
        $type = $this->parseMysqlEnum('rooms', 'room_type');
        sort($type);
        $status = $this->parseMysqlEnum('rooms', 'status');
        sort($status);
        $bed = $this->parseMysqlEnum('bed_spaces', 'status');
        sort($bed);

        $path = $this->backendPath('app'.DIRECTORY_SEPARATOR.'Http'.DIRECTORY_SEPARATOR.'Requests'.DIRECTORY_SEPARATOR.'Room'.DIRECTORY_SEPARATOR.'UpdateRoomRequest.php');
        $content = (string) file_get_contents($path);

        $hasType = preg_match("/'room_type'\s*=>\s*\[[^\]]*('in:([^']+)'|Rule::enum\(RoomType::class\))/", $content, $m);
        $this->assertTrue($hasType !== false && $hasType > 0);
        if (! empty($m[2])) {
            $a = explode(',', $m[2]);
            sort($a);
            $this->assertSame($type, $a);
        }

        $hasStatus = preg_match("/'status'\s*=>\s*\[[^\]]*('in:([^']+)'|Rule::enum\(RoomStatus::class\))/", $content, $m2);
        $this->assertTrue($hasStatus !== false && $hasStatus > 0);
        if (! empty($m2[2])) {
            $b = explode(',', $m2[2]);
            sort($b);
            $this->assertSame($status, $b);
        }

        $hasBed = preg_match("/'bed_spaces\.\*\.status'\s*=>\s*\[[^\]]*('in:([^']+)'|Rule::enum\(BedSpaceStatus::class\))/", $content, $m3);
        $this->assertTrue($hasBed !== false && $hasBed > 0);
        if (! empty($m3[2])) {
            $c = explode(',', $m3[2]);
            sort($c);
            $this->assertSame($bed, $c);
        }
    }
}
