"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  BillingIcon,
  ContractIcon,
  DashboardIcon,
  PaymentIcon,
  ReportIcon,
  RoomIcon,
  TenantIcon,
  UserManagementIcon,
} from "./ui/Icons";
import { canManageUsers } from "../../lib/auth";
import { matchesPath } from "../../lib/formatters";
import { ADMIN_NAV_ITEMS, OPERATIONS_NAV_ITEMS } from "../../lib/navItems";

const OPERATIONS_ICONS_BY_HREF = {
  "/dashboard": DashboardIcon,
  "/tenants": TenantIcon,
  "/rooms": RoomIcon,
  "/contracts": ContractIcon,
  "/billing": BillingIcon,
  "/payments": PaymentIcon,
  "/reports": ReportIcon,
};

const ADMIN_ICONS_BY_HREF = {
  "/users": UserManagementIcon,
  "/audit-logs": ReportIcon,
  "/transaction-logs": ReportIcon,
};

const OPERATIONS_NAV = OPERATIONS_NAV_ITEMS.map((item) => ({
  ...item,
  Icon: OPERATIONS_ICONS_BY_HREF[item.href],
}));

const ADMIN_NAV = ADMIN_NAV_ITEMS.map((item) => ({
  ...item,
  Icon: ADMIN_ICONS_BY_HREF[item.href],
}));





export default function Sidebar({ pathname, user, loading: _loading, onLogout, onToggleHelp }) {
  const isAdmin = canManageUsers(user);
  const showAdminNav = isAdmin;

  return (
    <aside className="hidden md:flex md:w-20 lg:w-64 shrink-0 bg-slate-900 text-white flex-col shadow-2xl z-20 sticky top-0 h-screen overflow-y-auto scrollbar-hide">
      <div className="flex items-center gap-3 border-b border-white/5 px-4 lg:px-6 py-6 bg-gradient-to-r from-[var(--color-primary)]/10 to-transparent">
        <div className="h-10 w-10 shrink-0 flex items-center justify-center rounded-xl bg-[var(--color-primary)] shadow-lg shadow-[var(--color-primary)]/20">
          <Image src="/brand/logo-light.svg" alt="HavenStay" width={24} height={24} className="w-6 h-6" />
        </div>
        <div className="hidden lg:block">
          <p className="text-base font-black tracking-tight leading-none text-white">HavenStay</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide px-3 py-2">
        <nav className="mt-1 space-y-0.5">
          {OPERATIONS_NAV.map((item) => (
            <NavItem key={item.href} item={item} active={matchesPath(pathname, item.href)} />
          ))}
        </nav>
        {showAdminNav && (
          <>
            <div className="mt-3 border-t border-white/10 pt-3" />
            <nav className="space-y-0.5">
              {ADMIN_NAV.map((item) => (
                <NavItem key={item.href} item={item} active={matchesPath(pathname, item.href)} />
              ))}
            </nav>
          </>
        )}
      </div>

      <div className="shrink-0 border-t border-white/5 p-4 space-y-2">
        <button
          type="button"
          onClick={onToggleHelp}
          className="flex flex-col w-full text-left gap-1 px-4 py-3 rounded-xl bg-white/5 border border-white/5 transition-all hover:bg-white/10 hover:border-white/10 active:scale-[0.98] hidden lg:block"
        >
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold tracking-widest text-[var(--color-primary)]">
              Accessibility Shortcuts
            </p>
            <div className="flex h-4 w-4 items-center justify-center rounded bg-white/10 text-[10px] text-white/40 font-mono">?</div>
          </div>
          <p className="text-[9px] text-white/40 leading-tight">Press <span className="text-white/60 font-mono">G</span> then <span className="text-white/60 font-mono">key</span> to jump</p>
        </button>
        <button
          type="button"
          title="Logout"
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-white/60 transition-all hover:bg-white/5 hover:text-rose-400 hover:border-rose-400/30"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onLogout();
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
          <span className="hidden lg:block">Logout</span>
        </button>
      </div>
    </aside>
  );
}

function NavItem({ item, active }) {
  const { Icon, href, label } = item;
  return (
    <Link
      href={href}
      title={label}
      className={[
        "relative flex items-center justify-center lg:justify-start gap-4 rounded-xl px-4 py-3.5 text-[11px] font-bold tracking-wide transition-all duration-300",
        active ? "text-white bg-white/[0.08] shadow-sm" : "text-white/60 hover:text-white hover:bg-white/[0.05]",
      ].join(" ")}
    >
      {active && (
        <motion.div
          layoutId="sidebarActive"
          className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-full bg-[var(--color-primary)] shadow-[0_0_12px_var(--color-primary)]"
          initial={false}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
      )}
      <span className="relative z-10 flex items-center gap-3">
        <Icon className="h-5 w-5 shrink-0" />
        <span className="hidden lg:block whitespace-nowrap">{label}</span>
      </span>
    </Link>
  );
}
