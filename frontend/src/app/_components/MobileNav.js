"use client";

import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { HamburgerMenuIcon, XIcon } from "./ui/Icons";
import { useState } from "react";
import Image from "next/image";
import { canManageUsers } from "../../lib/auth";
import { matchesPath } from "../../lib/formatters";
import { ADMIN_NAV_ITEMS, OPERATIONS_NAV_ITEMS } from "../../lib/navItems";



export default function MobileNav({ user, onLogout, pathname }) {
  const [open, setOpen] = useState(false);
  const isAdmin = canManageUsers(user);
  const allNav = isAdmin ? [...OPERATIONS_NAV_ITEMS, ...ADMIN_NAV_ITEMS] : OPERATIONS_NAV_ITEMS;

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-[var(--color-primary)]/5 bg-white/80 px-6 py-4 backdrop-blur-md md:hidden">
        <div className="flex items-center justify-between gap-3">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-primary)]">
              <Image src="/logo.svg" alt="HavenStay" width={16} height={16} className="w-4 h-4" />
            </div>
            <span className="text-sm font-black tracking-tight text-stone-900 [word-spacing:0.06em]">HavenStay</span>
          </Link>
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-primary)]/10"
            onClick={() => setOpen(true)}
          >
            <HamburgerMenuIcon className="h-5 w-5" />
          </button>
        </div>
      </header>

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 md:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              className="absolute left-0 top-0 flex h-full w-72 flex-col bg-[#1A1A1A] text-white"
            >
              <div className="flex items-center justify-between border-b border-white/5 p-6">
                <span className="font-black">HavenStay</span>
                <button onClick={() => setOpen(false)}><XIcon className="h-5 w-5" /></button>
              </div>
              <nav className="flex-1 px-4 py-6 space-y-1">
                {allNav.map(item => {
                  const active = matchesPath(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={[
                        "block px-4 py-3 text-sm font-bold transition-colors",
                        active ? "text-[var(--color-primary)] bg-white/5" : "text-white/60 hover:text-white"
                      ].join(" ")}
                      onClick={() => setOpen(false)}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
              <div className="p-6 border-t border-white/5">
                <button onClick={onLogout} className="w-full py-3 text-[10px] font-black uppercase text-white/60">Logout</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
