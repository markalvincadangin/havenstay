<?php

namespace Tests\Feature;

use Tests\TestCase;

/**
 * Smoke test aligned with docs/API_REFERENCE.md (public GET /api/health).
 */
class ExampleTest extends TestCase
{
    public function test_health_endpoint_is_public_and_ok(): void
    {
        $this->getJson('/api/health')
            ->assertOk()
            ->assertJson([
                'status' => 'ok',
                'service' => 'havenstay-backend',
            ]);
    }
}
