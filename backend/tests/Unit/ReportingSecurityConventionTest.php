<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;

class ReportingSecurityConventionTest extends TestCase
{
    private function backendPath(string $relative): string
    {
        return dirname(__DIR__, 2).DIRECTORY_SEPARATOR.$relative;
    }

    public function test_report_controller_uses_shared_authorization_trait(): void
    {
        $path = $this->backendPath('app'.DIRECTORY_SEPARATOR.'Http'.DIRECTORY_SEPARATOR.'Controllers'.DIRECTORY_SEPARATOR.'Api'.DIRECTORY_SEPARATOR.'ReportController.php');
        $this->assertFileExists($path);
        $content = (string) file_get_contents($path);

        $this->assertStringContainsString('use HandlesAuthorization;', $content);
        $this->assertStringContainsString('$this->forbidden(', $content);
        $this->assertStringContainsString('$this->forbiddenExport(', $content);
    }

    public function test_admin_log_controllers_use_shared_authorization_trait(): void
    {
        $auditPath = $this->backendPath('app'.DIRECTORY_SEPARATOR.'Http'.DIRECTORY_SEPARATOR.'Controllers'.DIRECTORY_SEPARATOR.'Api'.DIRECTORY_SEPARATOR.'AuditLogController.php');
        $txPath = $this->backendPath('app'.DIRECTORY_SEPARATOR.'Http'.DIRECTORY_SEPARATOR.'Controllers'.DIRECTORY_SEPARATOR.'Api'.DIRECTORY_SEPARATOR.'TransactionController.php');

        $this->assertFileExists($auditPath);
        $this->assertFileExists($txPath);

        $audit = (string) file_get_contents($auditPath);
        $tx = (string) file_get_contents($txPath);

        $this->assertStringContainsString('use HandlesAuthorization;', $audit);
        $this->assertStringContainsString('$this->forbidden(', $audit);
        $this->assertStringContainsString('$this->forbiddenExport(', $audit);

        $this->assertStringContainsString('use HandlesAuthorization;', $tx);
        $this->assertStringContainsString('$this->forbidden(', $tx);
    }
}

