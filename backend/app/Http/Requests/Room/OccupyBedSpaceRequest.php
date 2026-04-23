<?php

namespace App\Http\Requests\Room;

use App\Services\Core\AuthorizationService;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Validates request for administrative/test occupancy of a bed space.
 */
class OccupyBedSpaceRequest extends FormRequest
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
