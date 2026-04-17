import { useCallback, useEffect, useMemo, useState } from "react";
import { buildPaginationQuery, readStoredPerPage, writeStoredPerPage } from "../lib/pagination";

export function usePaginatedFilters({
  initialFilters,
  debounceKeys = [],
  debounceMs = 300,
  buildExtraParams,
}) {
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const [perPageState, setPerPageState] = useState(() => readStoredPerPage());

  const [debouncedValues, setDebouncedValues] = useState(() =>
    debounceKeys.reduce((acc, key) => ({ ...acc, [key]: initialFilters[key] }), {})
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

  const updateFilter = useCallback((key, value, options = { resetPage: true }) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    if (options.resetPage !== false) setPage(1);
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(initialFilters);
    setPage(1);
  }, [initialFilters]);

  const queryString = useMemo(() => {
    const extra = buildExtraParams({ filters, debounced: debouncedValues });
    return buildPaginationQuery(page, perPage, extra);
  }, [buildExtraParams, debouncedValues, filters, page, perPage]);

  return {
    filters,
    setFilters,
    updateFilter,
    resetFilters,
    page,
    setPage,
    perPage,
    setPerPage,
    queryString,
  };
}
