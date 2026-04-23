"use client";

import { formatPHP } from "@/lib/formatters";

export default function CurrencyCell({ amount, value, suffix = "", className = "" }) {
  const finalAmount = amount !== undefined ? amount : (value !== undefined ? value : 0);
  
  return (
    <span className={`font-mono text-xs font-bold tabular-nums ${finalAmount > 0 ? "text-rose-600" : "text-emerald-700"} ${className}`}>
      {formatPHP(finalAmount)}
      {suffix && <span className="ml-1 text-[10px] font-bold text-stone-400 lowercase tracking-tight">{suffix}</span>}
    </span>
  );
}
