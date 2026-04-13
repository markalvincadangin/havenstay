"use client";

import Link from "next/link";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useReducedMotion, motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  RefreshCw,
  Users,
  DoorOpen,
  Receipt,
  CreditCard,
  FileText,
  PieChart,
  Bed,
  PlusCircle,
  LayoutGrid,
  Search,
} from "lucide-react";

import { apiRequest } from "../../lib/api";
import { normalizePaginatedList } from "../../lib/pagination";
import { flattenApiErrors } from "../../lib/errors";
import { canManageBilling } from "../../lib/auth";
import { useAuthGuard } from "../../hooks/useAuthGuard";
import { isPastDueReceivable } from "../../lib/billingReceivables";
import { formatPHP, formatDateString, formatTenantDirectoryName } from "../../lib/formatters";
import Alert from "../_components/ui/Alert";
import { AppMain } from "../_components/ui/AppShell";
import Breadcrumbs from "../_components/ui/Breadcrumbs";
import { Card } from "../_components/ui/Card";
import PageHeader from "../_components/ui/PageHeader";
import { DashboardSkeleton } from "../_components/ui/DashboardSkeleton";
import UserRoleBadge from "../_components/ui/UserRoleBadge";
import { StatusBadge } from "../_components/ui/StatusBadge";
import { KpiCard } from "../_components/ui/KpiCard";
import { Table } from "../_components/ui/Table";
import ResourceView from "../_components/ui/ResourceView";
import { primaryLinkCtaClass } from "../_components/ui/LinkTokens";


const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.2, ease: "easeOut" },
};

function HubItem({ href, label, icon: Icon, colorClass = "text-teal-600 bg-teal-50" }) {
  return (
    <Link
      href={href}
      className="group flex flex-col items-center justify-center gap-2 rounded-2xl border border-stone-200 bg-white py-5 shadow-sm transition-all duration-300 hover:border-teal-200/80 hover:shadow-lg hover:-translate-y-1"
    >
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-xl border border-white/60 shadow-sm transition-[box-shadow,border-color] duration-200 group-hover:shadow ${colorClass}`}
      >
        <Icon size={20} aria-hidden />
      </div>
      <span className="text-center text-[10px] font-bold tracking-widest text-stone-500 transition-colors group-hover:text-teal-700">
        {label}
      </span>
    </Link>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { user: currentUser, authLoading } = useAuthGuard();
  const shouldReduceMotion = useReducedMotion();

  const [segments, setSegments] = useState({
    occupancy: { loading: true, data: null, error: null },
    billing: { loading: true, data: null, error: null },
    tenants: { loading: true, data: null, error: null },
    payments: { loading: true, data: null, error: null },
  });

  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchSegment = useCallback(async (endpoint, segmentKey) => {
    setSegments(prev => ({
      ...prev,
      [segmentKey]: { ...prev[segmentKey], loading: true, error: null }
    }));

    try {
      const data = await apiRequest(endpoint, { method: "GET" });
      setSegments(prev => ({
        ...prev,
        [segmentKey]: { loading: false, data, error: null }
      }));
    } catch (err) {
      setSegments((prev) => ({
        ...prev,
        [segmentKey]: {
          loading: false,
          data: null,
          error: flattenApiErrors(err),
        },
      }));
    }
  }, []);

  const loadAll = useCallback(() => {
    fetchSegment("/api/reports/occupancy", "occupancy");
    fetchSegment("/api/billing?per_page=100", "billing");
    fetchSegment("/api/tenants?per_page=100", "tenants");
    fetchSegment("/api/payments?per_page=100", "payments");
    setLastUpdated(new Date());
  }, [fetchSegment]);

  useEffect(() => {
    if (authLoading || !currentUser) return;
    loadAll();
  }, [authLoading, currentUser, loadAll]);

  const occData = segments.occupancy.data?.summary || {};
  const totalBeds = Number(occData.total_beds || 0);
  const occupiedBeds = Number(occData.occupied_beds || 0);
  const occupancyPct = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

  const tenantList = useMemo(() => {
    const raw = segments.tenants.data;
    if (!raw) return [];
    const { rows } = normalizePaginatedList(raw);
    return rows;
  }, [segments.tenants.data]);
  const activeTenants = tenantList.filter(t => t.status === 'active').length;

  const paymentList = useMemo(() => {
    const raw = segments.payments.data;
    if (!raw) return [];
    const { rows } = normalizePaginatedList(raw);
    return rows;
  }, [segments.payments.data]);

  const billingList = useMemo(() => {
    const raw = segments.billing.data;
    if (!raw) return [];
    const { rows } = normalizePaginatedList(raw);
    return rows;
  }, [segments.billing.data]);
  const todayStr = new Date().toLocaleDateString('en-CA');
  const thisMonth = todayStr.slice(0, 7);

  const stats = billingList.reduce((acc, b) => {
    const balance = Number(b.balance || 0);
    const dueStr = b.due_date?.slice(0, 10);
    const isPastDue = isPastDueReceivable(b);
    const isDueToday = dueStr === todayStr;
    const isThisMonth = b.billing_period_from && b.billing_period_from.startsWith(thisMonth);

    if (isPastDue) {
      acc.overdueCount++;
      acc.overdueTotal += balance;
    }
    if (isDueToday) acc.dueToday.push(b);
    if (isThisMonth) {
      if (balance > 0) acc.monthlyOutstanding += balance;
    }
    return acc;
  }, { overdueCount: 0, overdueTotal: 0, dueToday: [], monthlyOutstanding: 0 });

  const monthlyCollected = paymentList.reduce((acc, p) => {
    if (!p.voided_at && p.payment_date?.startsWith(thisMonth)) {
      return acc + Number(p.amount_paid || 0);
    }
    return acc;
  }, 0);

  /** Posted payments only, most recent first (aligns with "Latest collections"). */
  const recentActivityPayments = useMemo(() => {
    const posted = paymentList.filter((p) => !p.voided_at);
    const time = (p) => {
      const raw = p.payment_date;
      if (!raw) return 0;
      const ms = Date.parse(String(raw));
      return Number.isNaN(ms) ? 0 : ms;
    };
    return [...posted].sort((a, b) => time(b) - time(a)).slice(0, 4);
  }, [paymentList]);

  if (authLoading) return <AppMain><DashboardSkeleton /></AppMain>;

  return (
    <AppMain>
      <PageHeader
        title="Dashboard"
        breadcrumbs={<Breadcrumbs items={[{ label: "Dashboard" }]} />}
        subtitle={
          <div className="flex flex-wrap items-center gap-2">
            Monitor daily activities, occupancy updates, and pending administrative tasks.
            {lastUpdated ? (
              <>
                <span className="text-stone-300" aria-hidden>
                  ·
                </span>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-stone-400">
                  <RefreshCw
                    size={10}
                    className={segments.occupancy.loading ? "animate-spin" : ""}
                    aria-hidden
                  />
                  Updated {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </>
            ) : null}
          </div>
        }
        actions={
          <div className="flex items-center gap-3">
            {canManageBilling(currentUser) ? (
              <Link
                href="/payments/new"
                className={[primaryLinkCtaClass, "h-11 rounded-xl shadow-lg shadow-teal-900/10 active:scale-95"].join(" ")}
              >
                <PlusCircle size={18} aria-hidden />
                <span>Register Payment</span>
              </Link>
            ) : null}
            <div className={`flex items-center ${canManageBilling(currentUser) ? "border-l border-stone-200 pl-3" : ""}`}>
              <UserRoleBadge username={currentUser?.username} roleName={currentUser?.role?.role_name} />
            </div>
          </div>
        }
      />

      <motion.div
        className="mt-6 space-y-6"
        initial={shouldReduceMotion ? false : pageVariants.initial}
        animate={shouldReduceMotion ? false : pageVariants.animate}
        transition={shouldReduceMotion ? { duration: 0 } : pageVariants.transition}
      >
        <AnimatePresence>
          {Object.values(segments).some(s => s.error) && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <Alert variant="error" title="Connectivity issue">
                Some data segments failed to load. The view may be partial.
                <button type="button" onClick={loadAll} className="ml-2 text-xs font-bold underline">
                  Retry
                </button>
              </Alert>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <KpiCard
            label="Overall occupancy"
            icon={DoorOpen}
            value={`${occupancyPct}%`}
            sub={`${occupiedBeds} of ${totalBeds} beds · all units (inventory-wide)`}
            progress={occupancyPct}
            href="/reports/occupancy"
            isLoading={segments.occupancy.loading}
            error={segments.occupancy.error}
          />

          <KpiCard
            label="Active tenants"
            icon={Users}
            value={activeTenants}
            sub="Tenant profiles with status Active"
            href="/tenants"
            isLoading={segments.tenants.loading}
            error={segments.tenants.error}
          />

          <KpiCard
            label="Bookable vacancies"
            icon={Bed}
            value={occData.vacant_beds !== undefined ? Number(occData.vacant_beds) : Math.max(0, totalBeds - occupiedBeds)}
            sub={`Vacant beds in Available rooms only · ${totalBeds} beds in inventory`}
            href="/rooms"
            isLoading={segments.occupancy.loading}
            error={segments.occupancy.error}
          />

          <KpiCard
            label="Overdue billing cycles"
            icon={CreditCard}
            value={stats.overdueCount}
            sub={
              stats.overdueCount > 0
                ? `Balance past due date · ${formatPHP(stats.overdueTotal)}`
                : "Nothing overdue"
            }
            isDanger={stats.overdueCount > 0}
            href="/billing"
            isLoading={segments.billing.loading}
            error={segments.billing.error}
          />

          <KpiCard
            label="Payments this month"
            icon={Receipt}
            value={formatPHP(monthlyCollected)}
            sub="Posted collections · voided payments excluded"
            href="/payments"
            isLoading={segments.payments.loading}
            error={segments.payments.error}
          />

          <KpiCard
            label="Unpaid (new periods)"
            icon={CreditCard}
            value={formatPHP(stats.monthlyOutstanding)}
            sub="Billings with period starting this month · unpaid balance only"
            href="/billing"
            isLoading={segments.billing.loading}
            error={segments.billing.error}
          />

        </div>

        <div className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-8 space-y-6">
            <div className="grid gap-6 md:grid-cols-5">
              <Card className="md:col-span-2 !p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
                <div className="flex items-center gap-2.5 border-b border-stone-100 bg-stone-50/50 px-8 py-5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-stone-100 text-stone-600">
                    <LayoutGrid size={14} aria-hidden />
                  </div>
                  <h2 className="hs-strip-title">Quick Links</h2>
                </div>
                <div className="grid grid-cols-2 gap-4 p-6">
                  <HubItem href="/tenants" label="Tenants" icon={Users} colorClass="bg-blue-50 text-blue-600" />
                  <HubItem href="/rooms" label="Rooms" icon={DoorOpen} colorClass="bg-teal-50 text-teal-600" />
                  <HubItem href="/contracts" label="Contracts" icon={FileText} colorClass="bg-amber-50 text-amber-600" />
                  <HubItem href="/billing" label="Billing" icon={CreditCard} colorClass="bg-rose-50 text-rose-600" />
                  <HubItem href="/payments" label="Payments" icon={Receipt} colorClass="bg-emerald-50 text-emerald-600" />
                  <HubItem href="/reports" label="Reports" icon={PieChart} colorClass="bg-indigo-50 text-indigo-600" />
                </div>
              </Card>

              <div className="md:col-span-3">
                <Card className="h-full !p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
                  <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/50 px-8 py-5">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                        <Receipt size={14} aria-hidden />
                      </div>
                      <div>
                        <h2 className="hs-strip-title">Latest Collections</h2>
                        <p className="mt-0.5 text-xs font-medium text-stone-500">Recently posted payments</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-0">
                    <ResourceView
                      isLoading={segments.payments.loading}
                      isEmpty={recentActivityPayments.length === 0}
                      error={segments.payments.error}
                      emptyProps={{
                        title: "No collections",
                        message: "Recent payments will appear here once recorded in the ledger."
                      }}
                    >
                      <Table
                        embedded
                        columns={[
                          { key: "record", label: "Payment" },
                          { key: "value", label: "Amount paid", className: "text-right" }
                        ]}
                        rows={recentActivityPayments.map(p => (
                          <tr key={p.payment_id} className="hover:bg-stone-50 transition-colors">
                            <td className="px-6 py-4">
                              <div className="font-bold text-stone-900 text-sm">#PAY-{p.payment_id}</div>
                              <div className="text-[10px] text-stone-500 font-bold uppercase tracking-widest leading-none mt-1">
                                {p.billing?.contract?.tenant?.last_name} · {formatDateString(p.payment_date)}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="font-mono text-sm font-bold tabular-nums text-emerald-700">
                                {formatPHP(p.amount_paid)}
                              </div>
                            </td>
                          </tr>
                        ))}
                      />
                    </ResourceView>
                  </div>

                </Card>
              </div>
            </div>

            <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm mt-6">
              <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/50 px-8 py-5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                    <Receipt size={14} aria-hidden />
                  </div>
                  <div>
                    <h2 className="hs-strip-title">Attention: Due Today</h2>
                    <p className="mt-0.5 text-xs font-medium text-stone-500">Cycles reaching due date today</p>
                  </div>
                </div>
              </div>
              <div className="p-0">
                <ResourceView
                  isLoading={segments.billing.loading}
                  isEmpty={stats.dueToday.length === 0}
                  error={segments.billing.error}
                  emptyProps={{
                    title: "All clear for today",
                    message: "There are no billing records reaching their due date today."
                  }}
                >
                  <Table
                    embedded
                    columns={[
                      { key: "tenant", label: "Tenant" },
                      { key: "amount", label: "Balance", className: "text-right" }
                    ]}
                    rows={stats.dueToday.map(b => (
                      <tr
                        key={b.billing_id}
                        className="hover:bg-stone-50 transition-colors cursor-pointer"
                        onClick={() => router.push(`/billing/${b.billing_id}`)}
                      >
                        <td className="px-6 py-4 text-sm font-bold text-stone-900">
                          {formatTenantDirectoryName(b.contract?.tenant)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="font-mono text-sm font-bold tabular-nums text-red-600">
                            {formatPHP(b.balance)}
                          </div>
                        </td>
                      </tr>
                    ))}
                  />
                </ResourceView>
              </div>
            </Card>
          </div>

          <div className="lg:col-span-4 space-y-6">
            <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
              <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/50 px-8 py-5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-stone-100 text-stone-600">
                    <Receipt size={14} aria-hidden />
                  </div>
                  <div>
                    <h2 className="hs-strip-title">Recent Billing</h2>
                    <p className="mt-0.5 text-xs font-medium text-stone-500">Historical ledger records</p>
                  </div>
                </div>
              </div>

              <div className="p-0">
                <ResourceView
                  isLoading={segments.billing.loading}
                  isEmpty={billingList.length === 0}
                  error={segments.billing.error}
                  emptyProps={{
                    title: "No billing yet",
                    message: "Records will appear here once billing is generated."
                  }}
                >
                  <div className="divide-y divide-stone-50">
                    {billingList.slice(0, 5).map((b) => (
                      <div
                        key={b.billing_id}
                        className="px-6 py-4 hover:bg-stone-50 cursor-pointer transition-colors"
                        onClick={() => router.push(`/billing/${b.billing_id}`)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-bold text-stone-900">
                              {b.contract?.tenant?.last_name}, {b.contract?.tenant?.first_name?.charAt(0)}.
                            </p>
                            <p className="font-mono text-[10px] font-bold uppercase tracking-tighter text-stone-400">
                              Room {b.contract?.room?.room_code || "—"}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-mono text-xs font-bold tabular-nums text-stone-800">{formatPHP(b.total_amount)}</p>
                            <StatusBadge size="xs">{b.status}</StatusBadge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ResourceView>
              </div>

            </Card>
          </div>
        </div>
      </motion.div>
    </AppMain>
  );
}
