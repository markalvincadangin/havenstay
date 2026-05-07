<?php

namespace App\Http\Requests\Payment;

use App\Enums\PaymentMethod;
use App\Services\Core\AuthorizationService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * StoreCompositePaymentRequest
 *
 * Validates data for recording a combined (Rent + Deposit) onboarding payment.
 */
class StoreCompositePaymentRequest extends FormRequest
{
    public function authorize(): bool
    {
        AuthorizationService::ensureCanManagePayments($this->user());

        return true;
    }

    public function rules(): array
    {
        return [
            'billing_id' => ['required', 'integer', 'exists:billing,billing_id'],
            'contract_id' => ['required', 'integer', 'exists:contracts,contract_id'],
            'rent_amount' => ['required', 'numeric', 'min:0'],
            'deposit_amount' => ['required', 'numeric', 'min:0'],
            'payment_date' => ['required', 'date', 'before_or_equal:today'],
            'payment_method' => ['required', Rule::enum(PaymentMethod::class)],
            'reference_number' => [
                'nullable',
                'string',
                'max:100',
                Rule::requiredIf(fn () => $this->input('payment_method', 'cash') !== 'cash'),
            ],
            'remarks' => ['nullable', 'string'],
        ];
    }
}
