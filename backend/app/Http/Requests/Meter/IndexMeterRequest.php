<?php

namespace App\Http\Requests\Meter;

use App\Services\Core\AuthorizationService;
use App\Support\Pagination;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Validates query parameters for listing meters.
 */
class IndexMeterRequest extends FormRequest
{
    /**
     * Authorized: Admin, Staff, Viewer.
     */
    public function authorize(): bool
    {
        AuthorizationService::ensureCanViewMetrology($this->user());
        return true;
    }


    public function rules(): array
    {
        return array_merge([
            'room_id' => ['nullable', 'integer'],
            'utility_id' => ['nullable', 'integer'],
            'status' => ['nullable', 'string', 'in:active,inactive,replaced'],
            'q' => ['nullable', 'string', 'max:200'],
        ], Pagination::queryRules());
    }
}
