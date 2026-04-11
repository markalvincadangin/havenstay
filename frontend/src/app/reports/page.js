"use client";

import Link from "next/link";
import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  AlertCircle,
  BarChart3,
  BookMarked,
  CreditCard,
  FileText,
  Receipt,
  Users,
} from "lucide-react";
import { canViewReports } from "../../lib/auth";
import { useAuthGuard } from "../../hooks/useAuthGuard";
import Alert from "../_components/ui/Alert";
import { AppMain } from "../_components/ui/AppShell";
import Breadcrumbs from "../_components/ui/Breadcrumbs";
import { Card } from "../_components/ui/Card";
import PageHeader from "../_components/ui/PageHeader";
import { SkeletonGridPage } from "../_components/ui/Skeleton";
import UserRoleBadge from "../_components/ui/UserRoleBadge";

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.2, ease: "easeOut" },
};

const REPORT_LINKS = [
  {
    title: "Occupancy",
    description: "Room and bed utilization, vacancy counts, and occupancy rates by room.",
    href: "/reports/occupancy",
    icon: BarChart3,
  },
  {
    title: "Billing summary",
    description: "Revenue and billing cycles within a date range—aligned with billing summary export.",
    href: "/reports/billing-summary",
    icon: Receipt,
  },
  {
    title: "Outstanding balances",
    description: "Unpaid and overdue cycles so staff can prioritize collections.",
    href: "/reports/outstanding-balances",
    icon: AlertCircle,
  },
  {
    title: "Tenant ledger",
    description: "Itemized financial history and running balance per Tenant.",
    href: "/reports/tenant-ledger",
    icon: BookMarked,
  },
  {
    title: "Tenant history",
    description: "Lease timeline and status derived from contract records.",
    href: "/reports/tenant-history",
    icon: Users,
  },
  {
    title: "Collections performance",
    description: "Payment throughput and patterns to support cash-flow reviews.",
    href: "/reports/collections",
    icon: CreditCard,
  },
];

export default function ReportsHomePage() {
  const { user: currentUser, authLoading } = useAuthGuard();
  const shouldReduceMotion = useReducedMotion();
  const canAccess = useMemo(() => canViewReports(currentUser), [currentUser]);

  if (authLoading) {
    return <SkeletonGridPage cards={6} />;
  }

  return (
    <AppMain>
      <motion.div
        className="mx-auto mt-8 w-full max-w-7xl space-y-6"
        initial={shouldReduceMotion ? false : pageVariants.initial}
        animate={shouldReduceMotion ? false : pageVariants.animate}
        transition={shouldReduceMotion ? { duration: 0 } : pageVariants.transition}
      >
        <PageHeader
          title="Reports"
          subtitle="Six report areas—occupancy, billing summary, outstanding balances, tenant ledger, tenant contract history, and collections—with filters and CSV export where available."
          breadcrumbs={<Breadcrumbs items={[{ label: "Reports" }]} />}
          actions={
            <UserRoleBadge username={currentUser?.username} roleName={currentUser?.role?.role_name} />
          }
        />

        {!canAccess ? (
          <Alert variant="warning" title="Access restricted">
            You do not have permission to view reports. Ask an administrator if you need access.
          </Alert>
        ) : null}

        {canAccess ? (
          <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 bg-stone-50/50 px-6 py-4 sm:px-8 sm:py-5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                  <FileText size={16} aria-hidden />
                </div>
                <div>
                  <h2 className="hs-strip-title">Report Library</h2>
                  <p className="mt-0.5 text-xs font-medium text-stone-500">
                    Each report opens in its own workspace with filters and export.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 sm:p-8">
              <ul className="grid list-none gap-5 md:grid-cols-2 xl:grid-cols-3">
                {REPORT_LINKS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-label={`Open ${item.title} report`}
                        className="group flex h-full flex-col gap-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm transition-[border-color,box-shadow,transform] duration-200 hover:border-teal-600/25 hover:shadow-md active:scale-[0.99]"
                      >
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700 transition-colors group-hover:bg-teal-100">
                          <Icon size={22} strokeWidth={2} aria-hidden />
                        </div>
                        <div className="min-h-0 flex-1">
                          <h3 className="text-base font-bold text-stone-900">{item.title}</h3>
                          <p className="mt-1.5 text-sm font-medium leading-relaxed text-stone-500">
                            {item.description}
                          </p>
                        </div>
                        <div className="mt-auto flex items-center gap-2 text-xs font-black uppercase tracking-widest text-teal-700">
                          Open report
                          <span
                            className="transition-transform duration-200 group-hover:translate-x-0.5"
                            aria-hidden
                          >
                            →
                          </span>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </Card>
        ) : null}
      </motion.div>
    </AppMain>
  );
}
