<?php

namespace App\Http\Requests\Contract;

use App\Services\Core\AuthorizationService;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Validates request to move out a tenant and conclude a contract.
 */
class MoveOutRequest extends FormRequest
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
            'actual_move_out' => ['required', 'date'],
            'status' => ['nullable', 'string', 'in:completed,terminated'],
            'notes' => ['nullable', 'string'],
        ];
    }
}
