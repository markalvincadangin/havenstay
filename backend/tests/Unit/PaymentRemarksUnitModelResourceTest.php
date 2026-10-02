<?php

namespace Tests\Unit;

use App\Http\Resources\PaymentResource;
use App\Models\Payment;
use Illuminate\Http\Request;
use PHPUnit\Framework\TestCase;

/**
 * Asserts Payment model fillable configuration and PaymentResource
 * serialization for remarks and notes (HS-BL-01).
 */
class PaymentRemarksUnitModelResourceTest extends TestCase
{
    public function test_payment_model_fillable_contains_remarks(): void
    {
        $payment = new Payment();
        $this->assertContains(
            'remarks',
            $payment->getFillable(),
            'Payment model fillable array must include remarks.'
        );
    }

    public function test_payment_resource_maps_both_remarks_and_notes(): void
    {
        $payment = new Payment([
            'payment_id' => 101,
            'amount_paid' => 4500.00,
            'remarks' => 'Partial cash settlement for room 101',
        ]);

        $resource = new PaymentResource($payment);
        $array = $resource->toArray(Request::create('/api/payments/101', 'GET'));

        $this->assertArrayHasKey('remarks', $array);
        $this->assertArrayHasKey('notes', $array);
        $this->assertSame('Partial cash settlement for room 101', $array['remarks']);
        $this->assertSame('Partial cash settlement for room 101', $array['notes']);
    }

    public function test_payment_resource_handles_null_remarks(): void
    {
        $payment = new Payment([
            'payment_id' => 102,
            'amount_paid' => 1000.00,
            'remarks' => null,
        ]);

        $resource = new PaymentResource($payment);
        $array = $resource->toArray(Request::create('/api/payments/102', 'GET'));

        $this->assertArrayHasKey('remarks', $array);
        $this->assertArrayHasKey('notes', $array);
        $this->assertNull($array['remarks']);
        $this->assertNull($array['notes']);
    }
}
