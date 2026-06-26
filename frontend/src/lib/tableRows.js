/**
 * Standard utility classes and helpers for interactive table rows.
 * Aligned to MASTER.md v6.6.0 Command Center aesthetic.
 */

/**
 * Standard hover and click-state classes for registry table rows.
 * Features: item highlight (stone-50), pointer cursor, and transition smoothing.
 */
export const interactiveTableRowClass =
  'group cursor-pointer hover:bg-stone-50/80 transition-colors border-b border-stone-100 last:border-b-0';

/**
 * Prevents the parent row's onClick event from firing when a child element (link/button) is clicked.
 * Essential for "Action" columns within interactive registry rows.
 *
 * @param {import('react').MouseEvent} e
 */
export function stopRowClick(e) {
  if (e && typeof e.stopPropagation === 'function') {
    e.stopPropagation();
  }
}
