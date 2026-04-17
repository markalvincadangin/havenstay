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
        $path = $this->backendPath('app'.DIRECTORY_SEPARATOR.'Services'.DIRECTORY_SEPARATOR.'TenantService.php');
        $this->assertFileExists($path);
        $content = (string) file_get_contents($path);

        $this->assertMatchesRegularExpression('/public static function create\(User \$actor, array \$data\): Tenant/', $content);
        $this->assertMatchesRegularExpression('/public static function update\(User \$actor, Tenant \$tenant, array \$data\): Tenant/', $content);
        $this->assertMatchesRegularExpression('/public static function reactivate\(User \$actor, Tenant \$tenant\): Tenant/', $content);
        $this->assertMatchesRegularExpression('/public static function archive\(User \$actor, Tenant \$tenant\): Tenant/', $content);
        $this->assertMatchesRegularExpression('/public static function restore\(User \$actor, int \$tenantId\): Tenant/', $content);
    }

    public function test_tenant_service_does_not_depend_on_auth_facade(): void
    {
        $path = $this->backendPath('app'.DIRECTORY_SEPARATOR.'Services'.DIRECTORY_SEPARATOR.'TenantService.php');
        $this->assertFileExists($path);
        $content = (string) file_get_contents($path);

        $this->assertStringNotContainsString('Auth::id(', $content);
        $this->assertStringNotContainsString('Auth::user(', $content);
    }
}

