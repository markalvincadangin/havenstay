<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;

class ReportingSecurityConventionTest extends TestCase
{
    private function backendPath(string $relative): string
    {
        return dirname(__DIR__, 2).DIRECTORY_SEPARATOR.$relative;
    }

    public function test_report_controller_and_form_requests_enforce_authorization_contract(): void
    {
        $path = $this->backendPath('app'.DIRECTORY_SEPARATOR.'Http'.DIRECTORY_SEPARATOR.'Controllers'.DIRECTORY_SEPARATOR.'Api'.DIRECTORY_SEPARATOR.'ReportController.php');
        $this->assertFileExists($path);
        $content = (string) file_get_contents($path);

        // 1. Controller receives appropriate Form Requests
        $this->assertStringContainsString('ViewReportsRequest $request', $content);
        $this->assertStringContainsString('ExportReportsRequest $request', $content);

        // 2. Form Requests invoke AuthorizationService in authorize()
        $viewRequest = (string) file_get_contents($this->backendPath('app'.DIRECTORY_SEPARATOR.'Http'.DIRECTORY_SEPARATOR.'Requests'.DIRECTORY_SEPARATOR.'Report'.DIRECTORY_SEPARATOR.'ViewReportsRequest.php'));
        $this->assertStringContainsString('AuthorizationService::ensureCanViewReports(', $viewRequest);

        $exportRequest = (string) file_get_contents($this->backendPath('app'.DIRECTORY_SEPARATOR.'Http'.DIRECTORY_SEPARATOR.'Requests'.DIRECTORY_SEPARATOR.'Report'.DIRECTORY_SEPARATOR.'ExportReportsRequest.php'));
        $this->assertStringContainsString('AuthorizationService::ensureCanExportReports(', $exportRequest);

        // Negative assertion: No raw forbidden() helpers
        $this->assertStringNotContainsString('$this->forbidden(', $content);
        $this->assertStringNotContainsString('$this->forbiddenExport(', $content);
    }

    public function test_admin_log_controllers_and_form_requests_enforce_authorization_contract(): void
    {
        $auditPath = $this->backendPath('app'.DIRECTORY_SEPARATOR.'Http'.DIRECTORY_SEPARATOR.'Controllers'.DIRECTORY_SEPARATOR.'Api'.DIRECTORY_SEPARATOR.'AuditLogController.php');
        $this->assertFileExists($auditPath);
        $audit = (string) file_get_contents($auditPath);

        // 1. Controller receives appropriate Form Requests
        $this->assertStringContainsString('IndexAuditLogRequest $request', $audit);
        $this->assertStringContainsString('ExportAuditLogRequest $request', $audit);

        // 2. Form Requests invoke AuthorizationService in authorize()
        $indexRequest = (string) file_get_contents($this->backendPath('app'.DIRECTORY_SEPARATOR.'Http'.DIRECTORY_SEPARATOR.'Requests'.DIRECTORY_SEPARATOR.'AuditLog'.DIRECTORY_SEPARATOR.'IndexAuditLogRequest.php'));
        $this->assertStringContainsString('AuthorizationService::ensureCanViewAuditLogs(', $indexRequest);

        $exportRequest = (string) file_get_contents($this->backendPath('app'.DIRECTORY_SEPARATOR.'Http'.DIRECTORY_SEPARATOR.'Requests'.DIRECTORY_SEPARATOR.'AuditLog'.DIRECTORY_SEPARATOR.'ExportAuditLogRequest.php'));
        $this->assertStringContainsString('AuthorizationService::ensureCanViewAuditLogs(', $exportRequest);

        // Negative assertion: No raw forbidden() helpers
        $this->assertStringNotContainsString('$this->forbidden(', $audit);
        $this->assertStringNotContainsString('$this->forbiddenExport(', $audit);
    }
}
