'use client';

import { Sparkles, ArrowRight, ShieldCheck, Briefcase, Eye } from 'lucide-react';

export default function DemoModeBanner({ user, onSwitchRole }) {
  if (process.env.NEXT_PUBLIC_ENABLE_DEMO_MODE !== 'true') {
    return null;
  }

  const roleName = user?.role?.role_name || user?.role_name || 'User';
  const roleId = roleName.toLowerCase();

  const RoleIcon = roleId === 'admin' ? ShieldCheck : roleId === 'staff' ? Briefcase : Eye;

  return (
    <div className="mb-6 rounded-2xl border border-teal-200/60 bg-gradient-to-r from-teal-50/80 via-white to-stone-50/80 p-3.5 shadow-xs backdrop-blur-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-600 text-white shadow-xs">
            <Sparkles size={16} strokeWidth={2.2} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-teal-950">
                Portfolio Sandbox
              </span>
              <span className="inline-flex items-center gap-1 rounded-md border border-teal-200 bg-teal-100/60 px-2 py-0.5 text-[10px] font-bold text-teal-800">
                <RoleIcon size={12} strokeWidth={2.2} />
                <span className="capitalize">{roleName}</span>
              </span>
            </div>
            <p className="text-[11px] font-medium text-stone-500">
              Interactive portfolio environment with pre-populated demo data and forensic database audit tracking.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onSwitchRole}
          className="inline-flex items-center justify-center gap-1.5 self-start sm:self-center rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-stone-700 shadow-2xs hover:bg-stone-50 hover:border-stone-300 hover:text-teal-700 transition-all cursor-pointer shrink-0"
        >
          <span>Switch Identity</span>
          <ArrowRight size={12} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
