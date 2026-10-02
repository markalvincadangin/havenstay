<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;

class ControllerAuthorizationConsistencyTest extends TestCase
{
    private function backendPath(string $relative): string
    {
        return dirname(__DIR__, 2).DIRECTORY_SEPARATOR.$relative;
    }

    private function apiControllersDir(): string
    {
        return $this->backendPath('app'.DIRECTORY_SEPARATOR.'Http'.DIRECTORY_SEPARATOR.'Controllers'.DIRECTORY_SEPARATOR.'Api');
    }

    public function test_controllers_do_not_implement_adhoc_access_denied_logging(): void
    {
        $dir = $this->apiControllersDir();
        $this->assertDirectoryExists($dir);

        $controllerFiles = glob($dir.DIRECTORY_SEPARATOR.'*Controller.php') ?: [];
        $this->assertNotEmpty($controllerFiles, 'No API controllers found for consistency check.');
        $this->assertGreaterThanOrEqual(12, count($controllerFiles), 'Expected at least 12 API controllers.');

        $inspectedCount = 0;
        foreach ($controllerFiles as $path) {
            $content = (string) file_get_contents($path);
            $filename = basename($path);

            $this->assertStringNotContainsString(
                'AuditService::logAccessDenied(',
                $content,
                "{$filename} should not log access denials directly; authorization is centralized."
            );

            $this->assertStringNotContainsString(
                'abort(403',
                $content,
                "{$filename} should not use raw abort(403); authorization exceptions are centralized."
            );

            $inspectedCount++;
        }

        $this->assertSame(count($controllerFiles), $inspectedCount, 'Every controller must be inspected.');
    }

    public function test_all_protected_form_requests_delegate_to_authorization_service(): void
    {
        $requestsDir = $this->backendPath('app'.DIRECTORY_SEPARATOR.'Http'.DIRECTORY_SEPARATOR.'Requests');
        $this->assertDirectoryExists($requestsDir);

        $requestFiles = glob($requestsDir.DIRECTORY_SEPARATOR.'*'.DIRECTORY_SEPARATOR.'*Request.php') ?: [];
        $this->assertNotEmpty($requestFiles, 'No Form Requests found for consistency check.');
        $this->assertGreaterThanOrEqual(40, count($requestFiles), 'Expected at least 40 Form Requests.');

        $inspectedCount = 0;
        foreach ($requestFiles as $path) {
            $filename = basename($path);

            // Public, unauthenticated request
            if ($filename === 'LoginRequest.php') {
                continue;
            }

            $content = (string) file_get_contents($path);

            $this->assertStringContainsString(
                'function authorize(): bool',
                $content,
                "{$filename} must implement authorize(): bool."
            );

            $this->assertStringContainsString(
                'AuthorizationService::ensureCan',
                $content,
                "{$filename} must delegate authorization to AuthorizationService::ensureCan*."
            );

            $inspectedCount++;
        }

        $this->assertGreaterThanOrEqual(45, $inspectedCount, 'Expected at least 45 protected Form Requests inspected.');
    }

    public function test_domain_controllers_centralize_authorization_via_form_requests_or_service(): void
    {
        $dir = $this->apiControllersDir();
        $this->assertDirectoryExists($dir);

        $controllerFiles = glob($dir.DIRECTORY_SEPARATOR.'*Controller.php') ?: [];
        $this->assertNotEmpty($controllerFiles);

        $domainControllersInspected = 0;
        foreach ($controllerFiles as $path) {
            $filename = basename($path);

            // OAuthController is a public external OAuth gateway
            if ($filename === 'OAuthController.php') {
                continue;
            }

            $content = (string) file_get_contents($path);

            // Every domain controller must typehint Form Requests for input and authorization
            $this->assertStringContainsString(
                'App\Http\Requests\\',
                $content,
                "{$filename} must utilize Form Requests for request validation and authorization."
            );

            // Residual controllers that directly authorize base Request must call AuthorizationService
            if (str_contains($content, 'AuthorizationService::ensureCan')) {
                $this->assertStringContainsString(
                    'use App\Services\Core\AuthorizationService;',
                    $content,
                    "{$filename} must import AuthorizationService when performing direct method-level authorization."
                );
            }

            $domainControllersInspected++;
        }

        $this->assertGreaterThanOrEqual(11, $domainControllersInspected, 'Expected at least 11 domain controllers inspected.');
    }
}
