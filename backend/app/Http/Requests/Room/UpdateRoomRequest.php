<?php

namespace App\Http\Requests\Room;

use App\Models\Room;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateRoomRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        /** @var Room|null $room */
        $room = $this->route('room');

        return [
            'room_code' => ['sometimes', 'string', 'max:20', Rule::unique('rooms', 'room_code')->ignore($room?->room_id, 'room_id')],
            'room_type' => ['sometimes', 'in:solo,shared'],
            'capacity' => ['sometimes', 'integer', 'min:1'],
            'monthly_rate' => ['sometimes', 'numeric', 'min:0'],
            'status' => ['sometimes', 'in:vacant,partially_occupied,fully_occupied,maintenance'],
            'amenities' => ['sometimes', 'nullable', 'string'],
            'description' => ['sometimes', 'nullable', 'string'],
            'bed_spaces' => ['sometimes', 'array'],
            'bed_spaces.*.bed_space_id' => ['sometimes', 'nullable', 'integer', 'exists:bed_spaces,bed_space_id'],
            'bed_spaces.*.bed_label' => ['required_with:bed_spaces', 'string', 'max:20'],
            'bed_spaces.*.status' => ['sometimes', 'in:vacant,occupied,maintenance'],
        ];
    }
}
