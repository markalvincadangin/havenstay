<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;

class ContractArchitectureConventionTest extends TestCase
{
    private function backendPath(string $relative): string
    {
        return dirname(__DIR__, 2).DIRECTORY_SEPARATOR.$relative;
    }

    public function test_contract_controller_enforces_authorization_contract(): void
    {
        $controllerPath = $this->backendPath('app'.DIRECTORY_SEPARATOR.'Http'.DIRECTORY_SEPARATOR.'Controllers'.DIRECTORY_SEPARATOR.'Api'.DIRECTORY_SEPARATOR.'ContractController.php');
        $this->assertFileExists($controllerPath);
        $controllerContent = (string) file_get_contents($controllerPath);

        // 1. Actions using Form Requests typehint the expected request classes
        $this->assertStringContainsString('index(IndexContractRequest $request)', $controllerContent);
        $this->assertStringContainsString('store(StoreContractRequest $request)', $controllerContent);
        $this->assertStringContainsString('update(UpdateContractRequest $request', $controllerContent);
        $this->assertStringContainsString('moveOut(MoveOutRequest $request', $controllerContent);
        $this->assertStringContainsString('activate(ManageContractRequest $request', $controllerContent);
        $this->assertStringContainsString('void(ManageContractRequest $request', $controllerContent);
        $this->assertStringContainsString('archive(ManageContractRequest $request', $controllerContent);
        $this->assertStringContainsString('restore(ManageContractRequest $request', $controllerContent);

        // 2. Each Contract Form Request implements authorize() and delegates to AuthorizationService
        $requests = [
            'IndexContractRequest.php' => 'AuthorizationService::ensureCanViewContracts',
            'StoreContractRequest.php' => 'AuthorizationService::ensureCanManageContracts',
            'UpdateContractRequest.php' => 'AuthorizationService::ensureCanManageContracts',
            'MoveOutRequest.php' => 'AuthorizationService::ensureCanManageContracts',
            'ManageContractRequest.php' => 'AuthorizationService::ensureCanManageContracts',
        ];

        foreach ($requests as $file => $expectedAuthMethod) {
            $reqPath = $this->backendPath('app'.DIRECTORY_SEPARATOR.'Http'.DIRECTORY_SEPARATOR.'Requests'.DIRECTORY_SEPARATOR.'Contract'.DIRECTORY_SEPARATOR.$file);
            $this->assertFileExists($reqPath);
            $reqContent = (string) file_get_contents($reqPath);

            $this->assertStringContainsString('function authorize(): bool', $reqContent, "{$file} must define authorize().");
            $this->assertStringContainsString($expectedAuthMethod, $reqContent, "{$file} must invoke {$expectedAuthMethod}.");
        }

        // 3. Actions intentionally accepting base Request invoke AuthorizationService directly
        $this->assertStringContainsString('show(Request $request, int $id)', $controllerContent);
        $this->assertStringContainsString('AuthorizationService::ensureCanViewContracts($request->user());', $controllerContent);

        // 4. ContractController does not perform ad-hoc access-denied logging
        $this->assertStringNotContainsString('AuditService::logAccessDenied(', $controllerContent);
    }

    public function test_contract_service_uses_actor_for_bed_occupancy_transition(): void
    {
        $path = $this->backendPath('app'.DIRECTORY_SEPARATOR.'Services'.DIRECTORY_SEPARATOR.'Operations'.DIRECTORY_SEPARATOR.'ContractService.php');
        $this->assertFileExists($path);
        $content = (string) file_get_contents($path);

        $this->assertStringContainsString('RoomService::occupyBedSpace($actor, $bedSpace);', $content);
    }
}
