<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;

class ContractArchitectureConventionTest extends TestCase
{
    private function backendPath(string $relative): string
    {
        return dirname(__DIR__, 2).DIRECTORY_SEPARATOR.$relative;
    }

    public function test_contract_controller_uses_authorization_helper_trait(): void
    {
        $path = $this->backendPath('app'.DIRECTORY_SEPARATOR.'Http'.DIRECTORY_SEPARATOR.'Controllers'.DIRECTORY_SEPARATOR.'Api'.DIRECTORY_SEPARATOR.'ContractController.php');
        $this->assertFileExists($path);
        $content = (string) file_get_contents($path);

        $this->assertStringContainsString('use App\Services\Core\AuthorizationService;', $content);
        $this->assertStringContainsString('AuthorizationService::ensureCan', $content);
    }

    public function test_contract_service_uses_actor_for_bed_occupancy_transition(): void
    {
        $path = $this->backendPath('app'.DIRECTORY_SEPARATOR.'Services'.DIRECTORY_SEPARATOR.'Operations'.DIRECTORY_SEPARATOR.'ContractService.php');
        $this->assertFileExists($path);
        $content = (string) file_get_contents($path);

        $this->assertStringContainsString('RoomService::occupyBedSpace($actor, $bedSpace);', $content);
    }
}

