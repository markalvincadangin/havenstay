"use client";

import { useCallback, useState } from "react";

/**
 * Client-side table sort state: toggle asc/desc on the same column; switch column resets to asc.
 *
 * @returns {{ sortColumn: string | null, sortDirection: 'asc' | 'desc', onSortChange: (key: string) => void }}
 */
export function useTableSort() {
  const [state, setState] = useState({ column: null, direction: "asc" });

  const onSortChange = useCallback((key) => {
    setState((prev) => {
      if (prev.column !== key) {
        return { column: key, direction: "asc" };
      }
      return {
        column: key,
        direction: prev.direction === "asc" ? "desc" : "asc",
      };
    });
  }, []);

  return { 
    sortColumn: state.column, 
    sortDirection: state.direction, 
    onSortChange 
  };
}
