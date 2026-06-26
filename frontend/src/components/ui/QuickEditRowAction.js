'use client';

import { Pen } from 'lucide-react';

export function QuickEditRowAction({
  onClick,
  title = 'Quick Edit',
  disabled = false,
}) {
  if (disabled) return null;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-300 hover:bg-teal-50 hover:text-teal-600 transition-colors shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
      title={title}
    >
      <Pen size={14} />
    </button>
  );
}
