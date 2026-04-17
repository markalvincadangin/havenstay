"use client";

import { Card } from "./Card";

export default function FilterPanelCard({ icon: Icon, title = "Filters", children }) {
  return (
    <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
      <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/50 px-8 py-5">
        <div className="flex items-center gap-3">
          {Icon ? (
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-stone-100 text-stone-600">
              <Icon size={14} aria-hidden />
            </div>
          ) : null}
          <h2 className="hs-strip-title text-stone-400">{title}</h2>
        </div>
      </div>
      <div className="p-8">{children}</div>
    </Card>
  );
}
