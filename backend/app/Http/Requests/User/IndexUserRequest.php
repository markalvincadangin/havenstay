<?php

namespace App\Http\Requests\User;

use App\Services\Core\AuthorizationService;
use App\Support\Pagination;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Validates request to list users with filtering.
 */
class IndexUserRequest extends FormRequest
{
    /**
     * Authorized: Admin only (for user management).
     */
    public function authorize(): bool
    {
        AuthorizationService::ensureCanManageUsers($this->user());

        return true;
    }

    public function rules(): array
    {
        return array_merge([
            'q' => ['nullable', 'string', 'max:200'],
            'role' => ['nullable', 'string', 'max:32'],
            'account_status' => ['nullable', 'string', 'in:active,inactive,archived'],
        ], Pagination::queryRules());
    }
}
