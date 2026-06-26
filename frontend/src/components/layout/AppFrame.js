'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import MobileNav from '@/components/layout/MobileNav';
import { useAuth } from '@/context/AuthContext';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import KeyboardHelpModal from '@/components/ui/KeyboardHelpModal';
import { Loader2 } from 'lucide-react';

const AUTH_FREE_PAGES = new Set([
  '/login',
  '/signin',
  '/callback',
  '/auth/callback',
]);

export default function AppFrame({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const { user, loading, isLoggingOut, logout } = useAuth();

  const handleToggleHelp = () => setShowHelp((prev) => !prev);

  useKeyboardShortcuts(handleToggleHelp);

  // Logic: Is this page allowed without auth?
  const isAuthPage =
    AUTH_FREE_PAGES.has(pathname) || pathname.startsWith('/(auth)');

  useEffect(() => {
    setMounted(true);
  }, []);

  // Strict Security Guard: Redirect unauthenticated users away from protected routes
  useEffect(() => {
    if (mounted && !loading && !user && !isAuthPage) {
      router.replace('/login');
    }
  }, [mounted, loading, user, isAuthPage, router]);

  // Global Loading State / Hydration Guard
  if (!mounted || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fafaf9]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-teal-600 stroke-[2.5px]" />
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-stone-400">
            Initializing HavenStay...
          </span>
        </div>
      </div>
    );
  }

  // Logout Overlay Guard: Prevent any interaction while session is being invalidated
  if (isLoggingOut) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
        <div className="flex flex-col items-center gap-4 rounded-3xl bg-white p-8 shadow-2xl ring-1 ring-black/5">
          <Loader2 className="h-10 w-10 animate-spin text-rose-500 stroke-[2.5px]" />
          <div className="flex flex-col items-center gap-1">
            <span className="text-xs font-black uppercase tracking-[0.2em] text-stone-800">
              Securing Session...
            </span>
            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">
              Terminating HavenStay Access
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Auth pages (Login, Callback, etc.) get a clean, full-screen render
  if (isAuthPage) {
    return <>{children}</>;
  }

  // Dashboard pages (Sidebar + Content)
  // Double-guard: Don't render sidebar if user is null (protection during redirect)
  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)] md:flex max-w-[1600px] mx-auto">
      {/* Desktop Sidebar */}
      <Sidebar
        pathname={pathname}
        user={user}
        onLogout={logout}
        onToggleHelp={handleToggleHelp}
      />

      <div className="flex-1">
        {/* Mobile Header & Nav */}
        <MobileNav
          pathname={pathname}
          user={user}
          onLogout={logout}
          onToggleHelp={handleToggleHelp}
        />

        {/* Page Content */}
        <main className="mx-auto w-full max-w-[1200px] p-4 lg:p-8">
          {children}
        </main>
      </div>

      <KeyboardHelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />
    </div>
  );
}
