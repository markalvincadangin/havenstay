<?php

namespace App\Http\Requests\Meter;

use App\Services\Core\AuthorizationService;
use Illuminate\Foundation\Http\FormRequest;

/**
 * ManageMeterRequest
 *
 * Standardized gatekeeper for meter asset management and metrology viewing.
 * Optimized for HavenStay Forensic v5.0.
 */
class ManageMeterRequest extends FormRequest
{
    /**
     * Authorized: Admin, Staff, Viewer (for viewing).
     */
    public function authorize(): bool
    {
        AuthorizationService::ensureCanViewMetrology($this->user());

        return true;
    }

    public function rules(): array
    {
        return [];
    }
}
