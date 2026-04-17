<?php

namespace App\Http\Requests\Payment;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StorePaymentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $reference = $this->input('reference_number');
        $trimmed = is_string($reference) ? trim($reference) : '';

        $this->merge([
            'reference_number' => $trimmed === '' ? null : $trimmed,
        ]);
    }

    public function rules(): array
    {
        return [
            'billing_id' => ['required', 'integer'],
            'amount_paid' => ['required', 'numeric'],
            'payment_date' => ['required', 'date'],
            'payment_method' => ['sometimes', 'in:cash,gcash,bank_transfer,other'],
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
