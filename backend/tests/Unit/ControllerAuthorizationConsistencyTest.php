<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;

class ControllerAuthorizationConsistencyTest extends TestCase
{
    private function apiControllersDir(): string
    {
        return dirname(__DIR__, 2).DIRECTORY_SEPARATOR.'app'.DIRECTORY_SEPARATOR.'Http'.DIRECTORY_SEPARATOR.'Controllers'.DIRECTORY_SEPARATOR.'Api';
    }

    public function test_controllers_using_authorization_service_use_shared_trait(): void
    {
        $dir = $this->apiControllersDir();
        $this->assertDirectoryExists($dir);

        $controllerFiles = glob($dir.DIRECTORY_SEPARATOR.'*Controller.php') ?: [];
        $this->assertNotEmpty($controllerFiles, 'No API controllers found for consistency check.');

        foreach ($controllerFiles as $path) {
            $content = (string) file_get_contents($path);

            if (! str_contains($content, 'AuthorizationService::can')) {
                continue;
            }

            $this->assertStringContainsString(
                'use HandlesAuthorization;',
                $content,
                basename($path).' should use shared authorization trait.'
            );

            $this->assertStringNotContainsString(
                'AuditService::logAccessDenied(',
                $content,
                basename($path).' should use trait helpers instead of direct access-denied logging.'
            );
        }
    }
}

