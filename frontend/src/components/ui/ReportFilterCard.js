"use client";

import { Search } from "lucide-react";
import Button from "./Button";
import { Card } from "./Card";

export default function ReportFilterCard({
  title = "Filters",
  onRefresh,
  refreshDisabled = false,
  children,
}) {
  return (
    <Card className="mt-8 overflow-hidden border-stone-200 !p-0 shadow-sm rounded-2xl bg-white">
      <div className="border-b border-stone-100 bg-stone-50/50 px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50 text-teal-600 shadow-sm border border-teal-100/50">
            <Search size={14} />
          </div>
          <h3 className="hs-strip-title uppercase tracking-widest text-xs font-black text-stone-900">{title}</h3>
        </div>
        <Button
          type="button"
          variant="ghost"
          onClick={onRefresh}
          disabled={refreshDisabled}
          className="!h-8 px-3 text-[10px] font-bold uppercase tracking-widest text-stone-400 hover:text-teal-600"
        >
          Refresh
        </Button>
      </div>
      <div className="p-8">{children}</div>
    </Card>
  );
}
