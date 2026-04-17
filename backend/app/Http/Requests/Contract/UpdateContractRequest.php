<?php

namespace App\Http\Requests\Contract;

use Illuminate\Foundation\Http\FormRequest;

class UpdateContractRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'expected_move_out' => ['sometimes', 'nullable', 'date'],
            'actual_move_out' => ['sometimes', 'nullable', 'date'],
            'deposit_amount' => ['sometimes', 'numeric', 'min:0'],
            'monthly_rate_override' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'monthly_rate' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'status' => ['sometimes', 'in:active,completed,terminated'],
            'notes' => ['sometimes', 'nullable', 'string'],
        ];
    }
}
