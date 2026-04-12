"use client";

import Button from "./Button";
import {
  PAGINATION_PER_PAGE_OPTIONS,
  readStoredPerPage,
  writeStoredPerPage,
} from "@/lib/pagination";

/**
 * @param {{
 *   meta: { current_page: number, last_page: number, per_page: number, total: number, from: number|null, to: number|null } | null,
 *   page: number,
 *   perPage: number,
 *   onPageChange: (page: number) => void,
 *   onPerPageChange: (perPage: number) => void,
 *   disabled?: boolean,
 *   className?: string,
 * }} props
 */
export default function TablePagination({
  meta,
  page,
  perPage,
  onPageChange,
  onPerPageChange,
  disabled = false,
  className = "",
}) {
  if (!meta || meta.total === 0) {
    return null;
  }

  const lastPage = Math.max(1, meta.last_page || 1);
  const from = meta.from ?? 0;
  const to = meta.to ?? 0;
  const total = meta.total ?? 0;

  return (
    <nav
      className={`flex flex-col gap-3 border-t border-stone-100 bg-stone-50/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 ${className}`}
      aria-label="Table pagination"
    >
      <p className="text-center text-[11px] font-medium text-stone-500 sm:text-left">
        {total > 0 ? (
          <>
            Showing{" "}
            <span className="font-mono tabular-nums text-stone-700">{from}</span>
            –
            <span className="font-mono tabular-nums text-stone-700">{to}</span> of{" "}
            <span className="font-mono tabular-nums text-stone-700">{total}</span>
          </>
        ) : (
          "No rows"
        )}
      </p>

      <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-end">
        <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-stone-400">
          Rows
          <select
            value={perPage}
            disabled={disabled}
            onChange={(e) => {
              const next = Number(e.target.value);
              writeStoredPerPage(next);
              onPerPageChange(next);
            }}
            className="h-9 rounded-lg border border-stone-200 bg-white px-2 text-xs font-bold text-stone-800 focus:border-teal-500/50 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          >
            {PAGINATION_PER_PAGE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={disabled || page <= 1}
            onClick={() => onPageChange(1)}
            className="!h-9 !min-w-[2.25rem] px-2 text-[10px] font-bold"
            aria-label="First page"
          >
            «
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={disabled || page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="!h-9 !min-w-[2.25rem] px-2 text-[10px] font-bold"
            aria-label="Previous page"
          >
            ‹
          </Button>
          <span className="px-2 font-mono text-[11px] tabular-nums text-stone-600">
            {page} / {lastPage}
          </span>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={disabled || page >= lastPage}
            onClick={() => onPageChange(page + 1)}
            className="!h-9 !min-w-[2.25rem] px-2 text-[10px] font-bold"
            aria-label="Next page"
          >
            ›
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={disabled || page >= lastPage}
            onClick={() => onPageChange(lastPage)}
            className="!h-9 !min-w-[2.25rem] px-2 text-[10px] font-bold"
            aria-label="Last page"
          >
            »
          </Button>
        </div>
      </div>
    </nav>
  );
}

export { readStoredPerPage, writeStoredPerPage };
