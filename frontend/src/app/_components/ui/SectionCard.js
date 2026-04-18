"use client";

import { Card } from "./Card";

export default function SectionCard({
  title,
  icon: Icon = null,
  iconClassName = "bg-stone-100 text-stone-600",
  rightElement = null,
  children,
  bodyClassName = "p-8",
  titleSize = "sm",
  titleClassName = null,
}) {
  const titleClasses =
    titleClassName ||
    (titleSize === "xs"
      ? "hs-strip-title text-stone-400 tracking-[0.2em] uppercase font-black text-[10px]"
      : "hs-strip-title text-stone-400 tracking-[0.2em] uppercase font-black text-[10px]");

  return (
    <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
      <div className="flex items-center justify-between border-b border-stone-100 bg-white px-8 py-5">
        <div className="flex items-center gap-2.5">
          {Icon ? (
            <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${iconClassName}`}>
              <Icon size={14} aria-hidden />
            </div>
          ) : null}
          <h2 className={titleClasses}>{title}</h2>
        </div>
        {rightElement}
      </div>
      <div className={bodyClassName}>{children}</div>
    </Card>
  );
}
