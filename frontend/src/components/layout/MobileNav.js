"use client";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { HamburgerMenuIcon, XIcon } from "@/components/ui/Icons";
import { useState } from "react";
import Image from "next/image";
import { matchesPath } from "@/lib/formatters";
import { ADMIN_NAV_ITEMS, OPERATIONS_NAV_ITEMS } from "@/lib/navItems";
import {
  BillingIcon,
  ComplianceIcon,
  ContractIcon,
  DashboardIcon,
  PaymentIcon,
  ReportIcon,
  RoomIcon,
  TenantIcon,
  UserManagementIcon,
  UtilityIcon,
} from "@/components/ui/Icons";

const OPERATIONS_ICONS_BY_HREF = {
  "/dashboard": DashboardIcon,
  "/tenants": TenantIcon,
  "/rooms": RoomIcon,
  "/contracts": ContractIcon,
  "/billing": BillingIcon,
  "/payments": PaymentIcon,
  "/utilities": UtilityIcon,
};
const ADMIN_ICONS_BY_HREF = {
  "/admin/users": UserManagementIcon,
  "/admin/reports": ReportIcon,
  "/admin/audit-logs": ComplianceIcon,
};

export default function MobileNav({ user, onLogout, pathname }) {
  const [open, setOpen] = useState(false);
  
  const filteredOps = OPERATIONS_NAV_ITEMS.filter((item) => item.predicate(user)).map(item => ({...item, Icon: OPERATIONS_ICONS_BY_HREF[item.href]}));
  const filteredAdmin = ADMIN_NAV_ITEMS.filter((item) => item.predicate(user)).map(item => ({...item, Icon: ADMIN_ICONS_BY_HREF[item.href]}));

  return (
    <>
      {/* Mobile Top Header */}
      <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/80 px-4 py-3 backdrop-blur-md md:hidden shadow-sm">
        <div className="flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white shadow-md ring-1 ring-black/5">
              <Image src="/brand/logo-dark.svg" alt="HavenStay" width={18} height={18} className="w-4.5 h-4.5" />
            </div>
            <span className="text-base font-black tracking-tight text-stone-900">HavenStay</span>
          </Link>
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-600 shadow-sm transition-all hover:bg-stone-50 active:scale-95"
            onClick={() => setOpen(true)}
          >
            <HamburgerMenuIcon className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Mobile Drawer Overlay */}
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 md:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-md"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="absolute left-0 top-0 flex h-full w-72 max-w-[80vw] flex-col bg-slate-900 text-white shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-white/5 p-5 bg-gradient-to-r from-[var(--color-primary)]/10 to-transparent">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 shrink-0 flex items-center justify-center rounded-xl bg-white shadow-md ring-1 ring-black/5">
                    <Image src="/brand/logo-dark.svg" alt="HavenStay" width={20} height={20} className="w-5 h-5" />
                  </div>
                  <span className="text-base font-black tracking-tight leading-none text-white">HavenStay</span>
                </div>
                <button 
                  onClick={() => setOpen(false)} 
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-white/40 hover:bg-white/10 hover:text-white transition-colors"
                >
                  <XIcon className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto scrollbar-hide px-3 py-6 space-y-8">
                {/* Operations Group */}
                <div>
                  <div className="mb-2 px-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Operations</p>
                  </div>
                  <nav className="space-y-0.5">
                    {filteredOps.map((item) => {
                      const active = matchesPath(pathname, item.href);
                      const Icon = item.Icon;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={[
                            "relative flex items-center gap-3 rounded-xl px-4 py-3.5 text-[11px] font-bold tracking-wide transition-all duration-300",
                            active ? "text-white bg-white/[0.08] shadow-sm" : "text-white/60 hover:text-white hover:bg-white/[0.05]"
                          ].join(" ")}
                          onClick={() => setOpen(false)}
                        >
                          {active && (
                            <motion.div
                              layoutId="mobileNavActive"
                              className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-full bg-[var(--color-primary)] shadow-[0_0_12px_var(--color-primary)]"
                            />
                          )}
                          {Icon && <Icon className="h-5 w-5 shrink-0" />}
                          <span className="whitespace-nowrap">{item.label}</span>
                        </Link>
                      );
                    })}
                  </nav>
                </div>

                {/* Administration Group */}
                {filteredAdmin.length > 0 && (
                  <div>
                    <div className="mb-2 px-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Administration</p>
                    </div>
                    <nav className="space-y-0.5">
                      {filteredAdmin.map((item) => {
                        const active = matchesPath(pathname, item.href);
                        const Icon = item.Icon;
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={[
                              "relative flex items-center gap-3 rounded-xl px-4 py-3.5 text-[11px] font-bold tracking-wide transition-all duration-300",
                              active ? "text-white bg-white/[0.08] shadow-sm" : "text-white/60 hover:text-white hover:bg-white/[0.05]"
                            ].join(" ")}
                            onClick={() => setOpen(false)}
                          >
                            {active && (
                              <motion.div
                                layoutId="mobileNavActive"
                                className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-full bg-[var(--color-primary)] shadow-[0_0_12px_var(--color-primary)]"
                              />
                            )}
                            {Icon && <Icon className="h-5 w-5 shrink-0" />}
                            <span className="whitespace-nowrap">{item.label}</span>
                          </Link>
                        );
                      })}
                    </nav>
                  </div>
                )}
              </div>

              <div className="shrink-0 p-4 border-t border-white/5">
                <button
                  type="button"
                  className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/5 px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-white/60 transition-all hover:bg-white/10 hover:text-rose-400 hover:border-rose-400/30"
                  onClick={onLogout}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                  <span>Logout</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}