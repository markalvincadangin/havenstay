<?php

namespace App\Http\Requests\Payment;

use App\Services\Core\AuthorizationService;
use Illuminate\Foundation\Http\FormRequest;

/**
 * ManagePaymentRequest
 *
 * Standardized gatekeeper for viewing individual financial transaction details.
 * Optimized for HavenStay Forensic v5.0.
 */
class ManagePaymentRequest extends FormRequest
{
    /**
     * Authorized: Admin, Staff, Viewer.
     */
    public function authorize(): bool
    {
        AuthorizationService::ensureCanViewPayments($this->user());

        return true;
    }

    public function rules(): array
    {
        return [];
    }
}
