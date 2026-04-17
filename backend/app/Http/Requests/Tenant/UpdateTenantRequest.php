<?php

namespace App\Http\Requests\Tenant;

use App\Services\AuthorizationService;
use Illuminate\Foundation\Http\FormRequest;

class UpdateTenantRequest extends FormRequest
{
    public function authorize(): bool
    {
        return AuthorizationService::canManageTenants($this->user());
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'first_name' => ['required', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'contact_number' => ['required', 'string', 'max:20'],
            'email' => ['required', 'email', 'max:150'],
            'emergency_contact_name' => ['required', 'string', 'max:200'],
            'emergency_contact_number' => ['required', 'string', 'max:20'],
            'address' => ['required', 'string'],
            'status' => ['sometimes', 'string', 'in:active,moved_out,archived'],
        ];
    }
}

