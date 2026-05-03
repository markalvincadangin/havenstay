<?php

namespace App\Http\Requests\User;

use App\Services\Core\AuthorizationService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Validates data for creating a new system user.
 */
class StoreUserRequest extends FormRequest
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
            'first_name' => ['required', 'string', 'max:100'],
            'last_name'  => ['required', 'string', 'max:100'],
            // BR-GEN-003: Uniqueness only enforced among non-deleted (active) records.
            // Archived users release their credentials for re-use via the active_username
            // and active_email VIRTUAL GENERATED columns in the schema.
            'username'   => ['required', 'string', 'max:50', Rule::unique('users')->whereNull('deleted_at')],
            'email'      => ['required', 'email',            Rule::unique('users')->whereNull('deleted_at')],
            'password'   => ['required', 'string', 'min:8'],
            'role_id'    => ['required', 'exists:roles,role_id'],
        ];
    }
}
