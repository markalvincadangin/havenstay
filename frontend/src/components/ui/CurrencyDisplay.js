/**
 * CurrencyDisplay — uniform Philippine Peso rendering.
 *
 * Renders the peso sign (₱) using the standard interface font (font-sans)
 * to avoid bloated monospace fallbacks, while keeping the digits perfectly
 * aligned using font-mono and tabular-nums.
 */
"use client";

export default function CurrencyDisplay({ amount, className = "" }) {
  const num = Number(amount);

  if (amount == null || isNaN(num)) {
    return <span className={`font-mono tabular-nums ${className}`}>—</span>;
  }

  const formatted = new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);

  return (
    <span className={`whitespace-nowrap ${className}`}>
      <span className="font-sans font-medium pr-[2px]">₱</span>
      <span className="font-mono tabular-nums tracking-tight">{formatted}</span>
    </span>
  );
}
