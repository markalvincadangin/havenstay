/** @param {string|number|null|undefined} s */
function parseTime(s) {
  if (s == null || s === '') return null;
  const t = Date.parse(String(s));
  return Number.isNaN(t) ? null : t;
}

/**
 * Stable client-side sort for registry rows (strings, numbers, dates as ISO strings).
 *
 * @template T
 * @param {T[]} items
 * @param {string | null} sortKey
 * @param {'asc' | 'desc' | null} direction
 * @param {(row: T) => string | number | null | undefined} getValue
 * @returns {T[]}
 */
export function sortClientRows(items, sortKey, direction, getValue) {
  if (!sortKey || !direction || typeof getValue !== 'function') {
    return items;
  }
  const dir = direction === 'asc' ? 1 : -1;
  const list = [...items];
  list.sort((a, b) => {
    const va = getValue(a);
    const vb = getValue(b);
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    if (typeof va === 'number' && typeof vb === 'number') {
      return (va - vb) * dir;
    }
    const na = Number(va);
    const nb = Number(vb);
    if (
      !Number.isNaN(na) &&
      !Number.isNaN(nb) &&
      String(va).trim() !== '' &&
      String(vb).trim() !== ''
    ) {
      return (na - nb) * dir;
    }
    const ta = parseTime(va);
    const tb = parseTime(vb);
    if (ta != null && tb != null) {
      return (ta - tb) * dir;
    }
    return (
      String(va).localeCompare(String(vb), undefined, {
        numeric: true,
        sensitivity: 'base',
      }) * dir
    );
  });
  return list;
}
