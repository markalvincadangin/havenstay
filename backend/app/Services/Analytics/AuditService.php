<?php

namespace App\Services\Analytics;

use App\Models\AuditLog;
use App\Models\User;
use App\Services\Concerns\HasReportingFilters;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Core forensic auditing service. Handles manual application events,
 * login/logout tracking, and database trigger context management.
 */
class AuditService
{
    use HasReportingFilters;

    public const MAX_EXPORT_LIMIT = 1000;

    /**
     * Log a manual application event (e.g. login, access denied).
     *
     * @param int         $userId      The executor's user_id
     * @param string      $action      Audit action — use AuditLog::ACTION_* constants
     * @param string      $targetTable The table being acted upon (audit_logs.target_table)
     * @param string|null $recordId    The specific record ID if applicable
     */
    public static function logManualAction(int $userId, string $action, string $targetTable, ?string $recordId = null): void
    {
        AuditLog::create([
            'action'      => $action,
            'target_table'=> $targetTable,
            'record_id'   => $recordId ?? 0,
            'changed_by'  => $userId,
            'changed_at'  => now(),
        ]);
    }

    public static function logLogin(User $user): void
    {
        self::logManualAction($user->user_id, AuditLog::ACTION_LOGIN, 'users', (string)$user->user_id);
    }

    public static function logLogout(?User $user): void
    {
        if ($user) {
            self::logManualAction($user->user_id, AuditLog::ACTION_LOGOUT, 'users', (string)$user->user_id);
        }
    }

    public static function logAccessDenied(?User $user, string $targetTable): void
    {
        if ($user) {
            self::logManualAction($user->user_id, AuditLog::ACTION_ACCESS_DENIED, $targetTable, '0');
        } else {
            AuditLog::create([
                'action'       => AuditLog::ACTION_ACCESS_DENIED,
                'target_table' => $targetTable,
                'record_id'    => 0,
                'changed_by'   => null,
                'changed_at'   => now(),
            ]);
        }
    }

    /**
     * Set session variable for DB triggers.
     */
    public static function setAuditUserContext(int $userId): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement('SET @current_user_id = ?', [$userId]);
        }
    }

    /**
     * Set correlation context for linking transaction and audit logs.
     */
    public static function setCorrelationContext(?string $correlationId): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement('SET @current_correlation_id = ?', [$correlationId]);
        }
    }

    public static function clearCorrelationContext(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement('SET @current_correlation_id = NULL');
        }
    }

    /**
     * Base query for audit log filtering.
     */
    public static function auditLogsFilteredQuery(array $filters = []): Builder
    {
        $query = AuditLog::query()->with(['user' => function ($q) {
            $q->select('user_id', 'username', 'first_name', 'last_name');
        }]);

        if (!empty($filters['entity_type'])) {
            $query->where('target_table', $filters['entity_type']);
        }

        if (!empty($filters['action'])) {
            $query->where('action', $filters['action']);
        }

        self::applyDateFilters($query, $filters, 'changed_at');

        if (!empty($filters['q'])) {
            $q = $filters['q'];
            $query->where(function ($sub) use ($q) {
                $sub->where('correlation_id', 'LIKE', "%{$q}%")
                    ->orWhere('record_id', 'LIKE', "%{$q}%")
                    ->orWhereHas('user', function ($uq) use ($q) {
                        $uq->where('username', 'LIKE', "%{$q}%")
                           ->orWhere('first_name', 'LIKE', "%{$q}%")
                           ->orWhere('last_name', 'LIKE', "%{$q}%");
                    });
            });
        }

        if (!empty($filters['user'])) {
            $userQ = $filters['user'];
            $query->whereHas('user', function ($q) use ($userQ) {
                $q->where('username', 'LIKE', "%{$userQ}%")
                  ->orWhere('first_name', 'LIKE', "%{$userQ}%")
                  ->orWhere('last_name', 'LIKE', "%{$userQ}%");
            });
        }

        if (!empty($filters['correlation'])) {
            $query->where('correlation_id', 'LIKE', "%{$filters['correlation']}%");
        }

        $query->orderByDesc('changed_at')->orderByDesc('id');

        return $query;
    }

    public static function countAccessDeniedMatchingFilters(array $filters = []): int
    {
        if (!empty($filters['action']) && $filters['action'] !== 'access_denied') {
            return 0;
        }

        $forDenied = $filters;
        $forDenied['action'] = 'access_denied';

        return (int) self::auditLogsFilteredQuery($forDenied)->count();
    }

    public static function listLogsPaginated(array $filters, int $page, int $perPage): LengthAwarePaginator
    {
        $paginator = self::auditLogsFilteredQuery($filters)->paginate($perPage, ['*'], 'page', $page);
        self::attachUserContext($paginator->getCollection());

        return $paginator;
    }

    public static function auditLogsCsvPayload(array $filters = []): array
    {
        $logs = self::auditLogsFilteredQuery($filters)->limit(self::MAX_EXPORT_LIMIT)->get();

        $headers = ['ID', 'Timestamp', 'Actor', 'Action', 'Target', 'Record ID', 'Old Value', 'New Value'];

        $rows = $logs->map(function ($log) {
            return [
                (string)$log->id,
                (string)$log->changed_at,
                $log->user?->username ?? 'System',
                $log->action,
                $log->target_table,
                (string)$log->record_id,
                json_encode($log->old_value),
                json_encode($log->new_value),
            ];
        })->all();

        return ['headers' => $headers, 'rows' => $rows];
    }
}
