"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { fetchCurrentUser } from "../../lib/auth";
import { clearAuthToken } from "../../lib/api";

const AuthContext = createContext({
  user: null,
  loading: true,
  logout: () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    let isActive = true;
    const loadUser = async () => {
      try {
        const me = await fetchCurrentUser();
        if (isActive) {
          setUser(me);
        }
      } catch {
        if (isActive) setUser(null);
      } finally {
        if (isActive) setLoading(false);
      }
    };

    loadUser();
    return () => {
      isActive = false;
    };
  }, [pathname]);

  const logout = () => {
    clearAuthToken();
    setUser(null);
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
