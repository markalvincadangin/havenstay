<?php

namespace App\Http\Requests\Room;

use App\Services\Core\AuthorizationService;
use Illuminate\Foundation\Http\FormRequest;

/**
 * ViewRoomRequest
 *
 * Lightweight gatekeeper for viewing room details and statistics.
 */
class ViewRoomRequest extends FormRequest
{
    /**
     * Authorized: Admin, Staff, Viewer.
     */
    public function authorize(): bool
    {
        AuthorizationService::ensureCanViewRooms($this->user());

        return true;
    }

    public function rules(): array
    {
        return [];
    }
}
