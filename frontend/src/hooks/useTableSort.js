"use client";

import { useCallback, useState } from "react";

/**
 * Client-side table sort state: toggle asc/desc on the same column; switch column resets to asc.
 *
 * @returns {{ sortColumn: string | null, sortDirection: 'asc' | 'desc', onSortChange: (key: string) => void }}
 */
export function useTableSort() {
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState("asc");

  const onSortChange = useCallback((key) => {
    setSortColumn((prev) => {
      if (prev !== key) {
        setSortDirection("asc");
        return key;
      }
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
      return prev;
    });
  }, []);

  return { sortColumn, sortDirection, onSortChange };
}
