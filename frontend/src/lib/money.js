/**
 * Parse user-entered money for PHP peso amounts (no thousands separator in DB).
 * Strips commas, trims, rounds to centavos to avoid float noise.
 *
 * @param {unknown} value
 * @returns {number} NaN if not parseable
 */
export function parseMoneyInput(value) {
  if (value === "" || value == null) return NaN;
  const normalized = String(value).trim().replace(/,/g, "");
  const n = Number(normalized);
  if (Number.isNaN(n)) return NaN;
  return Math.round(n * 100) / 100;
}
