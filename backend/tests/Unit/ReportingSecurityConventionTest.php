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

        $this->assertStringContainsString('AuthorizationService::ensureCanViewReports(', $content);
        $this->assertStringNotContainsString('$this->forbidden(', $content);
        $this->assertStringNotContainsString('$this->forbiddenExport(', $content);
    }

    public function test_admin_log_controllers_use_shared_authorization_trait(): void
    {
        $auditPath = $this->backendPath('app'.DIRECTORY_SEPARATOR.'Http'.DIRECTORY_SEPARATOR.'Controllers'.DIRECTORY_SEPARATOR.'Api'.DIRECTORY_SEPARATOR.'AuditLogController.php');

        $this->assertFileExists($auditPath);

        $audit = (string) file_get_contents($auditPath);

        $this->assertTrue(
            str_contains($audit, 'AuthorizationService::ensureCanViewReports(') ||
            str_contains($audit, 'AuthorizationService::ensureCanManageUsers(') ||
            str_contains($audit, 'AuthorizationService::ensureCanViewAuditLogs(')
        );
        $this->assertStringNotContainsString('$this->forbidden(', $audit);
        $this->assertStringNotContainsString('$this->forbiddenExport(', $audit);
    }
}
