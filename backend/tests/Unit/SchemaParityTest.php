<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;

/**
 * Asserts raw byte-for-byte identity between the canonical reference DDL
 * (db/havenstay_schema.sql) and the deployment/runtime DDL
 * (backend/database/sql/havenstay_schema.sql).
 *
 * This test guarantees zero drift across line endings, column widths,
 * trigger logic, and constraint definitions without whitespace normalization.
 */
class SchemaParityTest extends TestCase
{
    public function test_canonical_schema_files_are_byte_for_byte_identical(): void
    {
        $rootPath = dirname(__DIR__, 3).DIRECTORY_SEPARATOR.'db'.DIRECTORY_SEPARATOR.'havenstay_schema.sql';
        $backendPath = dirname(__DIR__, 2).DIRECTORY_SEPARATOR.'database'.DIRECTORY_SEPARATOR.'sql'.DIRECTORY_SEPARATOR.'havenstay_schema.sql';

        $this->assertFileExists($rootPath, 'Canonical reference DDL db/havenstay_schema.sql must exist.');
        $this->assertFileExists($backendPath, 'Runtime deployment DDL backend/database/sql/havenstay_schema.sql must exist.');

        $rootBytes = (string) file_get_contents($rootPath);
        $backendBytes = (string) file_get_contents($backendPath);

        // Strict unnormalized byte-for-byte identity check
        $this->assertSame(
            $backendBytes,
            $rootBytes,
            'db/havenstay_schema.sql and backend/database/sql/havenstay_schema.sql must be byte-for-byte identical raw files.'
        );
    }
}
