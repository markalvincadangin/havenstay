<?php

namespace App\Http\Requests\Contract;

use App\Services\Core\AuthorizationService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use App\Enums\ContractStatus;

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
        AuthorizationService::ensureCanManageContracts($this->user());
        return true;
    }

    public function rules(): array
    {
        return [
            'expected_move_out_date' => ['sometimes', 'nullable', 'date'],
            'actual_move_out_date' => ['sometimes', 'nullable', 'date'],
            'deposit_amount' => ['sometimes', 'numeric', 'min:0'],
            'monthly_rate_override' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'status' => ['sometimes', Rule::enum(ContractStatus::class)],
            'notes' => ['sometimes', 'nullable', 'string'],
        ];
    }
}
