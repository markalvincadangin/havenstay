"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Users, Receipt, Calendar, CreditCard, PlusCircle,
  DoorOpen, Bed
} from "lucide-react";
import useSWR from "swr";
import { fetcher } from "../../lib/api";
import { normalizePaginatedList, normalizeReportRows } from "../../lib/pagination";
import { canManageBilling } from "../../lib/auth";
import { formatPHP, formatDateString, formatTenantDirectoryName } from "../../lib/formatters";
import Alert from "../_components/ui/Alert";
import Breadcrumbs from "../_components/ui/Breadcrumbs";
import { Card } from "../_components/ui/Card";
import { DashboardSkeleton } from "../_components/ui/Skeleton";
import { StatusBadge } from "../_components/ui/StatusBadge";
import { KpiCard } from "../_components/ui/KpiCard";
import { Table } from "../_components/ui/Table";
import ResourceView from "../_components/ui/ResourceView";
import StandardPage from "../_components/ui/StandardPage";
import ResourceIdCell from "../_components/ui/ResourceIdCell";
import { useAuth } from "../_context/AuthContext";
import PageHeaderActions from "../_components/ui/PageHeaderActions";
import { Sparkline } from "../_components/ui/Sparkline";

export default function DashboardPage() {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const todayStr = new Date().toLocaleDateString('en-CA');

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
  const maintenanceBeds = Math.max(0, totalBeds - occupiedBeds - vacantBeds);
  const occupancyPct = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

  const { rows: payments = [] } = useMemo(() => normalizePaginatedList(recentPayments), [recentPayments]);
  const { rows: dueTodayRaw = [] } = useMemo(() => normalizePaginatedList(dueTodayData), [dueTodayData]);
  const { meta: activeTenantsMeta, rows: activeTenantRows = [] } = useMemo(() => normalizePaginatedList(activeTenantsData), [activeTenantsData]);
  const activeTenantCount = Number(activeTenantsMeta?.total ?? activeTenantRows.length ?? 0);
  const dueTodayList = useMemo(() => dueTodayRaw.filter(b => (b.balance ?? 0) > 0), [dueTodayRaw]);
  const { rows: recentBillings = [] } = useMemo(() => normalizeReportRows(billingReport), [billingReport]);

  const strictlyOverdueCount = useMemo(() => {
    return recentBillings.filter(b => {
      const s = b.status?.toLowerCase().replace(/\s+/g, '_') || '';
      return (s === 'overdue' || s === 'past_due') && (Number(b.total_paid || 0) === 0);
    }).length;
  }, [recentBillings]);

  const strictlyOverdueTotal = useMemo(() => {
    return recentBillings
      .filter(b => {
        const s = b.status?.toLowerCase().replace(/\s+/g, '_') || '';
        return (s === 'overdue' || s === 'past_due') && (Number(b.total_paid || 0) === 0);
      })
      .reduce((sum, b) => sum + Number(b.amount_due || 0), 0);
  }, [recentBillings]);

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
      subtitle="Monitor daily activities, occupancy updates, and pending administrative tasks."
      breadcrumbs={<Breadcrumbs items={[{ label: "Dashboard" }]} />}
      loading={loading}
      skeleton={<DashboardSkeleton />}
      actions={
        <PageHeaderActions
          ctaHref={canManageBilling(currentUser) ? "/payments/new" : null}
          ctaLabel="Record Payment"
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

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <KpiCard
            label="Occupancy Rate"
            icon={DoorOpen}
            value={`${occupancyPct}%`}
            sub={`${occupiedBeds}/${totalBeds} BEDS OCCUPIED`}
            progress={occupancyPct}
            href="/reports/occupancy"
            isLoading={occLoading}
            isSyncing={occValidating}
            error={occError}
          />

          <KpiCard
            label="Active Tenants"
            icon={Users}
            value={activeTenantCount}
            sub="CURRENTLY ON-PREMISE"
            href="/tenants"
            isLoading={tenantLoading}
            isSyncing={tenantValidating}
            error={tenantError}
          />

          <KpiCard
            label="Vacancies"
            icon={Bed}
            value={vacantBeds}
            sub={maintenanceBeds > 0 ? `${maintenanceBeds} BEDS UNDER MAINTENANCE` : "BOOKABLE BEDS AVAILABLE"}
            href="/rooms"
            isLoading={occLoading}
            isSyncing={occValidating}
            error={occError}
          />

          <KpiCard
            label="Overdue"
            icon={CreditCard}
            value={strictlyOverdueCount}
            sub={strictlyOverdueCount > 0 ? `ZERO PAYMENT · ${formatPHP(strictlyOverdueTotal)}` : "ALL ACCOUNTS CURRENT"}
            isDanger={strictlyOverdueCount > 0}
            href="/billing"
            isLoading={billLoading}
            isSyncing={billValidating}
            error={billError}
          />

          <KpiCard
            label="MTD Collections"
            icon={Receipt}
            value={formatPHP(billSummary.collected_total)}
            sub="TOTAL POSTED THIS MONTH"
            isSuccess={Number(billSummary.collected_total) > 0}
            href="/payments"
            isLoading={billSummaryLoading}
            isSyncing={billSummaryValidating}
            error={billSummaryError}
            sparkline={<Sparkline data={[15, 30, 25, 45, 40, 65]} color="stroke-emerald-500" />}
          />

          <KpiCard
            label="Outstanding"
            icon={CreditCard}
            value={formatPHP(billSummary.outstanding_total)}
            sub="TOTAL UNCOLLECTED BALANCE"
            isWarning={Number(billSummary.outstanding_total) > 0}
            href="/billing"
            isLoading={billSummaryLoading}
            isSyncing={billSummaryValidating}
            error={billSummaryError}
          />
        </div>

        {/* Operational Intelligence Grid (Balanced 2-Column Row-Based Grid) */}
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Turnover Forecast */}
          <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm h-full flex flex-col">
            <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/50 px-8 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  <Calendar size={13} aria-hidden />
                </div>
                <h2 className="hs-strip-title uppercase tracking-widest text-[10px] font-bold text-stone-400">Turnover Forecast</h2>
              </div>
              <div className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Next 30 Days</div>
            </div>
            <div className="p-0 flex-1">
              <ResourceView
                isLoading={contractsLoading}
                isEmpty={turnoverSchedule.length === 0}
                emptyProps={{
                  title: "Quiet window ahead",
                  message: "No departures or arrivals scheduled for the next 30 days.",
                  variant: "compact"
                }}
              >
                <div className="hs-border-t border-stone-100">
                  <Table
                    embedded
                    columns={[
                      { key: "type", label: "STATUS" },
                      { key: "tenant", label: "RESIDENT" },
                      { key: "date", label: "SCHEDULE", className: "text-right" }
                    ]}
                    rows={turnoverSchedule.slice(0, 5).map((item, idx) => (
                      <tr
                        key={`${item.contract.contract_id}-${idx}`}
                        className="hover:bg-stone-50 transition-colors cursor-pointer group"
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
                        <td className="px-8 py-4 text-sm font-bold text-stone-900 group-hover:text-teal-700 transition-colors">
                          {formatTenantDirectoryName(item.contract.tenant)}
                        </td>
                        <td className="px-8 py-4 text-right">
                          <div className="font-mono text-[10px] font-bold uppercase text-stone-500">
                            {formatDateString(item.date)}
                          </div>
                        </td>
                      </tr>
                    ))}
                  />
                </div>
              </ResourceView>
            </div>
            <div className="border-t border-stone-100 bg-stone-50/30 px-8 py-3.5 mt-auto">
              <Link href="/contracts" className="text-[10px] font-bold uppercase tracking-widest text-stone-400 hover:text-teal-600 transition-colors">
                View Full Schedule →
              </Link>
            </div>
          </Card>

          {/* Latest Collections */}
          <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm h-full flex flex-col">
            <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/50 px-8 py-5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-stone-50 text-stone-600">
                  <Receipt size={14} aria-hidden />
                </div>
                <div>
                  <h2 className="hs-strip-title uppercase tracking-widest text-[11px] font-black text-stone-400">Latest Collections</h2>
                </div>
              </div>
            </div>

            <div className="p-0 flex-1">
              <ResourceView
                isLoading={payLoading}
                isSyncing={payValidating}
                isEmpty={payments.length === 0}
                error={payError}
                emptyProps={{
                  title: "No collections",
                  message: "Recent items will appear here once recorded.",
                  variant: "compact"
                }}
              >
                <Table
                  embedded
                  columns={[
                    { key: "record", label: "ID" },
                    { key: "tenant", label: "TENANT" },
                    { key: "value", label: "AMOUNT", className: "text-right" }
                  ]}
                  rows={payments.map((p) => (
                    <tr
                      key={p.payment_id}
                      className="hover:bg-stone-50 transition-colors cursor-pointer group"
                      onClick={() => router.push(`/payments/${p.payment_id}`)}
                    >
                      <td className="px-6 py-3">
                        <ResourceIdCell id={p.payment_id} prefix="PAY" />
                      </td>
                      <td className="px-8 py-4">
                        <div className="text-sm font-bold text-stone-900 group-hover:text-teal-700 transition-colors leading-none">
                          {formatTenantDirectoryName(p.billing?.contract?.tenant)}
                        </div>
                        <div className="text-[10px] font-mono tracking-tighter text-stone-400 mt-1 uppercase">
                          {formatDateString(p.payment_date)}
                        </div>
                      </td>
                      <td className="px-6 py-3 text-right">
                        <div className="font-mono text-sm font-bold tabular-nums text-teal-700">
                          {formatPHP(p.amount_paid)}
                        </div>
                      </td>
                    </tr>
                  ))}
                />
              </ResourceView>
            </div>
          </Card>

          {/* Due Today */}
          <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm h-full flex flex-col">
            <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/50 px-8 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 text-red-600">
                  <Calendar size={13} aria-hidden />
                </div>
                <h2 className="hs-strip-title uppercase tracking-widest text-[10px] font-bold text-stone-400">Attention: Due Today</h2>
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
                  message: "There are no billing records reaching their due date today.",
                  variant: "compact"
                }}
              >
                <div className="hs-border-t border-stone-100">
                  <Table
                    embedded
                    columns={[
                      { key: "tenant", label: "TENANT" },
                      { key: "billing", label: "ID" },
                      { key: "amount", label: "BALANCE", className: "text-right" }
                    ]}
                    rows={dueTodayList.map(b => (
                      <tr
                        key={b.billing_id}
                        className="hover:bg-stone-50 transition-colors cursor-pointer group"
                        onClick={() => router.push(`/billing/${b.billing_id}`)}
                      >
                        <td className="px-8 py-4 text-sm font-bold text-stone-900 group-hover:text-teal-700 transition-colors">
                          {formatTenantDirectoryName(b.contract?.tenant)}
                        </td>
                        <td className="px-8 py-4">
                          <ResourceIdCell id={b.billing_id} prefix="BILL" />
                        </td>
                        <td className="px-8 py-4 text-right">
                          <div className="font-mono text-sm font-bold tabular-nums text-red-600">
                            {formatPHP(b.balance)}
                          </div>
                        </td>
                      </tr>
                    ))}
                  />
                </div>
              </ResourceView>
            </div>
          </Card>

          {/* Recent Billing */}
          <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm h-full flex flex-col">
            <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/50 px-8 py-5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-stone-100 text-stone-600">
                  <Receipt size={14} aria-hidden />
                </div>
                <div>
                  <h2 className="hs-strip-title uppercase tracking-widest text-[11px] font-black text-stone-400">Recent Billing</h2>
                </div>
              </div>
            </div>

            <div className="p-0 flex-1">
              <ResourceView
                isLoading={billLoading}
                isSyncing={billValidating}
                isEmpty={recentBillings.length === 0}
                error={billError}
                emptyProps={{
                  title: "No billing yet",
                  message: "Records will appear here once generated.",
                  variant: "compact"
                }}
              >
                <Table
                  embedded
                  columns={[
                    { key: "record", label: "ID" },
                    { key: "amount", label: "TOTAL", className: "text-right" }
                  ]}
                  rows={recentBillings.slice(0, 5).map((b) => (
                    <tr
                      key={b.billing_id}
                      className="hover:bg-stone-50 transition-colors cursor-pointer group"
                      onClick={() => router.push(`/billing/${b.billing_id}`)}
                    >
                      <td className="px-8 py-5">
                        <div className="text-sm font-bold text-stone-900 group-hover:text-teal-700 transition-colors">
                          {b.tenant_name}
                        </div>
                        <div className="mt-1.5 flex items-center gap-2 text-[10px] font-bold text-stone-400">
                          <ResourceIdCell id={b.billing_id} prefix="BILL" />
                          <span className="opacity-50">·</span>
                          <span className="uppercase tracking-widest">RM {b.room_code || "—"}</span>
                        </div>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <div className="font-mono text-sm font-black tabular-nums text-stone-900">
                          {formatPHP(b.amount_due)}
                        </div>
                        <div className="mt-2">
                          <StatusBadge size="xs" variant="pastel">{b.status}</StatusBadge>
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
