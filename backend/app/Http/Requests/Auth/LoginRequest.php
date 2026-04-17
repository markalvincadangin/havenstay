<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

class LoginRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'username' => ['required_without:email', 'string'],
            'email' => ['nullable', 'string', 'email'],
            'password' => ['required', 'string'],
        ];
    }
}
