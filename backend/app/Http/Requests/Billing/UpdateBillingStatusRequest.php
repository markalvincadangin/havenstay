<?php

namespace App\Http\Requests\Billing;

use App\Services\Core\AuthorizationService;
use Illuminate\Foundation\Http\FormRequest;

/**
 * UpdateBillingStatusRequest
 *
 * Validates request to recalculate or update billing status.
 * Optimized for HavenStay Forensic v5.0.
 */
class UpdateBillingStatusRequest extends FormRequest
{
    /**
     * Authorized: Admin, Staff.
     */
    public function authorize(): bool
    {
        AuthorizationService::ensureCanManageBilling($this->user());

        return true;
    }

    public function rules(): array
    {
        return [];
    }
}
