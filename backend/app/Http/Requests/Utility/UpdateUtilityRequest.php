<?php

namespace App\Http\Requests\Utility;

use App\Services\Core\AuthorizationService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * UpdateUtilityRequest
 *
 * Validates data for updating utility registry metadata.
 * Optimized for HavenStay Forensic v5.0.
 */
class UpdateUtilityRequest extends FormRequest
{
    /**
     * Authorized: Admin only.
     */
    public function authorize(): bool
    {
        AuthorizationService::ensureCanManageUtilities($this->user());

        return true;
    }

    /**
     * Validation rules for utility updates.
     */
    public function rules(): array
    {
        $utilityId = $this->route('utility')?->utility_id ?? $this->route('id');

        return [
            'name' => [
                'sometimes',
                'string',
                'max:100',
                Rule::unique('utilities', 'name')->ignore($utilityId, 'utility_id'),
            ],
            'unit_of_measurement' => ['sometimes', 'string', 'max:20'],
        ];
    }
}
