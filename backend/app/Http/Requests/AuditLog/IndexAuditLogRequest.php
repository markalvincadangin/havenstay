<?php

namespace App\Http\Requests\AuditLog;

use App\Services\Core\AuthorizationService;
use App\Support\Pagination;
use Illuminate\Foundation\Http\FormRequest;

/**
 * IndexAuditLogRequest
 *
 * Validates filtering and pagination parameters for the audit log viewer.
 * Optimized for HavenStay Forensic v5.0.
 */
class IndexAuditLogRequest extends FormRequest
{
    /**
     * Authorized: Admin only.
     */
    public function authorize(): bool
    {
        AuthorizationService::ensureCanViewAuditLogs($this->user());

        return true;
    }

    /**
     * Validation rules for filtering audit logs.
     */
    public function rules(): array
    {
        return array_merge([
            'entity_type' => ['sometimes', 'nullable', 'string', 'max:64'],
            'action' => ['sometimes', 'nullable', 'string', 'in:INSERT,UPDATE,DELETE,login,logout,access_denied,status_change,archive,restore'],
            'from' => ['sometimes', 'nullable', 'string', 'max:32'],
            'to' => ['sometimes', 'nullable', 'string', 'max:32'],
            'user' => ['sometimes', 'nullable', 'string', 'max:200'],
            'correlation' => ['sometimes', 'nullable', 'string', 'max:64'],
            'q' => ['sometimes', 'nullable', 'string', 'max:255'],
        ], Pagination::queryRules());
    }
}
