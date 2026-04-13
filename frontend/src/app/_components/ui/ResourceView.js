"use client";

import React from "react";
import { RefreshCw, AlertCircle } from "lucide-react";
import Alert from "./Alert";
import EmptyState from "./EmptyState";
import Spinner from "./Spinner";

/**
 * ResourceView — A unified, reusable component for managing loading, 
 * error, and empty states across the application.
 * 
 * @param {boolean} isLoading - Whether the resource is currently fetching.
 * @param {any} error - If truthy, shows an error state.
 * @param {boolean} isEmpty - If truthy, shows the EmptyState component.
 * @param {React.ReactNode} [skeleton] - Optional skeleton loader to show while loading.
 * @param {Function} [onRetry] - Callback to trigger when the user clicks 'Retry' on error.
 * @param {Object} [emptyProps] - Props passed directly to the EmptyState component.
 * @param {React.ReactNode} children - The actual content to show when data is ready.
 */
export default function ResourceView({
  isLoading = false,
  error = null,
  isEmpty = false,
  skeleton,
  onRetry,
  emptyProps = {},
  children
}) {
  // 1. Loading State
  if (isLoading) {
    return skeleton || (
      <div className="flex min-h-[200px] flex-col items-center justify-center p-12">
        <Spinner size="lg" className="text-teal-500" />
        <p className="mt-4 text-xs font-bold uppercase tracking-widest text-stone-400">
          Syncing records...
        </p>
      </div>
    );
  }

  // 2. Error State
  if (error) {
    return (
      <div className="space-y-4">
        <Alert
          variant="error"
          title="Forensic Data Retrieval Failure"
          icon={AlertCircle}
        >
          <div className="flex flex-col gap-2">
            <p>The application encountered an issue while communicating with the backend storage.</p>
            {error && <code className="rounded bg-black/5 px-1.5 py-0.5 text-[10px] text-red-800">{String(error)}</code>}
          </div>
        </Alert>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-stone-500 hover:text-teal-700 transition-colors"
          >
            <RefreshCw size={14} />
            Reconnect and try again
          </button>
        )}
      </div>
    );
  }

  // 3. Empty State
  if (isEmpty) {
    return <EmptyState {...emptyProps} />;
  }

  // 4. Success State (The Actual Content)
  return <>{children}</>;
}
