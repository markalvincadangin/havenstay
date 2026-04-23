<?php

namespace App\Http\Requests\User;

use App\Services\Core\AuthorizationService;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Basic gatekeeper for user management actions requiring Admin privileges.
 */
class ManageUserRequest extends FormRequest
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
        return [];
    }
}
