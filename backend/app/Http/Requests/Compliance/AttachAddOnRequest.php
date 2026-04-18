<?php

namespace App\Http\Requests\Compliance;

use App\Services\Identity\AuthorizationService;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Validates request to attach an add-on (appliance) to a specific room bed space.
 */
class AttachAddOnRequest extends FormRequest
{
    /**
     * Authorized: Admin, Staff.
     */
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'add_on_id' => ['required', 'exists:add_on_registry,add_on_id'],
            'actual_rate' => ['required', 'numeric', 'min:0'],
        ];
    }
}
