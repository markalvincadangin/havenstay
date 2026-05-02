"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, History } from "lucide-react";

/** Truncate UUID for dense tables (first 8 + last 4). */
export function truncateCorrelationId(value, head = 8, tail = 4) {
  if (value == null || typeof value !== "string") return "";
  const v = value.trim();
  if (!v) return "";
  if (v.length <= head + tail + 1) return v;
  return `${v.slice(0, head)}…${v.slice(-tail)}`;
}

/**
 * `correlation_id` from the API: mono display, optional truncation, copy, and pivot-link to audit logs.
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
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  if (value == null || String(value).trim() === "") {
    return null;
  }

  const str = String(value).trim();
  const display = preferFull ? str : truncateCorrelationId(str);
  const auditPrefix = "#AUDIT-";

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

  const onPivot = (e) => {
    e.stopPropagation();
    router.push(`/admin/audit-logs?correlation_id=${str}`);
  };

  const variantClasses = variant === 'amber'
    ? "bg-amber-50/90 text-amber-900 border-amber-200/60 shadow-[0_1px_2px_rgba(245,158,11,0.05)]"
    : "bg-teal-50/90 text-teal-900 border-teal-200/60 shadow-[0_1px_2px_rgba(13,148,136,0.05)]";

  const btnClasses = variant === 'amber'
    ? "text-amber-500 hover:bg-amber-100 hover:text-amber-700 focus-visible:outline-amber-500"
    : "text-teal-500 hover:bg-teal-100/80 hover:text-teal-700 focus-visible:outline-teal-500";

  const inner = (
    <>
      <span
        className={`font-mono text-[10px] font-bold tabular-nums tracking-tight ${preferFull ? "break-all" : "max-w-[12rem] truncate"}`}
        title={`Audit Reference ID: ${str}`}
      >
        <span className="opacity-40 font-black mr-0.5">{auditPrefix}</span>
        {display.toUpperCase()}
      </span>
      <div className="flex items-center gap-0.5 ml-1 border-l border-current/10 pl-1">
        <button
          type="button"
          onClick={onPivot}
          className={`shrink-0 rounded-md p-1 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 ${btnClasses}`}
          title="View Forensic Audit Log"
          aria-label="View Audit Log"
        >
          <History size={11} aria-hidden />
        </button>
        <button
          type="button"
          onClick={onCopy}
          className={`shrink-0 rounded-md p-1 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 ${btnClasses}`}
          title="Copy Reference ID"
          aria-label="Copy correlation ID"
        >
          {copied ? <Check size={11} className={variant === 'amber' ? "text-amber-600" : "text-teal-600"} aria-hidden /> : <Copy size={11} aria-hidden />}
        </button>
      </div>
      <span className="sr-only" aria-live="polite">
        {copied ? "Workflow ID copied to clipboard." : ""}
      </span>
    </>
  );

  if (chip && !preferFull) {
    return (
      <div
        className={`inline-flex max-w-full min-w-0 items-center gap-0.5 rounded-lg border px-1.5 py-0.5 hs-correlation-chip group/chip ${variantClasses} ${className}`}
      >
        {inner}
      </div>
    );
  }

  return <div className={`flex min-w-0 items-center gap-1 ${className}`}>{inner}</div>;
}

