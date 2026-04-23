<?php

namespace App\Http\Requests\Billing;

use App\Services\Core\AuthorizationService;
use App\Support\Pagination;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Validates query parameters for listing billing records.
 */
class IndexBillingRequest extends FormRequest
{
    /**
     * Authorized: Admin, Staff, Viewer.
     */
    public function authorize(): bool
    {
        AuthorizationService::ensureCanViewBilling($this->user());
        return true;
    }

    public function rules(): array
    {
        return array_merge([
            'contract_id' => ['nullable', 'integer'],
            'tenant_id' => ['nullable', 'integer'],
            'status' => ['nullable', 'string', 'in:unpaid,partial,paid,overdue'],
            'q' => ['nullable', 'string', 'max:200'],
        ], Pagination::queryRules());
    }
}
