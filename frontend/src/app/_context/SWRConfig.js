"use client";

import { SWRConfig } from "swr";
import { fetcher } from "../../lib/api";

export function SWRProvider({ children }) {
  return (
    <SWRConfig
      value={{
        fetcher,
        revalidateOnFocus: false,
        revalidateIfStale: true,
        keepPreviousData: true,
        shouldRetryOnError: false,
        onError: (error, key) => {
          // Centralized error surfacing for easier runtime debugging.
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("havenstay:api-error", {
                detail: {
                  key,
                  status: error?.status ?? null,
                  message: error?.message ?? "Unknown API error",
                },
              }),
            );
          }

          if (process.env.NODE_ENV !== "production") {
            // Keep noisy details in development only.
            console.error("[SWR] request failed", { key, error });
          }
        },
      }}
    >
      {children}
    </SWRConfig>
  );
}
