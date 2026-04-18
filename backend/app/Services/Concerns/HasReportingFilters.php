<?php

namespace App\Services\Concerns;

use Illuminate\Database\Eloquent\Builder as EloquentBuilder;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Support\Carbon;

/**
 * HasReportingFilters
 * 
 * Shared logic for applying standardized date ranges and search filters
 * to reporting and logging services.
 */
trait HasReportingFilters
{
    /**
     * Apply date range filtering to a query builder.
     */
    protected static function applyDateFilters(EloquentBuilder|QueryBuilder $query, array $filters, string $column, string $startKey = 'from', string $endKey = 'to'): void
    {
        if (! empty($filters[$startKey]) && ! empty($filters[$endKey])) {
            $query->whereBetween($column, [$filters[$startKey], $filters[$endKey]]);
        } elseif (! empty($filters[$startKey])) {
            $query->where($column, '>=', $filters[$startKey]);
        } elseif (! empty($filters[$endKey])) {
            $query->where($column, '<=', $filters[$endKey]);
        }
    }

    /**
     * Apply "Current Month" date range if no specific dates are provided.
     */
    protected static function applyCurrentMonthDefault(EloquentBuilder|QueryBuilder $query, array $filters, string $column): void
    {
        $currentMonthOnly = (bool) ($filters['current_month'] ?? false);
        
        if ($currentMonthOnly && empty($filters['start_date']) && empty($filters['end_date'])) {
            $start = Carbon::now()->startOfMonth()->toDateString();
            $end = Carbon::now()->endOfMonth()->toDateString();
            $query->whereBetween($column, [$start, $end]);
        }
    }

    /**
     * Standardize the flattened user context for paginated logs.
     */
    protected static function attachUserContext($collection): void
    {
        $collection->transform(function ($item) {
            $item->user_username = $item->user?->username ?? 'system';
            $item->user_first_name = $item->user?->first_name;
            $item->user_last_name = $item->user?->last_name;
            return $item;
        });
    }
}
