<?php

namespace App\Http\Requests\Utility;

use App\Services\Core\AuthorizationService;
use Illuminate\Foundation\Http\FormRequest;

/**
 * ManageUtilityRequest
 *
 * Standardized gatekeeper for administrative utility configuration actions.
 * Optimized for HavenStay Forensic v5.0.
 */
class ManageUtilityRequest extends FormRequest
{
    /**
     * Authorized: Admin only (High-level registry config).
     */
    public function authorize(): bool
    {
        AuthorizationService::ensureCanViewUtilities($this->user());

        return true;
    }

    public function rules(): array
    {
        return [];
    }
}
