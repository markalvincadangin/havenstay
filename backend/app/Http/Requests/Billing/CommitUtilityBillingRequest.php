<?php

namespace App\Http\Requests\Billing;

use App\Models\Room;
use App\Services\Core\AuthorizationService;
use Illuminate\Foundation\Http\FormRequest;

/**
 * CommitUtilityBillingRequest
 *
 * Validates data for finalizing utility apportionments into bills.
 * Optimized for HavenStay Forensic v5.0.
 */
class CommitUtilityBillingRequest extends FormRequest
{
    public function authorize(): bool
    {
        AuthorizationService::ensureCanManageBilling($this->user());

        return true;
    }

    /**
     * Ref: BR-BIL-005
     */
    public function rules(): array
    {
        $room = Room::find($this->room_id);
        $isMetered = $room ? (bool) $room->is_metered : true;

        $readingsRule = $isMetered ? ['required', 'array', 'min:1'] : ['nullable', 'array'];

        return [
            'room_id' => ['required', 'integer', 'exists:rooms,room_id'],
            'total_charge' => ['required', 'numeric', 'min:0'],
            'billing_period_start' => ['required', 'date'],
            'billing_period_end' => ['required', 'date', 'after:billing_period_start'],

            // BR-BIL-005: Due date must be after the billing period end date.
            'due_date' => ['required', 'date', 'after:billing_period_end'],

            // Meter linkage
            'readings' => $readingsRule,
            'readings.*.meter_id' => ['required', 'integer', 'exists:meters,meter_id'],
            'readings.*.previous_reading_id' => ['required', 'integer', 'exists:meter_readings,reading_id'],
            'readings.*.current_reading_id' => ['required', 'integer', 'exists:meter_readings,reading_id'],

            // Final calculated apportionments
            'apportionments' => ['required', 'array', 'min:1'],
            'apportionments.*.contract_id' => ['required', 'integer', 'exists:contracts,contract_id'],
            'apportionments.*.amount' => ['required', 'numeric', 'min:0'],
            'apportionments.*.override_reason' => ['nullable', 'string', 'max:255'],

            // Manual items per contract
            'apportionments.*.manual_items' => ['nullable', 'array'],
            'apportionments.*.manual_items.*.item_type' => ['required', 'string', 'in:penalty,adjustment'],
            'apportionments.*.manual_items.*.description' => ['required', 'string', 'max:255'],
            'apportionments.*.manual_items.*.amount' => ['required', 'numeric'],
        ];
    }
}
