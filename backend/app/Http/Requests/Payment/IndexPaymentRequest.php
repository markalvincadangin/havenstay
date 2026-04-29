<?php

namespace App\Http\Requests\Payment;

use App\Services\Core\AuthorizationService;
use App\Support\Pagination;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Validates query parameters for listing payments.
 */
class IndexPaymentRequest extends FormRequest
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
        return array_merge([
            'billing_id' => ['nullable', 'integer'],
            'contract_id' => ['nullable', 'integer'],
            'q' => ['nullable', 'string', 'max:200'],
            'category' => ['nullable', 'string', 'in:billing,deposit,refund,rollover'],
            'include_voided' => ['nullable', 'boolean'],
        ], Pagination::queryRules());
    }
}
