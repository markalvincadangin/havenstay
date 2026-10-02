<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;

class TenantArchitectureConventionTest extends TestCase
{
    private function backendPath(string $relative): string
    {
        return dirname(__DIR__, 2).DIRECTORY_SEPARATOR.$relative;
    }

    public function test_tenant_controller_does_not_use_direct_tenant_model_calls(): void
    {
        $path = $this->backendPath('app'.DIRECTORY_SEPARATOR.'Http'.DIRECTORY_SEPARATOR.'Controllers'.DIRECTORY_SEPARATOR.'Api'.DIRECTORY_SEPARATOR.'TenantController.php');
        $this->assertFileExists($path);
        $content = (string) file_get_contents($path);

        // Enforce service-owned data access for tenant retrieval and writes.
        $this->assertStringNotContainsString('Tenant::', $content, 'TenantController should delegate Tenant model access to TenantService.');
    }

    public function test_tenant_service_write_methods_use_actor_first_signature(): void
    {
        $path = $this->backendPath('app'.DIRECTORY_SEPARATOR.'Services'.DIRECTORY_SEPARATOR.'Operations'.DIRECTORY_SEPARATOR.'TenantService.php');
        $this->assertFileExists($path);
        $content = (string) file_get_contents($path);

        $this->assertMatchesRegularExpression('/public static function create\(User \$actor, array \$data\): Tenant/', $content);
        $this->assertMatchesRegularExpression('/public static function update\(User \$actor, Tenant \$tenant, array \$data\): Tenant/', $content);
        $this->assertMatchesRegularExpression('/public static function archive\(User \$actor, Tenant \$tenant\): Tenant/', $content);
        $this->assertMatchesRegularExpression('/public static function restore\(User \$actor, int \$id\): Tenant/', $content);

        // Guard against reintroducing obsolete reactivate method (ADR-004)
        $this->assertFalse(
            method_exists(\App\Services\Operations\TenantService::class, 'reactivate'),
            'TenantService must not define obsolete reactivate method.'
        );
    }

    public function test_tenant_controller_and_form_requests_enforce_authorization_contract(): void
    {
        $controllerPath = $this->backendPath('app'.DIRECTORY_SEPARATOR.'Http'.DIRECTORY_SEPARATOR.'Controllers'.DIRECTORY_SEPARATOR.'Api'.DIRECTORY_SEPARATOR.'TenantController.php');
        $this->assertFileExists($controllerPath);
        $controllerContent = (string) file_get_contents($controllerPath);

        // 1. Controller receives appropriate Form Requests
        $this->assertStringContainsString('IndexTenantRequest $request', $controllerContent);
        $this->assertStringContainsString('ViewTenantRequest $request', $controllerContent);
        $this->assertStringContainsString('StoreTenantRequest $request', $controllerContent);
        $this->assertStringContainsString('UpdateTenantRequest $request', $controllerContent);
        $this->assertStringContainsString('ManageTenantRequest $request', $controllerContent);

        // 2. Form Requests invoke AuthorizationService in authorize()
        $viewRequest = (string) file_get_contents($this->backendPath('app'.DIRECTORY_SEPARATOR.'Http'.DIRECTORY_SEPARATOR.'Requests'.DIRECTORY_SEPARATOR.'Tenant'.DIRECTORY_SEPARATOR.'ViewTenantRequest.php'));
        $this->assertStringContainsString('AuthorizationService::ensureCanViewTenants(', $viewRequest);

        $manageRequest = (string) file_get_contents($this->backendPath('app'.DIRECTORY_SEPARATOR.'Http'.DIRECTORY_SEPARATOR.'Requests'.DIRECTORY_SEPARATOR.'Tenant'.DIRECTORY_SEPARATOR.'ManageTenantRequest.php'));
        $this->assertStringContainsString('AuthorizationService::ensureCanManageTenants(', $manageRequest);
    }

    public function test_tenant_service_does_not_depend_on_auth_facade(): void
    {
        $path = $this->backendPath('app'.DIRECTORY_SEPARATOR.'Services'.DIRECTORY_SEPARATOR.'Operations'.DIRECTORY_SEPARATOR.'TenantService.php');
        $this->assertFileExists($path);
        $content = (string) file_get_contents($path);

        $this->assertStringNotContainsString('Auth::id(', $content);
        $this->assertStringNotContainsString('Auth::user(', $content);
    }
}
