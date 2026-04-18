"use client";

import { formatPHP } from "../../../lib/formatters";

export default function CurrencyCell({ amount = 0, className = "" }) {
  return (
    <span className={`font-mono text-xs font-bold tabular-nums ${amount > 0 ? "text-rose-600" : "text-emerald-700"} ${className}`}>
      {formatPHP(amount ?? 0)}
    </span>
  );
}
