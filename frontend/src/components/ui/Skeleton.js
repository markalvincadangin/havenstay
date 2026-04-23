import { motion } from "framer-motion";
import { AppMain } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/Card";

/** Base skeleton primitive (box) */
export function Skeleton({ className = "h-4 w-full", opacity = "opacity-30" }) {
  return (
    <div 
      className={`animate-pulse rounded bg-[var(--color-border-strong)] ${opacity} ${className}`} 
      role="status"
    />
  );
}



/** Full-page skeleton for grid/card layouts (e.g. Rooms Dashboard) */
export function SkeletonGridPage({ cards = 6 }) {
  return (
    <AppMain>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="space-y-6"
      >
        {/* Header card */}
        <Card className="animate-pulse space-y-4">
          <div className="h-7 w-40 rounded bg-[var(--color-primary)]/10" />
          <div className="grid gap-3 md:grid-cols-3">
            <div className="h-12 rounded-xl bg-[var(--color-primary)]/8" />
            <div className="h-12 rounded-xl bg-[var(--color-primary)]/8" />
            <div className="h-12 rounded-xl bg-[var(--color-primary)]/8" />
          </div>
        </Card>

        {/* Grid of cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: cards }).map((_, i) => (
            <Card key={i} className="animate-pulse flex flex-col gap-4">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="h-6 w-20 rounded bg-[var(--color-primary)]/10" />
                  <div className="h-3 w-16 rounded bg-[var(--color-primary)]/5" />
                </div>
                <div className="h-6 w-16 rounded-full bg-[var(--color-primary)]/10" />
              </div>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <div className="h-3 w-20 rounded bg-[var(--color-primary)]/5" />
                  <div className="h-3 w-12 rounded bg-[var(--color-primary)]/10" />
                </div>
                <div className="flex justify-between">
                  <div className="h-3 w-20 rounded bg-[var(--color-primary)]/5" />
                  <div className="h-3 w-12 rounded bg-[var(--color-primary)]/10" />
                </div>
              </div>
              <div className="mt-2 h-1.5 w-full rounded-full bg-[var(--color-primary)]/5" />
              <div className="border-t border-[var(--color-primary)]/5 pt-3 flex justify-between">
                <div className="h-3 w-12 rounded bg-[var(--color-primary)]/10" />
                <div className="h-3 w-12 rounded bg-[var(--color-primary)]/10" />
              </div>
            </Card>
          ))}
        </div>
      </motion.div>
    </AppMain>
  );
}

export function SkeletonListPage({ rows = 5 }) {
  return (
    <AppMain>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="space-y-6"
      >
        {/* Filter card */}
        <Card className="animate-pulse space-y-4">
          <div className="h-7 w-40 rounded bg-[var(--color-primary)]/10" />
          <div className="grid gap-3 md:grid-cols-3">
            <div className="h-12 rounded-xl bg-[var(--color-primary)]/8" />
            <div className="h-12 rounded-xl bg-[var(--color-primary)]/8" />
            <div className="h-12 rounded-xl bg-[var(--color-primary)]/8" />
          </div>
        </Card>

        {/* Table skeleton */}
        <div className="overflow-hidden rounded-2xl border border-[var(--color-primary)]/10 bg-white shadow-[var(--shadow-md)] animate-pulse">
          {/* thead */}
          <div className="flex gap-6 bg-[var(--color-background)] px-4 py-4">
            {[40, 28, 20, 16, 12].map((w, i) => (
              <div key={i} className={`h-3 w-${w} rounded bg-[var(--color-primary)]/10`} />
            ))}
          </div>
          {/* tbody rows */}
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex gap-6 border-t border-[var(--color-primary)]/5 px-4 py-5">
              <div className="h-4 w-24 rounded bg-[var(--color-primary)]/8" />
              <div className="h-4 w-48 rounded bg-[var(--color-primary)]/5" />
              <div className="h-4 w-32 rounded bg-[var(--color-primary)]/5" />
              <div className="h-4 w-40 rounded bg-[var(--color-primary)]/5" />
              <div className="ml-auto h-4 w-16 rounded bg-[var(--color-primary)]/8" />
            </div>
          ))}
        </div>
      </motion.div>
    </AppMain>
  );
}

/**
 * SkeletonDetailPage — Standard loading for detail/profile pages
 * (PageHeader + Grid of Info Cards + Large Table Card)
 */
export function SkeletonDetailPage() {
  return (
    <AppMain>
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="flex flex-col gap-4">
          <div className="h-8 w-64 animate-pulse rounded-lg bg-[var(--color-border)] opacity-50" />
          <div className="h-4 w-48 animate-pulse rounded-lg bg-[var(--color-border)] opacity-30" />
        </div>

        {/* Info Cards Grid */}
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] opacity-40 shadow-sm"
            />
          ))}
        </div>

        <Skeleton className="h-64 opacity-30 shadow-sm rounded-2xl border-stone-200" />
      </div>
    </AppMain>
  );
}

/** Specialized Dashboard Skeleton mapped to the Operational Command Center layout */
export function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      {/* KPI Grid - 6 cards */}
      <section aria-label="Loading metrics" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={`kpi-${i}`} className="h-32 rounded-2xl bg-white border border-stone-100 shadow-sm opacity-50" />
        ))}
      </section>

      {/* Row 2: Quick Links Skeleton (Full Width) */}
      <div className="rounded-2xl bg-white border border-stone-200 p-8 shadow-sm">
        <Skeleton className="mb-6 h-4 w-32 opacity-20" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={`link-${i}`} className="h-20 rounded-xl bg-stone-50/50 opacity-40" />
          ))}
        </div>
      </div>

      {/* Row 3: Main Content Area (8/4 Grid) */}
      <div className="grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-8 space-y-8">
          {/* Turnover Forecast Skeleton */}
          <div className="rounded-2xl bg-white border border-stone-200 p-0 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between h-14 border-b border-stone-50 bg-stone-50/50 px-8">
              <Skeleton className="w-32 h-3 opacity-20" />
              <Skeleton className="w-16 h-2.5 opacity-10" />
            </div>
            <div className="p-0">
               {[...Array(2)].map((_, i) => (
                <div key={`turnover-${i}`} className="h-16 border-b border-stone-50 flex items-center px-8">
                  <Skeleton className="w-full h-4 opacity-5" />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-white border border-stone-200 p-0 shadow-sm overflow-hidden">
            <div className="h-14 border-b border-stone-50 bg-stone-50/50" />
            <div className="p-0">
               {[...Array(3)].map((_, i) => (
                <div key={`row-${i}`} className="h-16 border-b border-stone-50 flex items-center px-8">
                   <Skeleton className="w-full h-4 opacity-5" />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-8">
          {[...Array(2)].map((_, i) => (
            <div key={`list-${i}`} className="rounded-2xl bg-white border border-stone-200 p-0 shadow-sm overflow-hidden">
              <div className="h-14 border-b border-stone-50 bg-stone-50/50" />
              <div className="p-0 space-y-px">
                {[...Array(3)].map((_, j) => (
                  <div key={`list-item-${j}`} className="h-20 border-b border-stone-50 flex items-center px-8">
                    <Skeleton className="w-full h-10 opacity-5" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
