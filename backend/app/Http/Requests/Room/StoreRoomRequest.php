<?php

namespace App\Http\Requests\Room;

use App\Enums\BedSpaceStatus;
use App\Enums\RoomStatus;
use App\Enums\RoomType;
use App\Services\Core\AuthorizationService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

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
        AuthorizationService::ensureCanManageRooms($this->user());

        return true;
    }

    public function rules(): array
    {
        return [
            'room_code' => ['required', 'string', 'max:20', 'unique:rooms'],
            'room_type' => ['required', Rule::enum(RoomType::class)],
            'capacity' => ['sometimes', 'integer', 'min:1'],
            'monthly_rate' => ['required', 'numeric', 'min:0'],
            'status' => ['sometimes', Rule::enum(RoomStatus::class)],
            'amenities' => ['nullable', 'string'],
            'description' => ['nullable', 'string'],
            'bed_spaces' => ['sometimes', 'array'],
            'bed_spaces.*.bed_label' => ['required_with:bed_spaces', 'string', 'max:20'],
            'bed_spaces.*.status' => ['sometimes', Rule::enum(BedSpaceStatus::class)],
        ];
    }
}
