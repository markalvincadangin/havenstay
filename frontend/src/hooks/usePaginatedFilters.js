import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  buildPaginationQuery,
  readStoredPerPage,
  writeStoredPerPage,
} from '@/lib/pagination';

export function usePaginatedFilters({
  initialFilters,
  initialSort = { by: 'id', dir: 'desc' },
  debounceKeys = [],
  debounceMs = 300,
  buildExtraParams,
}) {
  const [filters, setFilters] = useState(initialFilters);
  const [sort, setSort] = useState(initialSort);
  const [page, setPage] = useState(1);
  const [perPageState, setPerPageState] = useState(() => readStoredPerPage());

  const [debouncedValues, setDebouncedValues] = useState(() =>
    debounceKeys.reduce(
      (acc, key) => ({ ...acc, [key]: initialFilters[key] }),
      {}
    )
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValues(
        debounceKeys.reduce((acc, key) => ({ ...acc, [key]: filters[key] }), {})
      );
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [debounceKeys, debounceMs, filters]);

  const perPage = perPageState;
  const setPerPage = useCallback((next) => {
    setPerPageState(next);
    writeStoredPerPage(next);
  }, []);

  const updateFilter = useCallback(
    (key, value, options = { resetPage: true }) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
      if (options.resetPage !== false) setPage(1);
    },
    []
  );

  const onSortChange = useCallback((by, dir) => {
    setSort((prev) => {
      // If dir is explicitly provided (e.g. from a select dropdown), use it.
      // Otherwise, toggle direction if the same column is clicked, or reset to 'asc'.
      const finalDir =
        dir || (prev.by === by && prev.dir === 'asc' ? 'desc' : 'asc');
      return { by, dir: finalDir };
    });
    setPage(1);
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(initialFilters);
    setSort(initialSort);
    setPage(1);
  }, [initialFilters, initialSort]);

  const queryString = useMemo(() => {
    const extra =
      typeof buildExtraParams === 'function'
        ? buildExtraParams({ filters, debounced: debouncedValues })
        : { ...filters, ...debouncedValues };

    // Inject sorting
    extra.sort_by = sort.by;
    extra.sort_dir = sort.dir;

    return buildPaginationQuery(page, perPage, extra);
  }, [
    buildExtraParams,
    debouncedValues,
    filters,
    page,
    perPage,
    sort.by,
    sort.dir,
  ]);

  return {
    filters,
    setFilters,
    updateFilter,
    resetFilters,
    sort,
    setSort,
    onSortChange,
    page,
    setPage,
    perPage,
    setPerPage,
    queryString,
  };
}
