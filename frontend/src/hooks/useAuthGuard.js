"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { hasAuthToken } from "../lib/api";
import { fetchCurrentUser } from "../lib/auth";

export function useAuthGuard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    if (!hasAuthToken()) {
      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        router.replace("/login");
      }
      return;
    }

    const loadUser = async () => {
      try {
        const u = await fetchCurrentUser();
        if (isMounted) {
          setUser(u);
          setAuthLoading(false);
        }
      } catch (_err) {
        if (isMounted) {
          setAuthLoading(false);
          // ApiError with 401 will trigger redirect centrally inside api.js.
        }
      }
    };

    loadUser();

    return () => {
      isMounted = false;
    };
  }, [router]);

  return { user, authLoading };
}
