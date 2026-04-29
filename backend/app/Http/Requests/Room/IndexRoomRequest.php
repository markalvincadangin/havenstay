<?php

namespace App\Http\Requests\Room;

use App\Enums\RoomType;
use App\Services\Core\AuthorizationService;
use App\Support\Pagination;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * IndexRoomRequest
 *
 * Validates query parameters for listing rooms.
 * Optimized for HavenStay Forensic v5.0.
 */
class IndexRoomRequest extends FormRequest
{
    /**
     * Authorized: Admin, Staff, Viewer.
     *
     * Ref: BR-GEN-007
     */
    public function authorize(): bool
    {
        AuthorizationService::ensureCanViewRooms($this->user());

        return true;
    }

    public function rules(): array
    {
        return array_merge([
            'q' => ['nullable', 'string', 'max:200'],
            'status' => ['nullable', 'string', Rule::in(['available', 'unavailable', 'maintenance', 'archived'])],
            'room_type' => ['nullable', Rule::enum(RoomType::class)],
        ], Pagination::queryRules());
    }
}
