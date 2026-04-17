<?php

namespace App\Http\Requests\User;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        /** @var User|null $user */
        $user = $this->route('user');

        return [
            'first_name' => ['sometimes', 'string', 'max:100'],
            'last_name' => ['sometimes', 'string', 'max:100'],
            'username' => ['sometimes', 'string', 'max:50', Rule::unique('users')->ignore($user?->user_id, 'user_id')],
            'email' => ['sometimes', 'email', Rule::unique('users')->ignore($user?->user_id, 'user_id')],
            'role_id' => ['sometimes', 'exists:roles,role_id'],
            'is_active' => ['sometimes', 'boolean'],
            'password' => ['nullable', 'string', 'min:8'],
        ];
    }
}
