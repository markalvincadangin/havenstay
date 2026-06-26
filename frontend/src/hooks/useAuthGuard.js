'use client';

import { useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export function useAuthGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !user) {
      let callback = pathname;
      const search = searchParams.toString();
      if (search) {
        callback += `?${search}`;
      }

      const loginUrl = new URL('/login', window.location.origin);
      if (callback && callback !== '/' && callback !== '/login') {
        loginUrl.searchParams.set('callbackUrl', callback);
      }

      router.replace(loginUrl.pathname + loginUrl.search);
    }
  }, [user, authLoading, router, pathname, searchParams]);

  return {
    user,
    authLoading,
    /** Session missing after bootstrap — hide protected content while redirect runs. */
    isUnauthorized: !authLoading && !user,
  };
}
