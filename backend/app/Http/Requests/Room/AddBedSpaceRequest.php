<?php

namespace App\Http\Requests\Room;

use App\Services\Core\AuthorizationService;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Validates request to add a new bed space to a room.
 */
class AddBedSpaceRequest extends FormRequest
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
        return [
            'bed_label' => ['required', 'string', 'max:20'],
        ];
    }
}
