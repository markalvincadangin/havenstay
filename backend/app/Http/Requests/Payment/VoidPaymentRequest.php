<?php

namespace App\Http\Requests\Payment;

use App\Services\Identity\AuthorizationService;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Validates request to void an existing payment.
 */
class VoidPaymentRequest extends FormRequest
{
    /**
     * Authorized: Admin, Staff.
     */
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'void_reason' => ['nullable', 'string', 'max:255'],
        ];
    }
}
