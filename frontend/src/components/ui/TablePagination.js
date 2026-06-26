'use client';

import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import Button from './Button';
import {
  PAGINATION_PER_PAGE_OPTIONS,
  readStoredPerPage,
  writeStoredPerPage,
} from '@/lib/pagination';

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
  className = '',
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
      className={`flex flex-col gap-4 border-t border-stone-100 bg-white/50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between ${className}`}
      aria-label="Table pagination"
    >
      <p className="text-[11px] font-medium text-stone-500">
        {total > 0 ? (
          <>
            Showing{' '}
            <span className="font-mono tabular-nums text-stone-700 font-bold">
              {from}
            </span>
            –
            <span className="font-mono tabular-nums text-stone-700 font-bold">
              {to}
            </span>{' '}
            of{' '}
            <span className="font-mono tabular-nums text-stone-700 font-bold">
              {total}
            </span>
          </>
        ) : (
          'No records available'
        )}
      </p>

      <div className="flex flex-wrap items-center justify-center gap-6 sm:justify-end">
        <label className="flex items-center gap-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">
            Rows
          </span>
          <select
            value={perPage}
            disabled={disabled}
            onChange={(e) => {
              const next = Number(e.target.value);
              writeStoredPerPage(next);
              onPerPageChange(next);
            }}
            className="h-8 rounded-lg border border-stone-200 bg-white pl-2 pr-1 text-[11px] font-black text-stone-900 focus:border-teal-500/50 focus:outline-none focus:ring-4 focus:ring-teal-500/5 transition-all outline-none"
          >
            {PAGINATION_PER_PAGE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={disabled || page <= 1}
            onClick={() => onPageChange(1)}
            className="!h-8 !w-8 !p-0 shadow-sm border-stone-200 bg-white hover:bg-stone-50"
            aria-label="First page"
          >
            <ChevronsLeft size={14} strokeWidth={2.5} />
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={disabled || page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="!h-8 !w-8 !p-0 shadow-sm border-stone-200 bg-white hover:bg-stone-50"
            aria-label="Previous page"
          >
            <ChevronLeft size={14} strokeWidth={2.5} />
          </Button>

          <div className="flex h-8 items-center px-4 rounded-lg border border-stone-100 bg-stone-50/50">
            <span className="font-mono text-[11px] font-bold tabular-nums text-stone-600">
              {page} <span className="mx-1.5 text-stone-300 font-sans">/</span>{' '}
              {lastPage}
            </span>
          </div>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={disabled || page >= lastPage}
            onClick={() => onPageChange(page + 1)}
            className="!h-8 !w-8 !p-0 shadow-sm border-stone-200 bg-white hover:bg-stone-50"
            aria-label="Next page"
          >
            <ChevronRight size={14} strokeWidth={2.5} />
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={disabled || page >= lastPage}
            onClick={() => onPageChange(lastPage)}
            className="!h-8 !w-8 !p-0 shadow-sm border-stone-200 bg-white hover:bg-stone-50"
            aria-label="Last page"
          >
            <ChevronsRight size={14} strokeWidth={2.5} />
          </Button>
        </div>
      </div>
    </nav>
  );
}

export { readStoredPerPage, writeStoredPerPage };
