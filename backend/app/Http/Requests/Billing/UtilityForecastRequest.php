<?php

namespace App\Http\Requests\Billing;

use App\Services\Core\AuthorizationService;
use Illuminate\Foundation\Http\FormRequest;

class UtilityForecastRequest extends FormRequest
{
    public function authorize(): bool
    {
        AuthorizationService::ensureCanManageBilling($this->user());
        return true;
    }

    public function rules(): array
    {
        return [
            'room_id' => ['required', 'integer', 'exists:rooms,room_id'],
            'billing_period_start' => ['required', 'date'],
            'billing_period_end' => ['required', 'date', 'after:billing_period_start'],
            
            // Array of meter readings to calculate utility consumption
            'readings' => ['required', 'array', 'min:1'],
            'readings.*.meter_id' => ['required', 'integer', 'exists:meters,meter_id'],
            'readings.*.previous_reading_id' => ['required', 'integer', 'exists:meter_readings,reading_id'],
            'readings.*.current_reading_id' => ['required', 'integer', 'exists:meter_readings,reading_id'],
        ];
    }
}
