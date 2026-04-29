<?php

namespace App\Http\Requests\Utility;

use App\Services\Core\AuthorizationService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * StoreUtilityRateRequest
 *
 * Validates data for creating a new utility rate period.
 * Optimized for HavenStay Forensic v5.0.
 */
class StoreUtilityRateRequest extends FormRequest
{
    /**
     * Authorized: Admin, Staff.
     */
    public function authorize(): bool
    {
        AuthorizationService::ensureCanManageMetrology($this->user());

        return true;
    }

    /**
     * Validation rules for utility rates.
     *
     * Ref: BR-MET-007
     */
    public function rules(): array
    {
        return [
            'utility_id' => ['required', 'integer', 'exists:utilities,utility_id'],
            'base_rate' => ['required', 'numeric', 'min:0'],
            'effective_from' => [
                'required',
                'date',
                Rule::unique('utility_rates')->where(function ($query) {
                    return $query->where('utility_id', $this->utility_id);
                }),
            ],
        ];
    }
}
