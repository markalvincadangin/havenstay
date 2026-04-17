"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../app/_context/AuthContext";

export function useAuthGuard() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
    }
  }, [user, authLoading, router]);

  return {
    user,
    authLoading,
    /** Session missing after bootstrap — hide protected content while redirect runs. */
    isUnauthorized: !authLoading && !user,
  };
}
