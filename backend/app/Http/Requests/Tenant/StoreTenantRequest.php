<?php

namespace App\Http\Requests\Tenant;

use App\Services\Identity\AuthorizationService;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Validates data for creating a new tenant profile.
 */
class StoreTenantRequest extends FormRequest
{
    /**
     * Authorized: Admin, Staff.
     */
    public function authorize(): bool
    {
        return true;
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
        ];
    }
}

