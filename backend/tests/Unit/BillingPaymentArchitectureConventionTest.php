<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;

class BillingPaymentArchitectureConventionTest extends TestCase
{
    private function backendPath(string $relative): string
    {
        return dirname(__DIR__, 2).DIRECTORY_SEPARATOR.$relative;
    }

    public function test_billing_controller_uses_shared_authorization_helper(): void
    {
        $path = $this->backendPath('app'.DIRECTORY_SEPARATOR.'Http'.DIRECTORY_SEPARATOR.'Controllers'.DIRECTORY_SEPARATOR.'Api'.DIRECTORY_SEPARATOR.'BillingController.php');
        $this->assertFileExists($path);
        $content = (string) file_get_contents($path);

        $this->assertStringContainsString('use HandlesAuthorization;', $content);
        $this->assertStringContainsString('$this->forbidden(', $content);
    }

    public function test_payment_controller_uses_shared_authorization_helper(): void
    {
        $path = $this->backendPath('app'.DIRECTORY_SEPARATOR.'Http'.DIRECTORY_SEPARATOR.'Controllers'.DIRECTORY_SEPARATOR.'Api'.DIRECTORY_SEPARATOR.'PaymentController.php');
        $this->assertFileExists($path);
        $content = (string) file_get_contents($path);

        $this->assertStringContainsString('use HandlesAuthorization;', $content);
        $this->assertStringContainsString('$this->forbidden(', $content);
    }
}

