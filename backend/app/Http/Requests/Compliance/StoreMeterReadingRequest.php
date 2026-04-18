<?php

namespace App\Http\Requests\Compliance;

use App\Services\Identity\AuthorizationService;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Validates data for recording a new utility meter reading.
 */
class StoreMeterReadingRequest extends FormRequest
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
            'utility_type' => ['required', 'in:electric,water'],
            'reading_date' => ['required', 'date', 'before_or_equal:today'],
            'reading_value' => ['required', 'numeric', 'min:0'],
        ];
    }
}
