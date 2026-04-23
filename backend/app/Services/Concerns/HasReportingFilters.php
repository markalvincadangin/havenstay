<?php

namespace App\Services\Concerns;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * HasReportingFilters
 *
 * Provides standardized query filtering for analytics and forensic reports.
 * Enforces uniform date range handling and keyword searching across services.
 */
trait HasReportingFilters
{
    /**
     * Apply standard date range filters to a query.
     */
    public static function applyDateRange(Builder|QueryBuilder $query, array $filters, string $column = 'created_at'): Builder|QueryBuilder
    {
        if (!empty($filters['start_date'])) {
            $query->whereDate($column, '>=', Carbon::parse($filters['start_date']));
        }

        if (!empty($filters['end_date'])) {
            $query->whereDate($column, '<=', Carbon::parse($filters['end_date']));
        }

        if (!empty($filters['from'])) {
            $query->whereDate($column, '>=', Carbon::parse($filters['from']));
        }

        if (!empty($filters['to'])) {
            $query->whereDate($column, '<=', Carbon::parse($filters['to']));
        }

        if (!empty($filters['due_from'])) {
            $query->whereDate($column, '>=', Carbon::parse($filters['due_from']));
        }

        if (!empty($filters['due_to'])) {
            $query->whereDate($column, '<=', Carbon::parse($filters['due_to']));
        }

        return $query;
    }

    /**
     * Apply a fuzzy keyword search across specified columns.
     */
    public static function applySearch(Builder|QueryBuilder $query, ?string $keyword, array $columns): Builder|QueryBuilder
    {
        if (empty($keyword)) {
            return $query;
        }

        $keyword = strtolower(trim($keyword));

        return $query->where(function (Builder|QueryBuilder $q) use ($keyword, $columns) {
            foreach ($columns as $column) {
                $q->orWhereRaw("LOWER({$column}) LIKE ?", ["%{$keyword}%"]);
            }
        });
    }

    /**
     * Apply status filtering if present in the filter array.
     */
    public static function applyStatus(Builder|QueryBuilder $query, array $filters, string $column = 'status'): Builder|QueryBuilder
    {
        if (!empty($filters['status']) && $filters['status'] !== 'all') {
            $query->where($column, $filters['status']);
        }

        return $query;
    }

    /**
     * Decorate a collection of log results with actor information.
     * Standardizes 'actor_name' field across audit and transaction logs.
     */
    public static function attachUserContext(Collection $collection): void
    {
        $collection->each(function ($item) {
            if ($item->user) {
                $user = $item->user;
                $item->actor_name = "{$user->first_name} {$user->last_name} ({$user->username})";
            } elseif (isset($item->changed_by) && $item->changed_by === null) {
                $item->actor_name = 'System';
            } elseif (isset($item->initiated_by) && $item->initiated_by === null) {
                $item->actor_name = 'System';
            } else {
                $item->actor_name = 'Unknown Actor';
            }
        });
    }
}
