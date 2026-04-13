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
  error = null,
  isDanger = false 
}) {
  const shouldReduceMotion = useReducedMotion();

  // 1. Loading State (Skeleton)
  if (isLoading) {
    return (
      <div className="h-[120px] w-full animate-pulse rounded-2xl border border-stone-100 bg-stone-50/30 shadow-sm" />
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
    <div className="group relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-stone-200 bg-white p-6 shadow-sm transition-all duration-300 hover:border-teal-500/50 hover:shadow-lg hover:shadow-teal-900/5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">
            {label}
          </p>
          <h3 className={[
            "mt-1 truncate text-2xl font-black tracking-tight sm:text-3xl tabular-nums transition-colors",
            isDanger ? "text-red-600" : "text-stone-900 group-hover:text-teal-700"
          ].join(" ")}>
            {value}
          </h3>
          {sub && (
            <div className="mt-1 font-mono text-[10px] font-bold uppercase tracking-tighter tabular-nums text-stone-400">
              {sub}
            </div>
          )}
        </div>

        {Icon && (
          <div
            className={[
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-[box-shadow,border-color] duration-300",
              isDanger ? "bg-red-50 text-red-500" : "bg-teal-50 text-teal-600"
            ].join(" ")}
          >
            <Icon size={18} strokeWidth={2.5} />
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
