import { motion } from "framer-motion";
import { AppMain } from "./AppShell";
import { Card } from "./Card";



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

        {/* Large Data Card */}
        <div className="h-64 animate-pulse rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] opacity-30 shadow-sm" />
      </div>
    </AppMain>
  );
}
