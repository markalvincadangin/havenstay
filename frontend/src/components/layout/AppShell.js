'use client';

import React from 'react';

/**
 * AppMain — The primary content column for all authenticated pages.
 * Handles the central max-width boundary and standardized responsive padding.
 */
export function AppMain({ children }) {
  return (
    <main className="flex-1 min-w-0 bg-[var(--color-background)]">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
        <div className="flex flex-col gap-8">{children}</div>
      </div>
    </main>
  );
}
