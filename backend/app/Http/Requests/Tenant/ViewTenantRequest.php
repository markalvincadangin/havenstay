<?php

namespace App\Http\Requests\Tenant;

use App\Services\Core\AuthorizationService;
use Illuminate\Foundation\Http\FormRequest;

/**
 * ViewTenantRequest
 *
 * Lightweight gatekeeper for viewing tenant details.
 */
class ViewTenantRequest extends FormRequest
{
    /**
     * Authorized: Admin, Staff, Viewer.
     */
    public function authorize(): bool
    {
        AuthorizationService::ensureCanViewTenants($this->user());

        return true;
    }

    public function rules(): array
    {
        return [];
    }
}
