<?php

namespace App\Services\Analytics;

use App\Models\AuditLog;
use App\Services\Concerns\HasReportingFilters;
use App\Support\OperationalHardening;
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
            $needle = trim((string) $filters['q']);
            $forensicId = OperationalHardening::parseForensicId($needle);

            $query->where(function ($sub) use ($needle, $forensicId) {
                if ($forensicId) {
                    $sub->where('audit_logs.id', $forensicId);
                } else {
                    $stripped = ltrim($needle, '#');
                    $sub->where('correlation_id', 'LIKE', "%{$stripped}%")
                        ->orWhere('ip_address', 'LIKE', "%{$stripped}%")
                        ->orWhere('record_id', 'LIKE', "%{$stripped}%")
                        ->orWhere('audit_logs.id', 'LIKE', "%{$stripped}%")
                        ->orWhereHas('user', function ($uq) use ($stripped) {
                            $uq->where('username', 'LIKE', "%{$stripped}%")
                                ->orWhere('first_name', 'LIKE', "%{$stripped}%")
                                ->orWhere('last_name', 'LIKE', "%{$stripped}%");
                        });
                }
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
        $query = self::auditLogsFilteredQuery($filters);
        
        $sortByRaw = $filters['sort_by'] ?? null;
        $sortDir = $filters['sort_dir'] ?? 'desc';
        
        if ($sortByRaw === 'audit_id') {
            $query->orderBy('audit_logs.id', $sortDir);
        } elseif ($sortByRaw === 'timestamp') {
            $query->orderBy('changed_at', $sortDir)->orderBy('audit_logs.id', $sortDir);
        } elseif ($sortByRaw === 'category') {
            $query->orderBy('event_category', $sortDir)->orderBy('audit_logs.id', $sortDir);
        } elseif ($sortByRaw === 'actor') {
            $query->leftJoin('users', 'audit_logs.changed_by', '=', 'users.user_id')
                  ->orderBy('users.username', $sortDir)
                  ->orderBy('audit_logs.id', $sortDir)
                  ->select('audit_logs.*');
        } elseif ($sortByRaw === 'action') {
            $query->orderBy('action', $sortDir)->orderBy('audit_logs.id', $sortDir);
        } elseif ($sortByRaw === 'status') {
            $query->orderBy('is_success', $sortDir)->orderBy('audit_logs.id', $sortDir);
        } elseif ($sortByRaw === 'resource') {
            $query->orderBy('target_table', $sortDir)->orderBy('audit_logs.id', $sortDir);
        } elseif ($sortByRaw === 'record_id') {
            $query->orderBy('record_id', $sortDir)->orderBy('audit_logs.id', $sortDir);
        } elseif ($sortByRaw === 'correlation') {
            $query->orderBy('correlation_id', $sortDir)->orderBy('audit_logs.id', $sortDir);
        } else {
            $query->orderByDesc('changed_at')->orderByDesc('audit_logs.id');
        }

        $paginator = $query->paginate($perPage, ['*'], 'page', $page);
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
