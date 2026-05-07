<?php

namespace App\Http\Requests\AuditLog;

use App\Services\Core\AuthorizationService;
use Illuminate\Foundation\Http\FormRequest;

/**
 * ExportAuditLogRequest
 *
 * Validates request to export audit logs to CSV for forensic analysis.
 * Optimized for HavenStay Forensic v5.0.
 */
class ExportAuditLogRequest extends FormRequest
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
     * Validation rules for exporting audit logs.
     */
    public function rules(): array
    {
        return [
            'entity_type' => ['sometimes', 'nullable', 'string', 'max:64'],
            'action' => ['sometimes', 'nullable', 'string', 'in:CREATE,UPDATE,DELETE,SOFT_DELETE,RESTORE,LOGIN,LOGOUT,FAILED_LOGIN,VOID,SYSTEM,SECURITY,EXPORT,ACCESS_DENIED'],
            'from' => ['sometimes', 'nullable', 'string', 'max:32'],
            'to' => ['sometimes', 'nullable', 'string', 'max:32'],
            'user' => ['sometimes', 'nullable', 'string', 'max:200'],
            'correlation' => ['sometimes', 'nullable', 'string', 'max:64'],
            'q' => ['sometimes', 'nullable', 'string', 'max:255'],
        ];
    }
}
