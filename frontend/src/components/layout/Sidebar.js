'use client';
import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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
} from '@/components/ui/Icons';
import UserRoleBadge from '@/components/ui/UserRoleBadge';
import { matchesPath } from '@/lib/formatters';
import { ADMIN_NAV_ITEMS, OPERATIONS_NAV_ITEMS } from '@/lib/navItems';
const OPERATIONS_ICONS_BY_HREF = {
  '/dashboard': DashboardIcon,
  '/tenants': TenantIcon,
  '/rooms': RoomIcon,
  '/contracts': ContractIcon,
  '/billing': BillingIcon,
  '/payments': PaymentIcon,
  '/utilities': UtilityIcon,
};
const ADMIN_ICONS_BY_HREF = {
  '/admin/users': UserManagementIcon,
  '/admin/reports': ReportIcon,
  '/admin/audit-logs': ComplianceIcon,
};
const OPERATIONS_NAV = OPERATIONS_NAV_ITEMS.map((item) => ({
  ...item,
  Icon: OPERATIONS_ICONS_BY_HREF[item.href],
}));
const ADMIN_NAV = ADMIN_NAV_ITEMS.map((item) => ({
  ...item,
  Icon: ADMIN_ICONS_BY_HREF[item.href],
}));

export default function Sidebar({ pathname, user, onLogout, onToggleHelp }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const filteredOps = OPERATIONS_NAV.filter((item) => item.predicate(user));
  const filteredAdmin = ADMIN_NAV.filter((item) => item.predicate(user));

  return (
    <aside
      className={`hidden md:flex shrink-0 bg-slate-900 text-white flex-col shadow-2xl z-20 sticky top-0 h-screen relative transition-[width] duration-300 ${isCollapsed ? 'w-20' : 'w-64'}`}
    >
      {/* Floating Toggle Button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-8 flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 border border-white/20 text-white/60 hover:text-white hover:bg-slate-700 hover:scale-110 transition-all z-50 shadow-md ring-2 ring-slate-900"
        title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
      >
        {isCollapsed ? (
          <ChevronRight size={14} strokeWidth={3} />
        ) : (
          <ChevronLeft size={14} strokeWidth={3} />
        )}
      </button>

      <div
        className={`flex items-center gap-3 border-b border-white/5 py-6 transition-all ${isCollapsed ? 'justify-center px-0' : 'px-7'}`}
      >
        <div className="h-10 w-10 shrink-0 flex items-center justify-center rounded-xl bg-white shadow-[0_8px_16px_-4px_rgba(0,0,0,0.2)] ring-1 ring-black/5">
          <Image
            src="/brand/logo-dark.svg"
            alt="HavenStay"
            width={24}
            height={24}
            className="w-6 h-6"
          />
        </div>
        {!isCollapsed && (
          <div className="flex flex-col">
            <span className="text-[15px] font-black uppercase tracking-[0.3em] leading-none text-white drop-shadow-sm">
              HavenStay
            </span>
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-hide px-3 py-4">
        {/* Core Operations Group */}
        <div className="mb-2 px-3">
          {isCollapsed ? (
            <div className="h-px bg-white/10 w-full mt-2" />
          ) : (
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">
              Operations
            </p>
          )}
        </div>
        <nav className="space-y-0.5">
          {filteredOps.map((item) => (
            <NavItem
              key={item.href}
              item={item}
              active={matchesPath(pathname, item.href)}
              isCollapsed={isCollapsed}
            />
          ))}
        </nav>

        {/* Administration Group */}
        {filteredAdmin.length > 0 && (
          <>
            <div className="mb-2 px-3 mt-6">
              {isCollapsed ? (
                <div className="h-px bg-white/10 w-full" />
              ) : (
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                  Administration
                </p>
              )}
            </div>
            <nav className="space-y-0.5">
              {filteredAdmin.map((item) => (
                <NavItem
                  key={item.href}
                  item={item}
                  active={matchesPath(pathname, item.href)}
                  isCollapsed={isCollapsed}
                />
              ))}
            </nav>
          </>
        )}
      </div>

      <div className="shrink-0 border-t border-white/5 p-4 space-y-4">
        {!isCollapsed && user && <UserRoleBadge user={user} isSidebar={true} />}

        {!isCollapsed && (
          <button
            type="button"
            onClick={onToggleHelp}
            className="flex flex-col w-full text-left gap-1 px-4 py-3 rounded-xl bg-white/5 border border-white/5 transition-all hover:bg-white/10 hover:border-white/10 active:scale-[0.98]"
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold tracking-widest text-[var(--color-primary)]">
                Shortcuts
              </p>
              <div className="flex h-4 w-4 items-center justify-center rounded bg-white/10 text-[10px] text-white/40 font-mono">
                ?
              </div>
            </div>
            <p className="text-[9px] text-white/40 leading-tight">
              Press <span className="text-white/60 font-mono">G</span> then{' '}
              <span className="text-white/60 font-mono">key</span> to jump
            </p>
          </button>
        )}

        <button
          type="button"
          title="Logout"
          className={`flex w-full items-center ${isCollapsed ? 'justify-center px-0' : 'justify-start px-4'} gap-3 rounded-xl border border-white/5 py-3 text-[10px] font-bold uppercase tracking-widest text-white/60 transition-all hover:bg-white/10 hover:text-rose-400 hover:border-rose-400/30`}
          onClick={onLogout}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          {!isCollapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}

function NavItem({ item, active, isCollapsed }) {
  const { Icon, href, label } = item;
  return (
    <Link
      href={href}
      title={label}
      className={[
        'relative flex items-center gap-3 rounded-xl py-3.5 text-[11px] font-bold tracking-wide transition-all duration-300',
        isCollapsed ? 'justify-center px-0' : 'justify-start px-4',
        active
          ? 'text-white bg-white/[0.08] shadow-sm'
          : 'text-white/60 hover:text-white hover:bg-white/[0.05]',
      ].join(' ')}
    >
      {active && (
        <motion.div
          layoutId="sidebarActive"
          className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-full bg-[var(--color-primary)] shadow-[0_0_12px_var(--color-primary)]"
          initial={false}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        />
      )}
      <span className="relative z-10 flex items-center gap-3">
        {Icon ? (
          <Icon className="h-5 w-5 shrink-0" />
        ) : (
          <div className="h-5 w-5 shrink-0 bg-white/10 rounded" />
        )}
        {!isCollapsed && <span className="whitespace-nowrap">{label}</span>}
      </span>
    </Link>
  );
}
