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
    /** Max rows returned for list + CSV export (aligned with FR-032-style exports). */
    public const AUDIT_LOG_LIST_LIMIT = 500;

    /**
     * Log user login event (App-level event)
     */
    public static function logLogin(User $user): void
    {
        // CCR-003: INSERT audit log entry
        DB::table('audit_logs')->insert([
            'user_id' => $user->user_id,
            'entity_name' => 'users',
            'entity_id' => (string) $user->user_id,
            'action' => 'login',
            'created_at' => now(),
        ]);
    }

    /**
     * Log user logout event (App-level event)
     */
    public static function logLogout(?User $user): void
    {
        if ($user) {
            DB::table('audit_logs')->insert([
                'user_id' => $user->user_id,
                'entity_name' => 'users',
                'entity_id' => (string) $user->user_id,
                'action' => 'logout',
                'created_at' => now(),
            ]);
        }
    }

    /**
     * Log access denied event (App-level event)
     */
    public static function logAccessDenied(?User $user, string $resource): void
    {
        DB::table('audit_logs')->insert([
            'user_id' => $user?->user_id,
            'entity_name' => $resource,
            'entity_id' => 'denied',
            'action' => 'access_denied',
            'created_at' => now(),
        ]);
    }

    /**
     * Set the database context for @app_user_id.
     * This is used by database triggers for row-level auditing.
     * CCR-008: Trigger context — enables triggers to capture acting user
     */
    public static function setAuditUserContext(int $userId): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement('SET @app_user_id = ?', [$userId]);
        }
    }

    /**
     * Set session variable for trigger-written audit_logs.correlation_id (MySQL only).
     * Pair with {@see clearCorrelationContext()} after workflow completes.
     */
    public static function setCorrelationContext(?string $correlationId): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        if ($correlationId === null || $correlationId === '') {
            DB::statement('SET @app_correlation_id = NULL');

            return;
        }

        DB::statement('SET @app_correlation_id = ?', [$correlationId]);
    }

    /**
     * Clear correlation context so pooled connections do not leak UUIDs across requests.
     */
    public static function clearCorrelationContext(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement('SET @app_correlation_id = NULL');
        }
    }

    /**
     * @param  array{entity_type?: string, action?: string, from?: string, to?: string, user?: string, correlation?: string}  $filters
     */
    public static function auditLogsFilteredQuery(array $filters = []): Builder
    {
        $query = AuditLog::with(['user' => function ($q) {
            $q->select('user_id', 'username', 'first_name', 'last_name');
        }]);

        if (! empty($filters['entity_type'])) {
            $query->where('entity_name', $filters['entity_type']);
        }

        if (! empty($filters['action'])) {
            $query->where('action', $filters['action']);
        }

        if (! empty($filters['from'])) {
            $query->where('created_at', '>=', $filters['from'].' 00:00:00');
        }

        if (! empty($filters['to'])) {
            $query->where('created_at', '<=', $filters['to'].' 23:59:59');
        }

        if (! empty($filters['user'])) {
            $userQ = $filters['user'];
            $query->whereHas('user', function ($q) use ($userQ): void {
                $q->where('username', 'LIKE', "%{$userQ}%")
                    ->orWhere('first_name', 'LIKE', "%{$userQ}%")
                    ->orWhere('last_name', 'LIKE', "%{$userQ}%");
            });
        }

        if (! empty($filters['correlation'])) {
            $cid = trim((string) $filters['correlation']);
            $query->where('correlation_id', 'LIKE', '%'.$cid.'%');
        }

        return $query->orderByDesc('created_at')
            ->orderByDesc('audit_log_id');
    }

    /**
     * Count of {@see logAccessDenied()} rows (`action = access_denied`) matching the same filters as the list,
     * across all pages. If the request filters {@see action} to a value other than `access_denied`, returns 0
     * (those rows are excluded from the current list).
     *
     * @param  array{entity_type?: string, action?: string, from?: string, to?: string, user?: string, correlation?: string}  $filters
     */
    public static function countAccessDeniedMatchingFilters(array $filters = []): int
    {
        if (! empty($filters['action']) && $filters['action'] !== 'access_denied') {
            return 0;
        }

        $forDenied = $filters;
        $forDenied['action'] = 'access_denied';

        return (int) self::auditLogsFilteredQuery($forDenied)->count();
    }

    /**
     * Paginated audit logs with filters.
     *
     * @param  array{entity_type?: string, action?: string, from?: string, to?: string, user?: string, correlation?: string}  $filters
     */
    public static function listLogsPaginated(array $filters, int $page, int $perPage): LengthAwarePaginator
    {
        $paginator = self::auditLogsFilteredQuery($filters)
            ->paginate($perPage, ['*'], 'page', $page);

        $paginator->getCollection()->transform(function ($log) {
            $log->user_username = $log->user?->username;
            $log->user_first_name = $log->user?->first_name;
            $log->user_last_name = $log->user?->last_name;

            return $log;
        });

        return $paginator;
    }

    /**
     * List audit logs with filters (legacy capped list; prefer {@see listLogsPaginated()} for API).
     *
     * @param  array{entity_type?: string, action?: string, from?: string, to?: string, user?: string, correlation?: string}  $filters
     */
    public static function listLogs(array $filters = []): Collection
    {
        return self::auditLogsFilteredQuery($filters)
            ->limit(self::AUDIT_LOG_LIST_LIMIT)
            ->get()
            ->map(function ($log) {
                $log->user_username = $log->user?->username;
                $log->user_first_name = $log->user?->first_name;
                $log->user_last_name = $log->user?->last_name;

                return $log;
            });
    }

    /**
     * CSV rows for audit_logs export (schema: audit_log_id, user_id, entity_name, entity_id, action, timestamps, JSON snapshots).
     *
     * FR-032-style export; same filters as {@see listLogs()}.
     *
     * @param  array{entity_type?: string, action?: string, from?: string, to?: string, user?: string}  $filters
     * @return array{headers: string[], rows: array<int, array<int, string|null>>}
     */
    public static function auditLogsCsvPayload(array $filters = []): array
    {
        $logs = self::auditLogsFilteredQuery($filters)
            ->limit(self::AUDIT_LOG_LIST_LIMIT)
            ->get();

        $headers = [
            'audit_log_id',
            'created_at',
            'user_id',
            'actor_username',
            'entity_name',
            'entity_id',
            'action',
            'correlation_id',
            'old_values_json',
            'new_values_json',
        ];

        $rows = $logs->map(function (AuditLog $log): array {
            return [
                (string) $log->audit_log_id,
                $log->created_at ? (string) $log->created_at : '',
                $log->user_id !== null ? (string) $log->user_id : '',
                $log->user?->username ?? '',
                $log->entity_name,
                $log->entity_id,
                $log->action,
                $log->correlation_id ?? '',
                self::jsonColumnForCsv($log->old_values_json),
                self::jsonColumnForCsv($log->new_values_json),
            ];
        })->all();

        return ['headers' => $headers, 'rows' => $rows];
    }

    private static function jsonColumnForCsv(mixed $value): string
    {
        if ($value === null || $value === '') {
            return '';
        }
        if (is_string($value)) {
            return $value;
        }

        return json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '';
    }
}
