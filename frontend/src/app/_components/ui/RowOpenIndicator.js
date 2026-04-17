"use client";

import { ArrowUpRight } from "lucide-react";

export default function RowOpenIndicator({ compact = false }) {
  if (compact) {
    return (
      <div
        className="inline-flex size-9 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-300 shadow-sm transition-all group-hover:border-teal-200 group-hover:bg-teal-50 group-hover:text-teal-600"
        aria-hidden
      >
        <ArrowUpRight size={16} />
      </div>
    );
  }

  return (
    <div
      className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-400 transition-[border-color,box-shadow,colors] group-hover:border-teal-200 group-hover:bg-teal-50 group-hover:text-teal-600"
      aria-hidden
    >
      <ArrowUpRight size={16} />
    </div>
  );
}
