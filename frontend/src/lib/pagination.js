/**
 * Server-side list pagination helpers (API: { data, meta }).
 */

export const PAGINATION_DEFAULT_PER_PAGE = 25;

export const PAGINATION_PER_PAGE_OPTIONS = [10, 25, 50, 100];

export const PAGINATION_STORAGE_KEY = 'havenstay_table_per_page';

export function readStoredPerPage() {
  if (typeof window === 'undefined') return PAGINATION_DEFAULT_PER_PAGE;
  try {
    const raw = window.localStorage.getItem(PAGINATION_STORAGE_KEY);
    const n = Number.parseInt(raw, 10);
    if (PAGINATION_PER_PAGE_OPTIONS.includes(n)) return n;
  } catch {
    /* ignore */
  }
  return PAGINATION_DEFAULT_PER_PAGE;
}

export function writeStoredPerPage(n) {
  if (typeof window === 'undefined') return;
  if (PAGINATION_PER_PAGE_OPTIONS.includes(n)) {
    window.localStorage.setItem(PAGINATION_STORAGE_KEY, String(n));
  }
}

/**
 * @returns {{ rows: unknown[], meta: object|null }}
 */
export function normalizePaginatedList(body) {
  if (body?.data != null && body?.meta != null) {
    return { rows: Array.isArray(body.data) ? body.data : [], meta: body.meta };
  }
  if (Array.isArray(body)) {
    return { rows: body, meta: null };
  }
  return { rows: [], meta: null };
}

/**
 * Build query string with page, per_page, and optional extra params (skipped when null/undefined/'').
 */
export function buildPaginationQuery(page, perPage, extraParams = {}) {
  const p = new URLSearchParams();
  if (page != null) p.set('page', String(page));
  if (perPage != null) p.set('per_page', String(perPage));
  Object.entries(extraParams).forEach(([k, v]) => {
    if (v != null && v !== '') p.set(k, String(v));
  });
  const qs = p.toString();
  return qs ? `?${qs}` : '';
}

/**
 * Report JSON uses `rows` or `entries` (tenant ledger), optional `meta` when paginated.
 *
 * @param {object|null} body
 * @param {'rows'|'entries'} key
 * @returns {{ rows: unknown[], meta: object|null }}
 */
export function normalizeReportRows(body, key = 'rows') {
  if (!body || typeof body !== 'object') {
    return { rows: [], meta: null };
  }
  const list = Array.isArray(body[key]) ? body[key] : [];
  const meta =
    body.meta != null && typeof body.meta === 'object' ? body.meta : null;
  return { rows: list, meta };
}

/** Same as {@link buildPaginationQuery}; alias for report pages merging filters + page. */
export function buildReportListQuery(page, perPage, filterParams = {}) {
  return buildPaginationQuery(page, perPage, filterParams);
}
