<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;

class BillingPaymentArchitectureConventionTest extends TestCase
{
    private function backendPath(string $relative): string
    {
        return dirname(__DIR__, 2).DIRECTORY_SEPARATOR.$relative;
    }

    public function test_payment_controller_delegates_authorization_to_form_requests(): void
    {
        $controllerPath = $this->backendPath('app'.DIRECTORY_SEPARATOR.'Http'.DIRECTORY_SEPARATOR.'Controllers'.DIRECTORY_SEPARATOR.'Api'.DIRECTORY_SEPARATOR.'PaymentController.php');
        $this->assertFileExists($controllerPath);
        $controllerContent = (string) file_get_contents($controllerPath);

        // 1. PaymentController action methods typehint their respective Form Requests
        $this->assertStringContainsString('index(IndexPaymentRequest $request)', $controllerContent);
        $this->assertStringContainsString('show(ManagePaymentRequest $request', $controllerContent);
        $this->assertStringContainsString('store(StorePaymentRequest $request)', $controllerContent);
        $this->assertStringContainsString('StoreCompositePaymentRequest $request', $controllerContent);
        $this->assertStringContainsString('void(VoidPaymentRequest $request', $controllerContent);

        // 2. Each Payment Form Request delegates authorization to AuthorizationService
        $requests = [
            'IndexPaymentRequest.php' => 'AuthorizationService::ensureCanViewPayments',
            'ManagePaymentRequest.php' => 'AuthorizationService::ensureCanViewPayments',
            'StorePaymentRequest.php' => 'AuthorizationService::ensureCanManagePayments',
            'StoreCompositePaymentRequest.php' => 'AuthorizationService::ensureCanManagePayments',
            'VoidPaymentRequest.php' => 'AuthorizationService::ensureCanManagePayments',
        ];

        foreach ($requests as $file => $expectedAuthMethod) {
            $reqPath = $this->backendPath('app'.DIRECTORY_SEPARATOR.'Http'.DIRECTORY_SEPARATOR.'Requests'.DIRECTORY_SEPARATOR.'Payment'.DIRECTORY_SEPARATOR.$file);
            $this->assertFileExists($reqPath);
            $reqContent = (string) file_get_contents($reqPath);

            $this->assertStringContainsString('function authorize(): bool', $reqContent, "{$file} must define authorize().");
            $this->assertStringContainsString($expectedAuthMethod, $reqContent, "{$file} must invoke {$expectedAuthMethod}.");
        }

        // 3. PaymentController does not perform ad-hoc access-denied logging
        $this->assertStringNotContainsString('AuditService::logAccessDenied(', $controllerContent);
    }

    public function test_billing_controller_enforces_authorization_contract(): void
    {
        $controllerPath = $this->backendPath('app'.DIRECTORY_SEPARATOR.'Http'.DIRECTORY_SEPARATOR.'Controllers'.DIRECTORY_SEPARATOR.'Api'.DIRECTORY_SEPARATOR.'BillingController.php');
        $this->assertFileExists($controllerPath);
        $controllerContent = (string) file_get_contents($controllerPath);

        // 1. Form Request actions typehint their respective Form Requests
        $this->assertStringContainsString('index(IndexBillingRequest $request)', $controllerContent);
        $this->assertStringContainsString('store(StoreBillingRequest $request)', $controllerContent);
        $this->assertStringContainsString('updateStatus(UpdateBillingStatusRequest $request', $controllerContent);
        $this->assertStringContainsString('forecastUtility(UtilityForecastRequest $request)', $controllerContent);
        $this->assertStringContainsString('commitUtility(CommitUtilityBillingRequest $request)', $controllerContent);

        // 2. Each Billing Form Request delegates authorization to AuthorizationService
        $requests = [
            'IndexBillingRequest.php' => 'AuthorizationService::ensureCanViewBilling',
            'StoreBillingRequest.php' => 'AuthorizationService::ensureCanManageBilling',
            'UpdateBillingStatusRequest.php' => 'AuthorizationService::ensureCanManageBilling',
            'UtilityForecastRequest.php' => 'AuthorizationService::ensureCanManageBilling',
            'CommitUtilityBillingRequest.php' => 'AuthorizationService::ensureCanManageBilling',
        ];

        foreach ($requests as $file => $expectedAuthMethod) {
            $reqPath = $this->backendPath('app'.DIRECTORY_SEPARATOR.'Http'.DIRECTORY_SEPARATOR.'Requests'.DIRECTORY_SEPARATOR.'Billing'.DIRECTORY_SEPARATOR.$file);
            $this->assertFileExists($reqPath);
            $reqContent = (string) file_get_contents($reqPath);

            $this->assertStringContainsString('function authorize(): bool', $reqContent, "{$file} must define authorize().");
            $this->assertStringContainsString($expectedAuthMethod, $reqContent, "{$file} must invoke {$expectedAuthMethod}.");
        }

        // 3. Actions intentionally accepting base Request invoke AuthorizationService directly
        $this->assertStringContainsString('AuthorizationService::ensureCanViewBilling($request->user());', $controllerContent);
        $this->assertStringContainsString('AuthorizationService::ensureCanManageBilling($request->user());', $controllerContent);

        // 4. BillingController does not perform ad-hoc access-denied logging
        $this->assertStringNotContainsString('AuditService::logAccessDenied(', $controllerContent);
    }
}
