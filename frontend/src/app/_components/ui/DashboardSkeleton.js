/**
 * Dashboard-specific skeleton loader
 * 
 * Matches the exact layout of the dashboard page:
 * - Page header skeleton
 * - 4-column KPI grid (occupancy metrics)
 * - 3-column KPI grid (financial metrics)
 * - Due Today table skeleton
 * - Quick Links panel skeleton
 * 
 * Provides a professional loading experience that matches the actual
 * dashboard structure, reducing perceived load time and layout shift.
 * 
 * @component
 * @example
 * {loading && <DashboardSkeleton />}
 */
export function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      {/* Page Header Skeleton */}
      <div className="rounded-2xl bg-white p-6 shadow-sm border border-[var(--color-border)]">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-8 w-48 animate-pulse rounded bg-stone-200" />
            <div className="mt-2 h-4 w-96 animate-pulse rounded bg-stone-200" />
          </div>
          <div className="flex gap-2">
            <div className="h-10 w-32 animate-pulse rounded-lg bg-stone-200" />
            <div className="h-10 w-24 animate-pulse rounded-lg bg-stone-200" />
          </div>
        </div>
      </div>

      {/* KPI Row 1 - Occupancy (4 cards) */}
      <section aria-label="Loading occupancy metrics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div 
            key={`occ-${i}`} 
            className="h-32 animate-pulse rounded-2xl bg-stone-200 border border-[var(--color-border)]"
            role="status"
            aria-label="Loading metric"
          />
        ))}
      </section>

      {/* KPI Row 2 - Financial (3 cards) */}
      <section aria-label="Loading financial metrics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div 
            key={`fin-${i}`} 
            className="h-32 animate-pulse rounded-2xl bg-stone-200 border border-[var(--color-border)]"
            role="status"
            aria-label="Loading metric"
          />
        ))}
      </section>

      {/* Due Today + Quick Links */}
      <div className="grid gap-4 xl:grid-cols-3">
        {/* Due Today Table Skeleton */}
        <div className="xl:col-span-2">
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-[var(--color-border)]">
            <div className="mb-4 h-6 w-32 animate-pulse rounded bg-stone-200" />
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div 
                  key={`row-${i}`} 
                  className="h-12 animate-pulse rounded bg-stone-100"
                  role="status"
                  aria-label="Loading table row"
                />
              ))}
            </div>
          </div>
        </div>

        {/* Quick Links Skeleton */}
        <div className="rounded-2xl bg-white p-6 shadow-sm border border-[var(--color-border)]">
          <div className="mb-4 h-6 w-32 animate-pulse rounded bg-stone-200" />
          <div className="space-y-2">
            {[...Array(6)].map((_, i) => (
              <div 
                key={`link-${i}`} 
                className="h-10 animate-pulse rounded-xl bg-stone-100"
                role="status"
                aria-label="Loading link"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
