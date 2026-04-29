<?php

namespace App\Http\Requests\Room;

use App\Services\Core\AuthorizationService;
use Illuminate\Foundation\Http\FormRequest;

/**
 * ManageRoomRequest
 *
 * Standardized gatekeeper for administrative room management actions.
 * Optimized for HavenStay Forensic v5.0.
 */
class ManageRoomRequest extends FormRequest
{
    /**
     * Authorized: Admin, Staff.
     */
    public function authorize(): bool
    {
        AuthorizationService::ensureCanManageRooms($this->user());

        return true;
    }

    public function rules(): array
    {
        return [];
    }
}
