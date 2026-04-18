<?php

namespace App\Http\Requests\Contract;

use App\Services\Identity\AuthorizationService;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Validates data for updating an existing tenant lease.
 */
class UpdateContractRequest extends FormRequest
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
            'expected_move_out_date' => ['sometimes', 'nullable', 'date'],
            'actual_move_out_date' => ['sometimes', 'nullable', 'date'],
            'deposit_amount' => ['sometimes', 'numeric', 'min:0'],
            'monthly_rate_override' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'status' => ['sometimes', 'string', 'in:active,completed,pending_payment,terminated'],
            'notes' => ['sometimes', 'nullable', 'string'],
        ];
    }
}
