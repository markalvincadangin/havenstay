<?php

namespace App\Services\Analytics;

use App\Models\AuditLog;
use App\Services\Concerns\HasReportingFilters;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;

/**
 * Service for querying and exporting audit logs. Handles application
 * events, login/logout tracking, and database context management.
 */
class AuditReportingService
{
    use HasReportingFilters;

    public const MAX_EXPORT_LIMIT = 1000;

    /**
     * Base query for audit log filtering.
     */
    public static function auditLogsFilteredQuery(array $filters = []): Builder
    {
        $query = AuditLog::query()->with(['user' => function ($q) {
            $q->select('user_id', 'username', 'first_name', 'last_name');
        }]);

        if (! empty($filters['entity_type'])) {
            $query->where('target_table', $filters['entity_type']);
        }

        if (! empty($filters['action'])) {
            $query->where('action', $filters['action']);
        }

        self::applyDateRange($query, $filters, 'changed_at');

        if (! empty($filters['q'])) {
            $q = $filters['q'];
            $query->where(function ($sub) use ($q) {
                $sub->where('correlation_id', 'LIKE', "%{$q}%")
                    ->orWhere('ip_address', 'LIKE', "%{$q}%")
                    ->orWhere('record_id', 'LIKE', "%{$q}%")
                    ->orWhereHas('user', function ($uq) use ($q) {
                        $uq->where('username', 'LIKE', "%{$q}%")
                            ->orWhere('first_name', 'LIKE', "%{$q}%")
                            ->orWhere('last_name', 'LIKE', "%{$q}%");
                    });
            });
        }

        if (! empty($filters['user'])) {
            $userQ = $filters['user'];
            $query->whereHas('user', function ($q) use ($userQ) {
                $q->where('username', 'LIKE', "%{$userQ}%")
                    ->orWhere('first_name', 'LIKE', "%{$userQ}%")
                    ->orWhere('last_name', 'LIKE', "%{$userQ}%");
            });
        }

        if (! empty($filters['correlation'])) {
            $query->where('correlation_id', 'LIKE', "%{$filters['correlation']}%");
        }

        $query->orderByDesc('changed_at')->orderByDesc('id');

        return $query;
    }

    public static function countAccessDeniedMatchingFilters(array $filters = []): int
    {
        if (! empty($filters['action']) && $filters['action'] !== 'ACCESS_DENIED') {
            return 0;
        }

        $forDenied = $filters;
        $forDenied['action'] = 'ACCESS_DENIED';

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

        $headers = ['ID', 'Timestamp', 'Actor', 'Action', 'Target', 'Record ID', 'IP Address', 'Correlation ID', 'Old Value', 'New Value'];

        $rows = $logs->map(function ($log) {
            return [
                (string) $log->id,
                (string) $log->changed_at,
                $log->user?->username ?? 'System',
                $log->action,
                $log->target_table,
                (string) $log->record_id,
                $log->ip_address ?? 'N/A',
                $log->correlation_id ?? 'N/A',
                json_encode($log->old_value),
                json_encode($log->new_value),
            ];
        })->all();

        return ['headers' => $headers, 'rows' => $rows];
    }
}
