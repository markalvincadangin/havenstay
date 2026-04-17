"use client";

import React from "react";
import { Card } from "./Card";

/**
 * FormSection component — standardizes card headers in forms and detail views.
 * 
 * @param {string} title - Section title (e.g. "Basic Information").
 * @param {React.ElementType} [icon] - Lucide icon component.
 * @param {React.ReactNode} [rightElement] - Optional content for the right side of the header.
 * @param {string} [className] - Optional container class.
 */
export function FormSection({ title, icon: Icon, rightElement, children, className = "" }) {
  return (
    <Card className={`!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm ${className}`}>
      <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/50 px-8 py-5">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-stone-100 text-stone-600">
              <Icon size={14} aria-hidden />
            </div>
          )}
          <h2 className="hs-strip-title text-stone-400 tracking-widest uppercase font-black text-sm">
            {title}
          </h2>
        </div>
        {rightElement}
      </div>
      <div className="p-8">
        {children}
      </div>
    </Card>
  );
}
