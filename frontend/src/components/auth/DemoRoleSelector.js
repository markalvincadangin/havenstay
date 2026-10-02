'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Briefcase, Eye, Sparkles, ArrowRight, Loader2 } from 'lucide-react';

const DEMO_ROLES = [
  {
    id: 'admin',
    roleName: 'System Administrator',
    scopeBadge: 'Full Access',
    description: 'System settings, user management, and raw trigger audit trails',
    username: 'havenstay.admin@havenstay.com',
    password: 'HavenStay123!',
    icon: ShieldCheck,
    theme: {
      badge: 'bg-teal-100/70 text-teal-800 border-teal-200/80',
      iconBox: 'bg-teal-600 text-white',
      borderHover: 'hover:border-teal-400 hover:bg-teal-50/50',
      activeRing: 'ring-teal-500',
    },
  },
  {
    id: 'staff',
    roleName: 'Staff Operator',
    scopeBadge: 'Operational',
    description: 'Bed space assignment, utility sub-metering, and payment records',
    username: 'havenstay.staff@havenstay.com',
    password: 'HavenStay123!',
    icon: Briefcase,
    theme: {
      badge: 'bg-slate-100/80 text-slate-800 border-slate-200/80',
      iconBox: 'bg-slate-700 text-white',
      borderHover: 'hover:border-slate-400 hover:bg-slate-50/50',
      activeRing: 'ring-slate-500',
    },
  },
  {
    id: 'viewer',
    roleName: 'Auditor & Analyst',
    scopeBadge: 'Read-Only',
    description: 'Read-only financial summaries, occupancy metrics, and analytics',
    username: 'viewer@havenstay.com',
    password: 'HavenStay123!',
    icon: Eye,
    theme: {
      badge: 'bg-stone-100/80 text-stone-800 border-stone-200/80',
      iconBox: 'bg-stone-600 text-white',
      borderHover: 'hover:border-stone-400 hover:bg-stone-50/50',
      activeRing: 'ring-stone-400',
    },
  },
];

export default function DemoRoleSelector({ onSelectRole, isSubmitting = false }) {
  const [selectedRoleId, setSelectedRoleId] = useState(null);

  const handleSelect = (role) => {
    if (isSubmitting) return;
    setSelectedRoleId(role.id);
    onSelectRole(role);
  };

  return (
    <div className="mt-8 rounded-2xl border border-stone-200/70 bg-stone-50/60 p-5 backdrop-blur-sm">
      <div className="flex items-center justify-between pb-3 border-b border-stone-200/60">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-teal-600/10 text-teal-700">
            <Sparkles size={14} strokeWidth={2.5} />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-stone-800">
              Demo Sandbox Access
            </h3>
            <p className="text-[11px] font-medium text-stone-500">
              Select an authorized identity to sign in with one click
            </p>
          </div>
        </div>
        <span className="rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-teal-700">
          Portfolio Mode
        </span>
      </div>

      <div className="mt-3 space-y-2.5" role="group" aria-label="Demo role selector">
        {DEMO_ROLES.map((role) => {
          const Icon = role.icon;
          const isCurrentLoading = isSubmitting && selectedRoleId === role.id;

          return (
            <motion.button
              key={role.id}
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSelect(role)}
              whileHover={{ scale: isSubmitting ? 1 : 1.01 }}
              whileTap={{ scale: isSubmitting ? 1 : 0.99 }}
              className={`group relative flex w-full items-center justify-between rounded-xl border border-stone-200 bg-white p-3 text-left shadow-xs transition-all ${role.theme.borderHover} ${
                isCurrentLoading ? `ring-2 ${role.theme.activeRing}` : ''
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${role.theme.iconBox} shadow-xs transition-transform group-hover:scale-105`}
                >
                  {isCurrentLoading ? (
                    <Loader2 size={16} className="animate-spin text-white" />
                  ) : (
                    <Icon size={16} strokeWidth={2.2} />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-stone-900 group-hover:text-teal-700 transition-colors">
                      {role.roleName}
                    </span>
                    <span
                      className={`inline-block rounded-md border px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider ${role.theme.badge}`}
                    >
                      {role.scopeBadge}
                    </span>
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-[11px] font-medium text-stone-500">
                    {role.description}
                  </p>
                </div>
              </div>

              <div className="flex items-center pl-2 text-stone-400 group-hover:text-teal-600 transition-colors">
                <ArrowRight size={14} strokeWidth={2.5} className="transition-transform group-hover:translate-x-0.5" />
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
