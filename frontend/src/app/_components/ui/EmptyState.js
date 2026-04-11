"use client";

import React from "react";
import { Search } from "lucide-react";
import { Card } from "./Card";

/**
 * EmptyState Component
 * 
 * Consistent pattern for filtered registries or empty modules.
 */
export default function EmptyState({ 
  icon: Icon = Search, 
  title = "No results found", 
  message = "Try adjusting your filters or search terms to find what you're looking for.",
  action
}) {
  return (
    <Card className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-stone-200 bg-stone-50/30 py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-stone-100 bg-stone-50 text-stone-300 shadow-sm">
        <Icon size={28} aria-hidden />
      </div>
      <h3 className="text-sm font-bold text-stone-900">{title}</h3>
      <p className="mt-2 max-w-sm text-xs font-medium text-stone-500 leading-relaxed">
        {message}
      </p>
      {action && (
        <div className="mt-6">
          {action}
        </div>
      )}
    </Card>
  );
}
