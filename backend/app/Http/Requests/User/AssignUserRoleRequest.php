<?php

namespace App\Http\Requests\User;

use App\Services\Core\AuthorizationService;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Validates request to assign a role to a user.
 */
class AssignUserRoleRequest extends FormRequest
{
    /**
     * Authorized: Admin only.
     */
    public function authorize(): bool
    {
        AuthorizationService::ensureCanManageUsers($this->user());

        return true;
    }

    public function rules(): array
    {
        return [
            'role_id' => ['required', 'exists:roles,role_id'],
        ];
    }
}
