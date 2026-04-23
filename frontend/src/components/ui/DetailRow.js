"use client";

/**
 * DetailRow — A standardized horizontal key-value row for identity sections.
 * Used in Tenant and Room detail profiles.
 */
export default function DetailRow({ label, value, icon: Icon, mono = false, className = "" }) {
  return (
    <div className={`flex items-start justify-between py-3.5 border-b border-stone-50 last:border-0 hover:bg-stone-50/50 transition-colors ${className}`}>
      <div className="flex items-center gap-2.5">
        <div className="text-stone-300">
          {Icon && <Icon size={14} strokeWidth={2.5} />}
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">{label}</span>
      </div>
      <span className={`text-sm font-semibold text-stone-900 text-right max-w-[200px] leading-snug ${mono ? 'font-mono tabular-nums tracking-tight' : ''}`}>
        {value || "—"}
      </span>
    </div>
  );
}
