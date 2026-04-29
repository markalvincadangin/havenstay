<?php

namespace App\Http\Requests\Contract;

use App\Services\Core\AuthorizationService;
use App\Support\Pagination;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Validates query parameters for listing contracts.
 */
class IndexContractRequest extends FormRequest
{
    /**
     * Authorized: Admin, Staff, Viewer.
     */
    public function authorize(): bool
    {
        AuthorizationService::ensureCanViewContracts($this->user());

        return true;
    }

    public function rules(): array
    {
        return array_merge([
            'tenant_id' => ['nullable', 'integer'],
            'status' => ['nullable', 'string', 'max:32'],
            'q' => ['nullable', 'string', 'max:200'],
        ], Pagination::queryRules());
    }
}
