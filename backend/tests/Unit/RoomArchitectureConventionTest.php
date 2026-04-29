<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;

class RoomArchitectureConventionTest extends TestCase
{
    private function backendPath(string $relative): string
    {
        return dirname(__DIR__, 2).DIRECTORY_SEPARATOR.$relative;
    }

    public function test_room_service_does_not_depend_on_auth_facade(): void
    {
        $path = $this->backendPath('app'.DIRECTORY_SEPARATOR.'Services'.DIRECTORY_SEPARATOR.'Operations'.DIRECTORY_SEPARATOR.'RoomService.php');
        $this->assertFileExists($path);
        $content = (string) file_get_contents($path);

        $this->assertStringNotContainsString('Auth::id(', $content);
        $this->assertStringNotContainsString('Auth::user(', $content);
        $this->assertStringNotContainsString('Auth::check(', $content);
    }

    public function test_room_controller_uses_authorization_helper_trait(): void
    {
        $path = $this->backendPath('app'.DIRECTORY_SEPARATOR.'Http'.DIRECTORY_SEPARATOR.'Controllers'.DIRECTORY_SEPARATOR.'Api'.DIRECTORY_SEPARATOR.'RoomController.php');
        $this->assertFileExists($path);
        $content = (string) file_get_contents($path);

        $this->assertStringContainsString('AuthorizationService::ensureCanViewReports(', $content);
        $this->assertStringContainsString('AuthorizationService::ensureCanManageRooms(', $content);
        $this->assertStringNotContainsString('$this->forbidden(', $content);
    }
}
