<?php

namespace App\Http\Requests\Utility;

use App\Services\Core\AuthorizationService;
use Illuminate\Foundation\Http\FormRequest;

/**
 * StoreUtilityRequest
 *
 * Validates data for creating a new utility registry entry.
 * Optimized for HavenStay Forensic v5.0.
 */
class StoreUtilityRequest extends FormRequest
{
    /**
     * Authorized: Admin only (High-level registry config).
     */
    public function authorize(): bool
    {
        AuthorizationService::ensureCanManageUsers($this->user());

        return true;
    }

    /**
     * Validation rules for utility creation.
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:100', 'unique:utilities,name'],
            'unit_of_measurement' => ['required', 'string', 'max:20'],
            'initial_base_rate' => ['required', 'numeric', 'min:0'],
            'effective_from' => ['required', 'date'],
        ];
    }
}
