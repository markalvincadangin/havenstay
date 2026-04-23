"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { fetchCurrentUser } from "@/lib/auth";
import { apiRequest, clearAuthToken, UNAUTHORIZED_EVENT } from "@/lib/api";

const AuthContext = createContext({
  user: null,
  loading: true,
  logout: () => { },
});

export function AuthProvider({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(() => {
    if (typeof window !== "undefined") {
      const cached = localStorage.getItem("havenstay_user");
      try {
        return cached ? JSON.parse(cached) : null;
      } catch {
        return null;
      }
    }
    return null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isActive = true;
    const loadUser = async () => {
      try {
        const me = await fetchCurrentUser();
        if (isActive) {
          setUser(me);
          if (me) {
            localStorage.setItem("havenstay_user", JSON.stringify(me));
          } else {
            localStorage.removeItem("havenstay_user");
          }
        }
      } catch {
        if (isActive) {
          setUser(null);
          localStorage.removeItem("havenstay_user");
          clearAuthToken();
        }
      } finally {
        if (isActive) setLoading(false);
      }
    };

    loadUser();
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    const onUnauthorized = () => {
      setUser(null);
      try {
        localStorage.removeItem("havenstay_user");
      } catch {
        /* ignore */
      }
      
      const currentPath = window.location.pathname + window.location.search;
      if (currentPath === "/login") return;

      const loginUrl = new URL("/login", window.location.origin);
      if (currentPath !== "/") {
        loginUrl.searchParams.set("callbackUrl", currentPath);
      }
      
      router.replace(loginUrl.pathname + loginUrl.search);
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, [router]);

  const login = (userData) => {
    setUser(userData);
    if (userData) {
      localStorage.setItem("havenstay_user", JSON.stringify(userData));
    }
  };

  const logout = async () => {
    try {
      await apiRequest("/api/auth/logout", {
        method: "POST",
        skipAuthRedirect: true,
      }).catch(() => { });
    } finally {
      try {
        localStorage.removeItem("havenstay_user");
      } catch {
        /* ignore */
      }
      clearAuthToken();
      setUser(null);
      if (pathname !== "/login") {
        router.replace("/login");
      }
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout, login }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
