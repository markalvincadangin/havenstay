"use client";

import React from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";

/**
 * KpiCard component — quantitative summary surface.
 * Aligned to design-system/havenstay/MASTER.md Section 19.
 * 
 * @param {string} label - Top-level metric name (e.g. "Bed Occupancy").
 * @param {string|number} value - The primary metric (e.g. "95%").
 * @param {string} [sub] - Secondary detail (e.g. "10 vacant beds").
 * @param {React.ElementType} [icon] - Lucide icon component.
 * @param {string} [href] - Optional link destination.
 * @param {number} [progress] - Optional percentage for progress bar (0-100).
 * @param {boolean} [isLoading] - Shows pulse skeleton state.
 * @param {string|null} [error] - Error message to display.
 * @param {boolean} [isDanger] - Applies red-600 treatment to value and icon well.
 */
export function KpiCard({ 
  label, 
  value, 
  sub, 
  icon: Icon, 
  href, 
  progress, 
  isLoading = false, 
  isSyncing = false,
  error = null,
  isDanger = false,
  isSuccess = false,
  isWarning = false,
  sparkline: SparklineComponent = null
}) {
  const shouldReduceMotion = useReducedMotion();

  // 1. Loading State (Skeleton)
  if (isLoading) {
    return (
      <div className="flex h-32 w-full flex-col justify-between rounded-2xl border border-stone-100 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="h-2.5 w-16 animate-pulse rounded bg-stone-100" />
            <div className="h-8 w-24 animate-pulse rounded-lg bg-stone-50" />
          </div>
          <div className="h-10 w-10 animate-pulse rounded-xl bg-stone-50" />
        </div>
        <div className="h-1.5 w-full animate-pulse rounded-full bg-stone-50" />
      </div>
    );
  }

  // 2. Error State (Graceful Failure)
  if (error) {
    return (
      <div className="flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-red-100 bg-red-50/30 p-6 shadow-sm">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-red-300">
            {label}
          </p>
          <h3 className="mt-1 text-lg font-bold text-red-600">
            Could not load
          </h3>
          <p className="mt-1 text-[10px] font-medium text-red-400">
            Connection error or invalid data.
          </p>
        </div>
      </div>
    );
  }

  const inner = (
    <div className={[
      "group relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-stone-200 bg-white p-6 shadow-sm transition-all duration-300",
      href ? "hover:border-teal-200 hover:shadow-lg hover:-translate-y-1" : ""
    ].join(" ")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">
            {label}
          </p>
          <motion.h3 
            animate={isSyncing ? { opacity: [1, 0.4, 1] } : { opacity: 1 }}
            transition={isSyncing ? { repeat: Infinity, duration: 1.5, ease: "easeInOut" } : {}}
            className={[
              "mt-1 text-2xl font-mono font-black tracking-tight tabular-nums sm:text-2xl break-words leading-none",
              isDanger ? "text-red-600" : isSuccess ? "text-emerald-700" : isWarning ? "text-amber-700" : "text-stone-900"
            ].join(" ")}
          >
            {value}
          </motion.h3>
          {sub && (
            <div className="mt-1 font-mono text-[9px] font-bold uppercase tracking-widest tabular-nums text-stone-400">
              {sub}
            </div>
          )}
        </div>

        {Icon && (
          <div className="flex flex-col items-end justify-between self-stretch">
            <div
              className={[
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/60 shadow-sm transition-[box-shadow,border-color] duration-300",
                isDanger ? "bg-red-50 text-red-500" : isSuccess ? "bg-emerald-50 text-emerald-600" : isWarning ? "bg-amber-50 text-amber-600" : "bg-teal-50 text-teal-600"
              ].join(" ")}
            >
              <Icon size={18} strokeWidth={2.5} />
            </div>
            {SparklineComponent && <div className="mt-auto hidden sm:block">{SparklineComponent}</div>}
          </div>
        )}
      </div>

      {progress !== undefined && (
        <div className="mt-4">
          <div className="h-1 w-full overflow-hidden rounded-full bg-stone-100">
            <motion.div
              className="h-full bg-teal-500"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, progress)}%` }}
              transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
        </div>
      )}
    </div>
  );

  return href ? (
    <Link href={href} className="block h-full">
      {inner}
    </Link>
  ) : (
    <div className="h-full">{inner}</div>
  );
}
