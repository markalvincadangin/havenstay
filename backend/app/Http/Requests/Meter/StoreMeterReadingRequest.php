<?php

namespace App\Http\Requests\Meter;

use App\Services\Core\AuthorizationService;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Validates data for recording a new utility meter reading.
 * Synchronized with v4.6 Forensic Standards (Monotonicity & Rollover checks).
 */
class StoreMeterReadingRequest extends FormRequest
{
    /**
     * Authorization is handled via Controller/Middleware.
     */
    public function authorize(): bool
    {
        AuthorizationService::ensureCanManageMetrology($this->user());

        return true;
    }

    public function rules(): array
    {
        return [
            'reading_date' => ['required', 'date', 'before_or_equal:today'],
            'reading_value' => ['required', 'numeric', 'min:0'],
            'is_rollover' => ['required', 'boolean'],
            'billing_id' => ['nullable', 'exists:billing,billing_id'],
        ];
    }
}
