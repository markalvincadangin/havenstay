<?php

namespace App\Http\Requests\Room;

use App\Services\Identity\AuthorizationService;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Validates data for creating a new room and its initial bed space configuration.
 */
class StoreRoomRequest extends FormRequest
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
            'room_code' => ['required', 'string', 'max:20', 'unique:rooms'],
            'room_type' => ['required', 'in:solo,shared'],
            'capacity' => ['sometimes', 'integer', 'min:1'],
            'monthly_rate' => ['required', 'numeric', 'min:0'],
            'status' => ['sometimes', 'in:vacant,partially_occupied,fully_occupied,maintenance'],
            'amenities' => ['nullable', 'string'],
            'description' => ['nullable', 'string'],
            'bed_spaces' => ['sometimes', 'array'],
            'bed_spaces.*.bed_label' => ['required_with:bed_spaces', 'string', 'max:20'],
            'bed_spaces.*.status' => ['sometimes', 'in:vacant,occupied,maintenance'],
        ];
    }
}
