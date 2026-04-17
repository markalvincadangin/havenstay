import React from "react";
import { RefreshCw, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Alert from "./Alert";
import EmptyState from "./EmptyState";

/**
 * ResourceView — A unified, reusable component for managing loading, 
 * error, and empty states across the application.
 * 
 * @param {boolean} isLoading - Whether the resource is currently fetching (Initial load).
 * @param {boolean} isSyncing - Background re-validation (SWR isValidating).
 * @param {any} error - If truthy, shows an error state.
 * @param {boolean} isEmpty - If truthy, shows the EmptyState component.
 * @param {React.ReactNode} [skeleton] - Optional skeleton loader to show while loading.
 * @param {Function} [onRetry] - Callback to trigger when the user clicks 'Retry' on error.
 * @param {Object} [emptyProps] - Props passed directly to the EmptyState component.
 * @param {React.ReactNode} children - The actual content to show when data is ready.
 */
export default function ResourceView({
  isLoading = false,
  isSyncing = false,
  error = null,
  isEmpty = false,
  skeleton,
  onRetry,
  emptyProps = {},
  children
}) {
  // 1. Initial Loading State (Skeleton)
  if (isLoading) {
    return skeleton || (
      <div className="w-full space-y-4 p-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-4 animate-pulse">
            <div className="space-y-2 flex-1">
              <div className="h-2.5 w-32 rounded bg-stone-100" />
              <div className="h-2 w-20 rounded bg-stone-50" />
            </div>
            <div className="h-6 w-16 rounded-lg bg-stone-50" />
          </div>
        ))}
      </div>
    );
  }

  // 2. Error State
  if (error) {
    return (
      <div className="space-y-4">
        <Alert
          variant="error"
          title="Data Retrieval Interrupted"
          icon={AlertCircle}
        >
          <div className="flex flex-col gap-2">
            <p>We could not load this data right now. Please try again.</p>
            {error && <code className="rounded bg-black/5 px-1.5 py-0.5 text-[10px] text-red-800 font-mono tracking-tighter">{String(error)}</code>}
          </div>
        </Alert>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-stone-500 hover:text-teal-700 transition-colors"
          >
            <RefreshCw size={14} />
            Retry loading
          </button>
        )}
      </div>
    );
  }

  // 3. Empty State
  if (isEmpty) {
    return <EmptyState {...emptyProps} />;
  }

  // 4. Success State (The Actual Content with Re-validation Layer)
  return (
    <div className="relative isolate group/resource">
      {/* Progress Bar (CSS Indeterminate) */}
      <AnimatePresence>
        {isSyncing && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute left-0 top-0 z-50 h-[2px] w-full overflow-hidden bg-stone-100/30"
          >
            <div className="hs-indeterminate-bar h-full w-full bg-teal-500" />
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        animate={{ opacity: isSyncing ? 0.6 : 1 }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        className="h-full"
      >
        {children}
      </motion.div>
    </div>
  );
}
