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
 * @param {{ value?: string | null, preferFull?: boolean, className?: string, chip?: boolean }} props
 */
export function CorrelationIdCell({ value, preferFull = false, className = "", chip = true }) {
  const [copied, setCopied] = useState(false);

  if (value == null || String(value).trim() === "") {
    return (
      <span
        className={`inline-block text-stone-400 ${className}`}
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
      await navigator.clipboard.writeText(str);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard may be denied */
    }
  };

  const inner = (
    <>
      <span
        className={`font-mono text-[10px] font-medium tabular-nums text-stone-700 ${preferFull ? "break-all" : "max-w-[9rem] truncate"}`}
        title={str}
      >
        {display}
      </span>
      <button
        type="button"
        onClick={onCopy}
        className="shrink-0 rounded-md p-1.5 text-stone-500 transition-colors hover:bg-white/80 hover:text-teal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-teal-500"
        aria-label="Copy correlation ID"
      >
        {copied ? <Check size={12} className="text-teal-600" aria-hidden /> : <Copy size={12} aria-hidden />}
      </button>
      <span className="sr-only" aria-live="polite">
        {copied ? "Correlation ID copied to clipboard." : ""}
      </span>
    </>
  );

  if (chip && !preferFull) {
    return (
      <div
        className={`inline-flex max-w-full min-w-0 items-center gap-0.5 rounded-lg border border-teal-200/60 bg-teal-50/90 px-1.5 py-1 shadow-sm ${className}`}
        title="Correlation ID"
      >
        {inner}
      </div>
    );
  }

  return <div className={`flex min-w-0 items-center gap-1 ${className}`}>{inner}</div>;
}
