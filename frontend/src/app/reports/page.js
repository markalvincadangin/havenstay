"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  AlertCircle,
  BarChart3,
  BedDouble,
  BookMarked,
  CreditCard,
  FileText,
  Receipt,
  Users,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { canViewReports } from "../../lib/auth";
import Alert from "../_components/ui/Alert";
import Breadcrumbs from "../_components/ui/Breadcrumbs";
import UserRoleBadge from "../_components/ui/UserRoleBadge";
import StandardPage from "../_components/ui/StandardPage";
import { useAuth } from "../_context/AuthContext";

const REPORT_GROUPS = [
  {
    section: "Occupancy & Inventory",
    items: [
      {
        title: "Occupancy Report",
        description: "Room-level utilization, bed counts, and occupancy rates.",
        href: "/reports/occupancy",
        icon: BarChart3,
        color: "text-blue-600 bg-blue-50"
      },
      {
        title: "Bed Occupancy",
        description: "Per-bed status with tenant and active contract context.",
        href: "/reports/occupancy-status",
        icon: BedDouble,
        color: "text-cyan-600 bg-cyan-50"
      },
      {
        title: "Active Contracts",
        description: "Current leases with room, bed, and monthly rate.",
        href: "/reports/active-contracts",
        icon: FileText,
        color: "text-slate-600 bg-slate-50"
      },
      {
        title: "Tenant History",
        description: "View resident stay history and move-in/move-out records.",
        href: "/reports/tenant-history",
        icon: Users,
        color: "text-indigo-600 bg-indigo-50"
      }
    ]
  },
  {
    section: "Financial & Billing",
    items: [
      {
        title: "Billing Summary",
        description: "Quick view of billing totals and collection trends over time.",
        href: "/reports/billing-summary",
        icon: Receipt,
        color: "text-rose-600 bg-rose-50"
      },
      {
        title: "Outstanding Balances",
        description: "See unpaid and past-due balances by resident.",
        href: "/reports/outstanding-balances",
        icon: AlertCircle,
        color: "text-amber-600 bg-amber-50"
      },
      {
        title: "Tenant Ledger",
        description: "Detailed payment and billing history for each resident.",
        href: "/reports/tenant-ledger",
        icon: BookMarked,
        color: "text-teal-600 bg-teal-50"
      },
      {
        title: "Collections Performance",
        description: "Track how much has been collected and what is still unpaid.",
        href: "/reports/collections",
        icon: CreditCard,
        color: "text-emerald-600 bg-emerald-50"
      }
    ]
  }
];

export default function ReportsIndexPage() {
  const { user: currentUser } = useAuth();
  const canAccess = useMemo(() => canViewReports(currentUser), [currentUser]);

  return (
    <StandardPage
      title="Reports"
      subtitle="OPERATIONAL EXPORTS AND SUMMARIES"
      breadcrumbs={<Breadcrumbs items={[{ label: "Reports" }]} />}
      actions={
        <div className="flex items-center gap-4">
           <div className="flex items-center gap-2 px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl">
              <ShieldCheck size={14} className="text-teal-600" />
              <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">Verified Access</span>
           </div>
           <UserRoleBadge username={currentUser?.username} roleName={currentUser?.role?.role_name} />
        </div>
      }
    >
      {!canAccess ? (
        <Alert variant="warning" title="Access Restricted">
          Your account does not have permission to view financial or operational reports. Please contact management for access.
        </Alert>
      ) : (
        <div className="space-y-12">
          {REPORT_GROUPS.map((group) => (
            <div key={group.section}>
              <h2 className="hs-strip-title mb-6 px-1 text-[10px] font-black uppercase tracking-widest text-stone-400">
                {group.section}
              </h2>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-label={`Open ${item.title} report`}
                      className="group flex flex-col gap-6 rounded-2xl border border-stone-200 bg-white p-8 shadow-sm transition-all duration-300 hover:border-teal-200/80 hover:bg-stone-50 hover:shadow-xl hover:-translate-y-1"
                    >
                      <div className={`flex h-12 w-12 items-center justify-center rounded-xl border border-white/60 shadow-sm transition-shadow group-hover:shadow-md ${item.color}`}>
                        <Icon size={22} strokeWidth={2.5} aria-hidden />
                      </div>
                      
                      <div className="space-y-2">
                        <h3 className="text-sm font-black uppercase tracking-tight text-stone-900 group-hover:text-teal-900 transition-colors leading-tight">
                          {item.title}
                        </h3>
                        <p className="text-[11px] font-medium leading-relaxed text-stone-400 group-hover:text-stone-500 transition-colors">
                          {item.description}
                        </p>
                      </div>

                      <div className="mt-auto pt-6 border-t border-stone-100 flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-stone-400 group-hover:text-teal-700 transition-colors">Generate Report</span>
                        <ChevronRight size={14} className="text-stone-300 group-hover:text-teal-600 transition-transform group-hover:translate-x-1" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </StandardPage>
  );
}
