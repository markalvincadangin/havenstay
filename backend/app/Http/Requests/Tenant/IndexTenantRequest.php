<?php

namespace App\Http\Requests\Tenant;

use App\Services\Core\AuthorizationService;
use App\Support\Pagination;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Validates query parameters for listing tenants.
 */
class IndexTenantRequest extends FormRequest
{
    /**
     * Authorized: Admin, Staff, Viewer.
     */
    public function authorize(): bool
    {
        AuthorizationService::ensureCanViewTenants($this->user());

        return true;
    }

    public function rules(): array
    {
        return array_merge([
            'q' => ['nullable', 'string', 'max:200'],
            'status' => ['nullable', 'string', 'in:onboarded,active,moved_out,archived'],
        ], Pagination::queryRules());
    }
}
