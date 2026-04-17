<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class AuditService
{
    public const MAX_EXPORT_LIMIT = 1000;

    /**
     * Log a manual application event (e.g. login, access denied).
     *
     * @param int $userId The executor ID
     * @param string $action The audit action name (e.g. 'login', 'access_denied')
     * @param string $resource Or target table name
     * @param string|null $recordId The specific record ID if applicable
     */
    public static function logManualAction(int $userId, string $action, string $resource, ?string $recordId = null): void
    {
        AuditLog::create([
            'action'      => $action,
            'target_table'=> $resource,
            'record_id'   => $recordId ?? 0,
            'changed_by'  => $userId,
            'changed_at'  => now(),
        ]);
    }

    public static function logLogin(User $user): void
    {
        self::logManualAction($user->user_id, 'login', 'users', (string)$user->user_id);
    }

    public static function logLogout(?User $user): void
    {
        if ($user) {
            self::logManualAction($user->user_id, 'logout', 'users', (string)$user->user_id);
        }
    }

    public static function logAccessDenied(?User $user, string $resource): void
    {
        if ($user) {
            self::logManualAction($user->user_id, 'access_denied', $resource, '0');
        } else {
            AuditLog::create([
                'action'       => 'access_denied',
                'target_table' => $resource,
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

        if (!empty($filters['from'])) {
            $query->where('changed_at', '>=', $filters['from'] . ' 00:00:00');
        }

        if (!empty($filters['to'])) {
            $query->where('changed_at', '<=', $filters['to'] . ' 23:59:59');
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
            $query->where('correlation_id', $filters['correlation']);
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

        $paginator->getCollection()->transform(function ($log) {
            $log->user_username = $log->user?->username;
            $log->user_first_name = $log->user?->first_name;
            $log->user_last_name = $log->user?->last_name;
            return $log;
        });

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
