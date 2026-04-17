"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** Truncate UUID for dense tables (first 8 + last 4). */
export function truncateCorrelationId(value, head = 8, tail = 4) {
  if (value == null || typeof value !== "string") return "";
  const v = value.trim();
  if (!v) return "";
  if (v.length <= head + tail + 1) return v;
  return `${v.slice(0, head)}…${v.slice(-tail)}`;
}

/**
 * `correlation_id` from the API: mono display, optional truncation, copy (stops row click propagation).
 * @param {{ 
 *   value?: string | null, 
 *   preferFull?: boolean, 
 *   className?: string, 
 *   chip?: boolean,
 *   variant?: 'teal' | 'amber'
 * }} props
 */
export function CorrelationIdCell({ 
  value, 
  preferFull = false, 
  className = "", 
  chip = true,
  variant = "teal" 
}) {
  const [copied, setCopied] = useState(false);

  if (value == null || String(value).trim() === "") {
    return (
      <span
        className={`inline-block text-stone-400 font-medium ${className}`}
        title="No correlation ID on this row."
      >
        —
      </span>
    );
  }

  const str = String(value).trim();
  const display = preferFull ? str : truncateCorrelationId(str);

  const onCopy = async (e) => {
    e.stopPropagation();
    try {
      if (typeof window !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(str);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      /* clipboard may be denied */
    }
  };

  const variantClasses = variant === 'amber' 
    ? "bg-amber-50/90 text-amber-900 border-amber-200/60" 
    : "bg-teal-50/90 text-teal-900 border-teal-200/60";

  const btnClasses = variant === 'amber'
    ? "text-amber-500 hover:bg-amber-100 hover:text-amber-700 focus-visible:outline-amber-500"
    : "text-teal-500 hover:bg-teal-100/80 hover:text-teal-700 focus-visible:outline-teal-500";

  const inner = (
    <>
      <span
        className={`font-mono text-[10px] font-bold tabular-nums ${preferFull ? "break-all" : "max-w-[9rem] truncate"}`}
        title={str}
      >
        {display}
      </span>
      <button
        type="button"
        onClick={onCopy}
        className={`shrink-0 rounded-md p-1.5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 ${btnClasses}`}
        aria-label="Copy correlation ID"
      >
        {copied ? <Check size={12} className={variant === 'amber' ? "text-amber-600" : "text-teal-600"} aria-hidden /> : <Copy size={12} aria-hidden />}
      </button>
      <span className="sr-only" aria-live="polite">
        {copied ? "Correlation ID copied to clipboard." : ""}
      </span>
    </>
  );

  if (chip && !preferFull) {
    return (
      <div
        className={`inline-flex max-w-full min-w-0 items-center gap-0.5 rounded-lg border px-1.5 py-0.5 shadow-sm hs-correlation-chip ${variantClasses} ${className}`}
        title="Correlation ID"
      >
        {inner}
      </div>
    );
  }

  return <div className={`flex min-w-0 items-center gap-1 ${className}`}>{inner}</div>;
}
