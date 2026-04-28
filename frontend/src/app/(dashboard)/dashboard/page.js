"use client";
import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Users, Receipt, Calendar, _CreditCard, PlusCircle,
  DoorOpen, _Bed, Lock, AlertTriangle, HandCoins, Activity
} from "lucide-react";
import useSWR from "swr";
import { fetcher } from "@/lib/api";
import { normalizePaginatedList, normalizeReportRows } from "@/lib/pagination";
import { canManageBilling } from "@/lib/auth";
import {
  formatDateString,
  formatTenantDirectoryName,
  formatTimestamp,
  getTodayDate
} from "@/lib/formatters";
import CurrencyDisplay from "@/components/ui/CurrencyDisplay";
import Alert from "@/components/ui/Alert";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import { Card } from "@/components/ui/Card";
import { DashboardSkeleton } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { KpiCard } from "@/components/ui/KpiCard";
import { Table } from "@/components/ui/Table";
import ResourceView from "@/components/ui/ResourceView";
import StandardPage from "@/components/ui/StandardPage";
import ResourceIdCell from "@/components/ui/ResourceIdCell";
import { useAuth } from "@/context/AuthContext";
import PageHeaderActions from "@/components/ui/PageHeaderActions";
import { Sparkline } from "@/components/ui/Sparkline";
export default function PlatformDashboardPage() {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const todayStr = getTodayDate();
  const canSeeFinancials = canManageBilling(currentUser);
  const lockedValue = (
    <div className="flex items-center gap-2" title="Role restricted: Administrative financials">
      <Lock size={18} className="text-stone-300" aria-hidden />
      <span className="text-lg text-stone-300 font-black">HIDDEN</span>
    </div>
  );
  // Core data hooks for dashboard context
  const { data: occupancyReport, error: occError, isLoading: occLoading, mutate: mutateOcc, isValidating: occValidating } = useSWR(
    currentUser ? "/api/reports/occupancy" : null,
    fetcher,
    { dedupingInterval: 5000 }
  );
  const { data: billingSummaryReport, error: billSummaryError, isLoading: billSummaryLoading, mutate: mutateBillSummary, isValidating: billSummaryValidating } = useSWR(
    currentUser ? "/api/reports/billing-summary?current_month=1" : null,
    fetcher,
    { dedupingInterval: 10000 }
  );
  const { data: billingReport, error: billError, isLoading: billLoading, mutate: mutateBill, isValidating: billValidating } = useSWR(
    currentUser ? "/api/reports/outstanding-balances?per_page=100" : null,
    fetcher,
    { dedupingInterval: 30000 }
  );
  const { data: activeTenantsData, error: tenantError, isLoading: tenantLoading, mutate: mutateTenants, isValidating: tenantValidating } = useSWR(
    currentUser ? "/api/tenants?status=active&per_page=1" : null,
    fetcher,
    { dedupingInterval: 60000 }
  );
  const { data: recentPayments, error: payError, isLoading: payLoading, mutate: mutatePay, isValidating: payValidating } = useSWR(
    currentUser ? "/api/payments?per_page=5" : null,
    fetcher,
    { dedupingInterval: 5000 }
  );
  const { data: dueTodayData, error: dueError, isLoading: dueLoading, mutate: mutateDue, isValidating: dueValidating } = useSWR(
    currentUser ? `/api/billing?due_date=${todayStr}` : null,
    fetcher,
    { dedupingInterval: 10000 }
  );
  const { data: contractsData, isLoading: contractsLoading, mutate: mutateContracts } = useSWR(
    currentUser ? "/api/contracts?status=active&per_page=50" : null,
    fetcher,
    { dedupingInterval: 10000 }
  );
  const loadAll = () => {
    mutateOcc();
    mutateBillSummary();
    mutateBill();
    mutateTenants();
    mutatePay();
    mutateDue();
    mutateContracts();
  };
  const occSummary = occupancyReport?.summary || {};
  const billSummary = billingSummaryReport?.summary || {};
  const totalBeds = Number(occSummary.total_beds || 0);
  const occupiedBeds = Number(occSummary.occupied_beds || 0);
  const vacantBeds = Number(occSummary.vacant_beds || 0);
  const _maintenanceBeds = Math.max(0, totalBeds - occupiedBeds - vacantBeds);
  const occupancyPct = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;
  const { rows: payments = [] } = useMemo(() => normalizePaginatedList(recentPayments), [recentPayments]);
  const { rows: dueTodayRaw = [] } = useMemo(() => normalizePaginatedList(dueTodayData), [dueTodayData]);
  const { meta: activeTenantsMeta, rows: activeTenantRows = [] } = useMemo(() => normalizePaginatedList(activeTenantsData), [activeTenantsData]);
  const activeTenantCount = Number(activeTenantsMeta?.total ?? activeTenantRows.length ?? 0);
  const dueTodayList = useMemo(() => dueTodayRaw.filter(b => b.status === "unpaid" || b.status === "partial"), [dueTodayRaw]);
  const { rows: recentBillings = [] } = useMemo(() => normalizeReportRows(billingReport), [billingReport]);
  const globalBillSummary = billingReport?.summary || {};
  const strictlyOverdueCount = Number(globalBillSummary.overdue_count || 0);
  const strictlyOverdueTotal = Number(globalBillSummary.overdue_total || 0);
  const { rows: contractRows = [] } = useMemo(() => normalizePaginatedList(contractsData), [contractsData]);
  // Derived Analytics: Turnover Schedule
  const turnoverSchedule = useMemo(() => {
    const today = new Date();
    const range = 30; // BR-019
    const thresholdDate = new Date();
    thresholdDate.setDate(today.getDate() + range);
    return contractRows.map(c => {
      const moveOut = c.expected_move_out_date ? new Date(c.expected_move_out_date) : null;
      const moveIn = c.move_in_date ? new Date(c.move_in_date) : null;
      if (moveOut && moveOut >= today && moveOut <= thresholdDate) {
        return { type: 'move_out', date: moveOut, contract: c };
      }
      if (moveIn && moveIn >= today && moveIn <= thresholdDate) {
        return { type: 'move_in', date: moveIn, contract: c };
      }
      return null;
    }).filter(Boolean).sort((a, b) => a.date - b.date);
  }, [contractRows]);
  const loading = occLoading || billSummaryLoading || billLoading || tenantLoading || payLoading || dueLoading || contractsLoading;
  return (
    <StandardPage
      title="Dashboard"
      subtitle="Real-time operational overview and financial summary."
      loading={loading}
      skeleton={<DashboardSkeleton />}
      actions={
        <PageHeaderActions
          ctaHref={canManageBilling(currentUser) ? "/billing/new" : null}
          ctaLabel="Generate Bills"
          ctaIcon={PlusCircle}
          user={currentUser}
        />
      }
    >
      <div className="space-y-8">
        {occError || billSummaryError || billError || tenantError || payError || dueError ? (
          <Alert variant="error" title="Connectivity issue">
            Some data segments failed to load. The view may be partial.
            <button type="button" onClick={loadAll} className="ml-2 text-xs font-bold underline">
              Retry
            </button>
          </Alert>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Occupancy Rate"
            icon={DoorOpen}
            value={`${occupancyPct}%`}
            sub={`${occupiedBeds}/${totalBeds} BEDS OCCUPIED`}
            progress={occupancyPct}
            href="/rooms"
            isLoading={occLoading}
            isSyncing={occValidating}
            error={occError}
            className="hs-glass-effect"
          />
          <KpiCard
            label="Active Tenants"
            icon={Users}
            value={activeTenantCount}
            sub="TOTAL ACTIVE PROFILES"
            href="/tenants"
            isLoading={tenantLoading}
            isSyncing={tenantValidating}
            error={tenantError}
            className="hs-glass-effect"
          />
          <KpiCard
            label="Overdue Balances"
            icon={AlertTriangle}
            value={canSeeFinancials ? strictlyOverdueCount : lockedValue}
            sub={canSeeFinancials ? (strictlyOverdueCount > 0 ? (
              <span className="flex items-center gap-1">
                {strictlyOverdueCount} UNPAID BILL{strictlyOverdueCount === 1 ? '' : 'S'} · <CurrencyDisplay amount={strictlyOverdueTotal} />
              </span>
            ) : "ALL ACCOUNTS CURRENT") : "RESTRICTED VIEW"}
            isDanger={canSeeFinancials && strictlyOverdueCount > 0}
            isNeutral={canSeeFinancials && strictlyOverdueCount === 0}
            isActiveDecision={canSeeFinancials && strictlyOverdueCount > 0}
            href={canSeeFinancials ? "/billing?status=overdue" : null}
            isLoading={billLoading}
            isSyncing={billValidating}
            error={billError}
            className="hs-glass-effect"
          />
          <KpiCard
            label="Monthly Collections"
            icon={HandCoins}
            value={canSeeFinancials ? billSummary.collected_total : lockedValue}
            sub={canSeeFinancials ? "TOTAL POSTED THIS MONTH" : "RESTRICTED VIEW"}
            isSuccess={canSeeFinancials && Number(billSummary.collected_total) > 0}
            href={canSeeFinancials ? "/payments" : null}
            isLoading={billSummaryLoading}
            isSyncing={billSummaryValidating}
            error={billSummaryError}
            currency={canSeeFinancials}
            className="hs-glass-effect"
          />
        </div>
        {/* Operational Intelligence Grid (Balanced 2-Column Row-Based Grid) */}
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Turnover Forecast */}
          <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm h-full flex flex-col hs-glass-effect">
            <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/50 px-8 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                  <Activity size={13} aria-hidden />
                </div>
                <h2 className="hs-strip-title text-stone-400">Arrivals & Departures</h2>
              </div>
              <Link href="/contracts" className="text-[10px] font-bold uppercase tracking-widest text-teal-600 hover:text-teal-700 transition-colors">
                View Schedule →
              </Link>
            </div>
            <div className="p-0 flex-1">
              <ResourceView
                isLoading={contractsLoading}
                isEmpty={turnoverSchedule.length === 0}
                emptyProps={{
                  title: "Quiet window ahead",
                  description: "No scheduled arrivals or departures for the next 30 days.",
                  variant: "compact"
                }}
              >
                <Table
                  embedded
                  columns={[
                    { key: "type", label: "EVENT", className: "px-8" },
                    { key: "tenant", label: "TENANT" },
                    { key: "date", label: "SCHEDULE", className: "px-8 text-right" }
                  ]}
                  rows={turnoverSchedule.slice(0, 5).map((item, idx) => (
                    <tr
                      key={`${item.contract.contract_id}-${idx}`}
                      className="hover:bg-stone-50/80 transition-colors cursor-pointer group"
                      onClick={() => router.push(`/contracts/${item.contract.contract_id}`)}
                    >
                      <td className="px-8 py-4">
                        <StatusBadge
                          size="xs"
                          variant={item.type === 'move_out' ? 'danger' : 'success'}
                        >
                          {item.type === 'move_out' ? 'Departure' : 'Arrival'}
                        </StatusBadge>
                      </td>
                      <td className="py-4">
                        <div className="text-sm font-bold text-stone-900 group-hover:text-teal-700 transition-colors">
                          {formatTenantDirectoryName(item.contract.tenant)}
                        </div>
                        <div className="text-[10px] font-mono font-bold uppercase text-stone-400 mt-1">
                          Room {item.contract.bed_space?.room?.room_code || "—"}
                        </div>
                      </td>
                      <td className="px-8 py-4 text-right">
                        <div className="font-mono text-[10px] font-black uppercase text-stone-500 tabular-nums">
                          {formatDateString(item.date)}
                        </div>
                      </td>
                    </tr>
                  ))}
                />
              </ResourceView>
            </div>
            {!contractsLoading && turnoverSchedule.length > 0 && (
              <div className="border-t border-stone-100 bg-stone-50/30 px-8 py-3.5 mt-auto">
                <Link href="/contracts" className="text-[10px] font-bold uppercase tracking-widest text-stone-400 hover:text-teal-600 transition-colors">
                  View Full Schedule →
                </Link>
              </div>
            )}
          </Card>
          {/* Latest Collections */}
          <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm h-full flex flex-col hs-glass-effect">
            <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/50 px-8 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                  <Receipt size={14} aria-hidden />
                </div>
                <h2 className="hs-strip-title text-stone-400">Latest Payments</h2>
              </div>
              <Link href="/payments" className="text-[10px] font-bold uppercase tracking-widest text-teal-600 hover:text-teal-700 transition-colors">
                View Ledger →
              </Link>
            </div>
            <div className="p-0 flex-1">
              <ResourceView
                isLoading={payLoading}
                isSyncing={payValidating}
                isEmpty={payments.length === 0}
                error={payError}
                emptyProps={{
                  title: "No collections",
                  description: "No recent payments recorded today. View full history",
                  variant: "compact"
                }}
              >
                <Table
                  embedded
                  columns={[
                    { key: "record", label: "PAYMENT ID", className: "px-8 w-32" },
                    { key: "tenant", label: "Tenant", className: "w-1/2" },
                    { key: "value", label: "Amount paid", className: "px-8 text-right" }
                  ]}
                  rows={payments.map((p) => (
                    <tr
                      key={p.payment_id}
                      className="hover:bg-stone-50/80 transition-colors cursor-pointer group"
                      onClick={() => router.push(`/payments/${p.payment_id}`)}
                    >
                      <td className="px-8 py-4">
                        <ResourceIdCell id={p.payment_id} type="payment" />
                      </td>
                      <td className="py-4">
                        <div className="text-sm font-bold text-stone-900 group-hover:text-teal-700 transition-colors leading-none">
                          {p.billing?.contract?.tenant ? formatTenantDirectoryName(p.billing.contract.tenant) : "—"}
                        </div>
                        <div className="text-[10px] font-mono tabular-nums tracking-tighter text-stone-400 mt-1.5 uppercase font-bold">
                          {formatTimestamp(p.created_at)}
                        </div>
                      </td>
                      <td className="px-8 py-4 text-right">
                        <div className="flex flex-col items-end gap-1">
                          <CurrencyDisplay
                            amount={p.amount_paid}
                            className="text-sm font-bold text-teal-700"
                          />
                          {p.correlation_id && (
                            <div className="font-mono text-[8px] font-bold text-stone-400 bg-stone-100 rounded-full px-2 py-0.5" title={`Workflow ID: ${p.correlation_id.toUpperCase()}`}>
                              #WF-{p.correlation_id.slice(0, 5).toUpperCase()}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                />
              </ResourceView>
            </div>
          </Card>
          {/* Due Today */}
          <Card className={`!p-0 overflow-hidden rounded-2xl shadow-sm h-full flex flex-col transition-all duration-1000 hs-glass-effect ${dueTodayList.length > 0 ? "border-[#f87171] ring-2 ring-[#f87171]/20 shadow-[0_0_15px_rgba(248,113,113,0.3)]" : "border-stone-200"}`}>
            <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/50 px-8 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 text-red-600">
                  <Calendar size={13} aria-hidden />
                </div>
                <h2 className="hs-strip-title text-stone-400">Attention: Due Today</h2>
              </div>
              <div className="text-[10px] font-bold text-red-500 uppercase tracking-widest flex items-center gap-1.5">
                <div className="size-1 rounded-full bg-red-500 animate-pulse" />
                Active window
              </div>
            </div>
            <div className="p-0 flex-1">
              <ResourceView
                isLoading={dueLoading}
                isSyncing={dueValidating}
                isEmpty={dueTodayList.length === 0}
                error={dueError}
                emptyProps={{
                  title: "All clear for today",
                  description: "No billing records reaching their due date today.",
                  variant: "compact"
                }}
              >
                <Table
                  embedded
                  columns={[
                    { key: "tenant", label: "TENANT NAME", className: "px-8" },
                    { key: "billing", label: "BILLING ID" },
                    { key: "amount", label: "UNPAID BALANCE", className: "px-8 text-right" },
                    { key: "actions", label: "PROCESS", className: "px-8 text-right" }
                  ]}
                  rows={dueTodayList.map(b => (
                    <tr
                      key={b.billing_id}
                      className="hover:bg-stone-50/80 transition-colors cursor-pointer group"
                      onClick={() => router.push(`/billing/${b.billing_id}`)}
                    >
                      <td className="px-8 py-4 text-sm font-bold text-stone-900 group-hover:text-teal-700 transition-colors">
                        {b.contract?.tenant ? formatTenantDirectoryName(b.contract.tenant) : "—"}
                      </td>
                      <td className="py-4">
                        <ResourceIdCell id={b.billing_id} type="billing" />
                      </td>
                      <td className="px-8 py-4 text-right">
                        <div className="text-sm font-bold text-red-600">
                          <CurrencyDisplay amount={b.balance} />
                        </div>
                      </td>
                      <td className="px-8 py-4 text-right">
                        <Link
                          href={`/payments/new?billing_id=${b.billing_id}`}
                          className="text-[10px] font-black uppercase tracking-widest text-teal-600 hover:text-teal-700 transition-all border border-teal-100 bg-teal-50 px-3 py-1.5 rounded-lg whitespace-nowrap inline-block"
                        >
                          Record Payment
                        </Link>
                      </td>
                    </tr>
                  ))}
                />
              </ResourceView>
            </div>
          </Card>
          {/* Recent Billing */}
          <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm h-full flex flex-col hs-glass-effect">
            <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/50 px-8 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                  <Receipt size={14} aria-hidden />
                </div>
                <h2 className="hs-strip-title text-stone-400">Recent Bills</h2>
              </div>
              <Link href="/billing" className="text-[10px] font-bold uppercase tracking-widest text-stone-400 hover:text-teal-600 transition-colors">
                View All →
              </Link>
            </div>
            <div className="p-0 flex-1">
              <ResourceView
                isLoading={billLoading}
                isSyncing={billValidating}
                isEmpty={recentBillings.length === 0}
                error={billError}
                emptyProps={{
                  title: "No billing yet",
                  description: "Records will appear here once generated.",
                  variant: "compact"
                }}
              >
                <Table
                  embedded
                  columns={[
                    { key: "record", label: "TENANT", className: "px-8" },
                    { key: "amount", label: "BILLED AMOUNT", className: "px-8 text-right" }
                  ]}
                  rows={recentBillings.slice(0, 5).map((b) => (
                    <tr
                      key={b.billing_id}
                      className="hover:bg-stone-50/80 transition-colors cursor-pointer group"
                      onClick={() => router.push(`/billing/${b.billing_id}`)}
                    >
                      <td className="px-8 py-4">
                        <div className="text-sm font-bold text-stone-900 group-hover:text-teal-700 transition-colors">
                          {b.tenant_name}
                        </div>
                        <div className="mt-1.5 flex items-center gap-2">
                          <ResourceIdCell id={b.billing_id} type="billing" />
                          <span className="opacity-50 text-[10px] font-black tracking-widest text-stone-300">·</span>
                          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-stone-400">ROOM-{(b.room_code || "—").replace('UNIT-', '')}</span>
                        </div>
                      </td>
                      <td className="px-8 py-4 text-right">
                        <div className="text-sm font-bold text-stone-900">
                          <CurrencyDisplay amount={b.amount_due} />
                        </div>
                        <div className="mt-1.5">
                          <StatusBadge size="xs">{b.status}</StatusBadge>
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
    </StandardPage>
  );
}
