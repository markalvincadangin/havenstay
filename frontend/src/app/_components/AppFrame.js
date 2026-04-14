"use client";

import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import Sidebar from "./Sidebar";
import MobileNav from "./MobileNav";
import { useAuth } from "../_context/AuthContext";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts";
import KeyboardHelpModal from "./ui/KeyboardHelpModal";

const AUTH_FREE_PAGES = new Set(["/login"]);

export default function AppFrame({ children }) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const { user, logout, loading } = useAuth();

  const handleToggleHelp = () => setShowHelp((prev) => !prev);

  useKeyboardShortcuts(handleToggleHelp);
  const isAuthPage = AUTH_FREE_PAGES.has(pathname);

  useEffect(() => {
    // Use setTimeout to avoid synchronous setState in effect
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

  if (!mounted) {
    return null;
  }

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)] md:flex max-w-[1600px] mx-auto">
      {/* Desktop Sidebar */}
      <Sidebar pathname={pathname} user={user} loading={loading} onLogout={logout} onToggleHelp={handleToggleHelp} />

      <div className="flex-1">
        {/* Mobile Header & Nav */}
        <MobileNav pathname={pathname} user={user} loading={loading} onLogout={logout} onToggleHelp={handleToggleHelp} />

        {/* Page Content */}
        <main className="mx-auto w-full max-w-[1200px] p-4 lg:p-8">
          {children}
        </main>
      </div>

      <KeyboardHelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />
    </div>
  );
}
