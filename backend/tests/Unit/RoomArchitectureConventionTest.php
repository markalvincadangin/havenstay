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

    public function test_room_controller_and_form_requests_enforce_authorization_contract(): void
    {
        $path = $this->backendPath('app'.DIRECTORY_SEPARATOR.'Http'.DIRECTORY_SEPARATOR.'Controllers'.DIRECTORY_SEPARATOR.'Api'.DIRECTORY_SEPARATOR.'RoomController.php');
        $this->assertFileExists($path);
        $content = (string) file_get_contents($path);

        // 1. Controller receives appropriate Form Requests
        $this->assertStringContainsString('IndexRoomRequest $request', $content);
        $this->assertStringContainsString('StoreRoomRequest $request', $content);
        $this->assertStringContainsString('ViewRoomRequest $request', $content);
        $this->assertStringContainsString('UpdateRoomRequest $request', $content);
        $this->assertStringContainsString('ManageRoomRequest $request', $content);
        $this->assertStringContainsString('AddBedSpaceRequest $request', $content);
        $this->assertStringContainsString('OccupyBedSpaceRequest $request', $content);

        // 2. Form Requests invoke AuthorizationService in authorize()
        $viewRequest = (string) file_get_contents($this->backendPath('app'.DIRECTORY_SEPARATOR.'Http'.DIRECTORY_SEPARATOR.'Requests'.DIRECTORY_SEPARATOR.'Room'.DIRECTORY_SEPARATOR.'ViewRoomRequest.php'));
        $this->assertStringContainsString('AuthorizationService::ensureCanViewRooms(', $viewRequest);

        $indexRequest = (string) file_get_contents($this->backendPath('app'.DIRECTORY_SEPARATOR.'Http'.DIRECTORY_SEPARATOR.'Requests'.DIRECTORY_SEPARATOR.'Room'.DIRECTORY_SEPARATOR.'IndexRoomRequest.php'));
        $this->assertStringContainsString('AuthorizationService::ensureCanViewRooms(', $indexRequest);

        $manageRequest = (string) file_get_contents($this->backendPath('app'.DIRECTORY_SEPARATOR.'Http'.DIRECTORY_SEPARATOR.'Requests'.DIRECTORY_SEPARATOR.'Room'.DIRECTORY_SEPARATOR.'ManageRoomRequest.php'));
        $this->assertStringContainsString('AuthorizationService::ensureCanManageRooms(', $manageRequest);

        $storeRequest = (string) file_get_contents($this->backendPath('app'.DIRECTORY_SEPARATOR.'Http'.DIRECTORY_SEPARATOR.'Requests'.DIRECTORY_SEPARATOR.'Room'.DIRECTORY_SEPARATOR.'StoreRoomRequest.php'));
        $this->assertStringContainsString('AuthorizationService::ensureCanManageRooms(', $storeRequest);

        // Negative assertion: No direct forbidden() calls in controller
        $this->assertStringNotContainsString('$this->forbidden(', $content);
    }
}
