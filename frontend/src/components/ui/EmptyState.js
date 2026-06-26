'use client';

import React from 'react';
import { Search } from 'lucide-react';
import { Card } from './Card';

/**
 * EmptyState Component
 *
 * Consistent pattern for filtered registries or empty modules.
 */
export default function EmptyState({
  icon: Icon = Search,
  title = 'No results found',
  description = 'Try adjusting your filters or refine your search to find the record you need.',
  action,
  variant = 'default',
  className = '',
}) {
  const isCompact = variant === 'compact';

  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${isCompact ? 'py-10 px-6' : 'rounded-2xl border border-dashed border-stone-200 bg-stone-50/30 py-16'} ${className}`}
    >
      <div
        className={`flex items-center justify-center rounded-full border border-stone-100 bg-stone-50 text-stone-300 shadow-sm ${isCompact ? 'mb-4 h-12 w-12' : 'mb-4 h-16 w-16'}`}
      >
        <Icon size={isCompact ? 20 : 28} aria-hidden />
      </div>
      <h3
        className={`${isCompact ? 'text-xs' : 'text-sm'} font-bold text-stone-900`}
      >
        {title}
      </h3>
      <p
        className={`mt-2 max-w-sm ${isCompact ? 'text-[11px]' : 'text-xs'} font-medium text-stone-500 leading-relaxed px-6`}
      >
        {description}
      </p>
      {action && <div className={isCompact ? 'mt-4' : 'mt-6'}>{action}</div>}
    </div>
  );
}
