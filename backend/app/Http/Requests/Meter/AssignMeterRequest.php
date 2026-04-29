<?php

namespace App\Http\Requests\Meter;

use App\Services\Core\AuthorizationService;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Validates request to assign a meter to a room.
 */
class AssignMeterRequest extends FormRequest
{
    /**
     * Authorized: Admin, Staff.
     */
    public function authorize(): bool
    {
        AuthorizationService::ensureCanManageMetrology($this->user());

        return true;
    }

    /**
     * FR-MET-002: Assignment must link to active room.
     */
    public function rules(): array
    {
        return [
            'room_id' => ['required', 'exists:rooms,room_id'],
            'start_date' => ['required', 'date'],
        ];
    }
}
