'use client';

import CurrencyDisplay from '@/components/ui/CurrencyDisplay';

/**
 * MetricItem — A standardized vertical metric display for profile sidebars.
 * Used in Rooms, Tenants, and other detail profiles.
 *
 * @param {string} label - Top-level metric name (e.g. "Monthly Rent").
 * @param {string|number} value - The primary metric.
 * @param {React.ElementType} [icon] - Lucide icon component.
 * @param {boolean} [currency] - If true, renders value using CurrencyDisplay.
 */
export default function MetricItem({
  label,
  value,
  icon: Icon,
  currency = false,
  className = '',
}) {
  return (
    <div
      className={`flex items-center gap-4 border-b border-stone-100 py-4 last:border-0 hover:bg-stone-50/30 transition-colors ${className}`}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-stone-50 text-stone-400 border border-white/60 shadow-sm">
        {Icon && <Icon size={18} strokeWidth={2.5} aria-hidden />}
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">
          {label}
        </p>
        <div className="text-sm font-black tabular-nums text-stone-900">
          {currency ? <CurrencyDisplay amount={value} /> : value}
        </div>
      </div>
    </div>
  );
}
