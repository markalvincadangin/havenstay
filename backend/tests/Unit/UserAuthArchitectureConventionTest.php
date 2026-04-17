<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;

class UserAuthArchitectureConventionTest extends TestCase
{
    private function backendPath(string $relative): string
    {
        return dirname(__DIR__, 2).DIRECTORY_SEPARATOR.$relative;
    }

    public function test_user_controller_delegates_persistence_to_service_layer(): void
    {
        $path = $this->backendPath('app'.DIRECTORY_SEPARATOR.'Http'.DIRECTORY_SEPARATOR.'Controllers'.DIRECTORY_SEPARATOR.'Api'.DIRECTORY_SEPARATOR.'UserController.php');
        $this->assertFileExists($path);
        $content = (string) file_get_contents($path);

        $this->assertStringContainsString('UserService::create(', $content);
        $this->assertStringContainsString('UserService::update(', $content);
        $this->assertStringContainsString('UserService::archive(', $content);
        $this->assertStringNotContainsString('User::create(', $content);
        $this->assertStringNotContainsString('->delete();', $content);
    }

    public function test_auth_controller_delegates_auth_flow_to_auth_service(): void
    {
        $path = $this->backendPath('app'.DIRECTORY_SEPARATOR.'Http'.DIRECTORY_SEPARATOR.'Controllers'.DIRECTORY_SEPARATOR.'Api'.DIRECTORY_SEPARATOR.'AuthController.php');
        $this->assertFileExists($path);
        $content = (string) file_get_contents($path);

        $this->assertStringContainsString('AuthService::login(', $content);
        $this->assertStringContainsString('AuthService::logout(', $content);
        $this->assertStringNotContainsString('Auth::attempt(', $content);
    }
}

