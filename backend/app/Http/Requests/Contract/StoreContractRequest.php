<?php

namespace App\Http\Requests\Contract;

use App\Services\Identity\AuthorizationService;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Validates data for creating a new tenant lease/contract.
 */
class StoreContractRequest extends FormRequest
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
            'tenant_id' => ['required', 'integer', 'exists:tenants,tenant_id'],
            'room_id' => ['nullable', 'integer', 'exists:rooms,room_id'],
            'bed_space_id' => ['nullable', 'integer', 'exists:bed_spaces,bed_space_id'],
            'move_in_date' => ['required', 'date'],
            'expected_move_out' => ['nullable', 'date'],
            'deposit_amount' => ['nullable', 'numeric', 'min:0'],
            'monthly_rate_override' => ['nullable', 'numeric', 'min:0'],
            'monthly_rate' => ['nullable', 'numeric', 'min:0'],
            'initialize_billing' => ['nullable', 'boolean'],
            'notes' => ['nullable', 'string'],
        ];
    }
}
