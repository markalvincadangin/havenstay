<?php

namespace App\Http\Requests\Billing;

use Illuminate\Foundation\Http\FormRequest;

class StoreBillingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'contract_id' => ['required', 'integer', 'exists:contracts,contract_id'],
            'billing_period_from' => ['required', 'date'],
            'billing_period_to' => ['required', 'date'],
            'due_date' => ['required', 'date'],
            'line_items' => ['required', 'array', 'min:1'],
            'line_items.*.item_type' => ['required', 'in:base_rent,utility,add_on,penalty,adjustment'],
            'line_items.*.item_description' => ['nullable', 'string', 'max:255'],
            'line_items.*.amount' => ['required', 'numeric'],
        ];
    }
}
