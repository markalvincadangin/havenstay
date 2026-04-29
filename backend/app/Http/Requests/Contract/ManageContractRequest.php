<?php

namespace App\Http\Requests\Contract;

use App\Services\Core\AuthorizationService;
use Illuminate\Foundation\Http\FormRequest;

/**
 * ManageContractRequest
 *
 * Standardized gatekeeper for lease lifecycle management (void, activate, archive).
 * Optimized for HavenStay Forensic v5.0.
 */
class ManageContractRequest extends FormRequest
{
    /**
     * Authorized: Admin, Staff.
     */
    public function authorize(): bool
    {
        AuthorizationService::ensureCanManageContracts($this->user());

        return true;
    }

    public function rules(): array
    {
        // If we are voiding, require a reason
        if ($this->routeIs('*.void')) {
            return [
                'reason' => ['required', 'string', 'min:10', 'max:500'],
            ];
        }

        return [];
    }
}
