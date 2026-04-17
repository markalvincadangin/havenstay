"use client";

import { formatPHP } from "../../../lib/formatters";

export default function CurrencyCell({ amount = 0, className = "" }) {
  return (
    <span className={`font-mono text-xs font-bold tabular-nums text-stone-700 ${className}`}>
      {formatPHP(amount ?? 0)}
    </span>
  );
}
