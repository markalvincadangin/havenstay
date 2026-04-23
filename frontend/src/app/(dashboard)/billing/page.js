"use client";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { FileText, Search, AlertCircle, PlusCircle, Activity, Wallet, Receipt } from "lucide-react";
import useSWR from "swr";
import { fetcher } from "@/lib/api";
import { canManageBilling, canViewBilling } from "@/lib/auth";
import { useTableSort } from "@/hooks/useTableSort";
import { sortClientRows } from "@/lib/tableSort";
import {
  compareTenantDirectoryName,
  formatDateString,
  formatPHP,
  formatTenantDirectoryName,
  getCurrentMonthRange,
} from "@/lib/formatters";
import Alert from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import FilterPanelCard from "@/components/ui/FilterPanelCard";
import FilterChips from "@/components/ui/FilterChips";
import { Field, Input, Select } from "@/components/ui/Fields";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table } from "@/components/ui/Table";
import { KpiCard } from "@/components/ui/KpiCard";
import {
  BILLING_STATUS_LABELS,
} from "@/lib/constants";
import {
  normalizePaginatedList,
} from "@/lib/pagination";
import ResourceView from "@/components/ui/ResourceView";
import TablePagination from "@/components/ui/TablePagination";
import StandardPage from "@/components/ui/StandardPage";
import { SkeletonListPage } from "@/components/ui/Skeleton";
import PageHeaderActions from "@/components/ui/PageHeaderActions";
import ResourceIdCell from "@/components/ui/ResourceIdCell";
import { useAuth } from "@/context/AuthContext";
import { usePaginatedFilters } from "@/hooks/usePaginatedFilters";
import { CorrelationIdCell } from "@/components/ui/CorrelationIdCell";
import RowOpenIndicator from "@/components/ui/RowOpenIndicator";
import { ExpandableTableRow } from "@/components/ui/ExpandableTableRow";
import Button from "@/components/ui/Button";
import { interactiveTableRowClass } from "@/lib/tableRows";
export default function BillingListPage() {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const { filters, updateFilter, resetFilters, page, setPage, perPage, setPerPage, queryString } =
    usePaginatedFilters({
      initialFilters: { query: "", status: "all" },
      debounceKeys: ["query"],
      buildExtraParams: ({ filters: current, debounced }) => {
        const extra = {};
        const q = String(debounced.query ?? "").trim();
        if (q) extra.q = q;
        if (current.status !== "all") extra.status = current.status;
        return extra;
      },
    });
  const statusFilter = filters.status;
  const tenantQuery = filters.query;
  const { sortColumn, sortDirection, onSortChange } = useTableSort();
  const canView = useMemo(() => canViewBilling(currentUser), [currentUser]);
  // KPIs
  const { data: outstandingData, isValidating: outstandingValidating } = useSWR(
    currentUser && canView ? "/api/reports/outstanding-balances" : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  );
  const { data: _collectionsData, isValidating: _collectionsValidating } = useSWR(
    currentUser && canView ? (() => {
      const { start, end } = getCurrentMonthRange();
      return `/api/reports/collections-performance?start_date=${start}&end_date=${end}`;
    })() : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  );
  const { data: billingSummaryData, isValidating: summaryValidating } = useSWR(
    currentUser && canView ? "/api/reports/billing-summary?current_month=true" : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  );
  const totalBilled = billingSummaryData?.summary?.billed_total ?? 0;
  const recoveryRate = billingSummaryData?.summary?.recovery_rate ?? 0;
  const totalOutstanding = outstandingData?.summary?.total_outstanding ?? 0;
  const overdueVolume = outstandingData?.summary?.overdue_total ?? 0;
  const overdueCount = outstandingData?.summary?.overdue_count ?? 0;
  // Billings
  const { data: billingData, error: billingError, isValidating: isSyncing, mutate: refetchBillings } = useSWR(
    currentUser && canView ? `/api/billing${queryString}` : null,
    fetcher,
    { keepPreviousData: true, dedupingInterval: 30000 }
  );
  const { rows: billings = [], meta: listMeta = null } = useMemo(() => {
    if (!billingData) return { rows: [], meta: null };
    return normalizePaginatedList(billingData);
  }, [billingData]);
  const loading = !billingData && !billingError;
  const sortedFiltered = useMemo(() => {
    if (!sortColumn) return billings;
    if (sortColumn === "tenant") {
      const list = [...billings];
      const dir = sortDirection === "asc" ? 1 : -1;
      list.sort((a, b) => {
        const ta = a?.contract?.tenant;
        const tb = b?.contract?.tenant;
        if (!ta && !tb) return 0;
        if (!ta) return 1;
        if (!tb) return -1;
        return compareTenantDirectoryName(ta, tb) * dir;
      });
      return list;
    }
    if (sortColumn === "billing_id") {
      const list = [...billings];
      const dir = sortDirection === "asc" ? 1 : -1;
      list.sort((a, b) => ((Number(a.billing_id) || 0) - (Number(b.billing_id) || 0)) * dir);
      return list;
    }
    return sortClientRows(billings, sortColumn, sortDirection, (b) => {
      switch (sortColumn) {
        case "room": return b?.contract?.room?.room_code || String(b?.contract?.room_id ?? "");
        case "period": return b.billing_period_from || "";
        case "due_date": return b.due_date || "";
        case "total_amount": return Number(b.total_amount) || 0;
        case "total_paid": return Number(b.total_paid) || 0;
        case "balance": return Number(b.balance) || 0;
        case "status": return b.status || "";
        default: return "";
      }
    });
  }, [billings, sortColumn, sortDirection]);
  const canGenerateBilling = useMemo(() => canManageBilling(currentUser), [currentUser]);
  return (
    <StandardPage
      title="Billing & Collections"
      subtitle="Track bills, overdue balances, and payments."
      breadcrumbs={<Breadcrumbs items={[{ label: "Billing" }]} />}
      loading={loading}
      skeleton={<SkeletonListPage rows={10} />}
      error={billingError}
      actions={
        <PageHeaderActions
          ctaHref={canGenerateBilling ? "/billing/new" : null}
          ctaLabel="New Billing"
          ctaIcon={PlusCircle}
          user={currentUser}
        />
      }
    >
      {!canView ? (
        <Alert variant="warning" title="Access Restricted">
          You do not have permission to view billing records.
        </Alert>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Total Billed"
              value={formatPHP(totalBilled)}
              sub="Total billed this month"
              icon={Receipt}
              isLoading={!billingSummaryData}
              isSyncing={summaryValidating}
              className="hs-glass-effect"
            />
            <KpiCard
              label="Outstanding Balance"
              value={formatPHP(totalOutstanding)}
              sub="Unpaid rent balances"
              icon={Wallet}
              isWarning={totalOutstanding > 0}
              isLoading={!outstandingData}
              isSyncing={outstandingValidating}
              href="/billing?status=unpaid"
              className="hs-glass-effect"
            />
            <KpiCard
              label="Overdue Volume"
              value={formatPHP(overdueVolume)}
              sub={`${overdueCount} overdue accounts`}
              icon={AlertCircle}
              isDanger={overdueVolume > 0}
              isLoading={!outstandingData}
              isSyncing={outstandingValidating}
              href="/billing?status=overdue"
              className="hs-glass-effect"
            />
            <KpiCard
              label="Recovery Rate"
              value={`${recoveryRate}%`}
              sub="Total payment recovery"
              icon={Activity}
              isSuccess={recoveryRate >= 90}
              isWarning={recoveryRate < 75}
              isLoading={!billingSummaryData}
              isSyncing={summaryValidating}
              className="hs-glass-effect"
            />
          </div>
          <FilterPanelCard icon={FileText} title="Filters">
            <div className="grid items-end gap-6 md:grid-cols-12">
              <div className="md:col-span-8 lg:col-span-8">
                <Field label="Search Registry">
                  <div className="group relative">
                    <Search
                      className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-stone-400 transition-colors group-focus-within:text-teal-600"
                      aria-hidden
                    />
                    <Input
                      value={tenantQuery}
                      onChange={(event) => updateFilter("query", event.target.value)}
                      placeholder="Tenant name, phone, or #BILL ID…"
                      className="!h-12 border-stone-200 pl-11 font-medium transition-[border-color,box-shadow] focus:border-teal-500/50 focus:ring-4 focus:ring-teal-500/5"
                    />
                  </div>
                </Field>
              </div>
              <div className="md:col-span-4 lg:col-span-4">
                <Field label="Billing Status">
                  <Select
                    value={statusFilter}
                    onChange={(event) => updateFilter("status", event.target.value)}
                    className="!h-12 border-stone-200 font-bold focus:border-teal-500/50"
                  >
                    <option value="all">All statuses</option>
                    {Object.entries(BILLING_STATUS_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </Select>
                </Field>
              </div>
            </div>
            <FilterChips
              className="mt-6"
              items={[
                { key: "search", label: "Query", value: tenantQuery, onClear: () => updateFilter("query", "") },
                {
                  key: "status",
                  label: "Status",
                  value: statusFilter !== "all" ? BILLING_STATUS_LABELS[statusFilter] || statusFilter : "",
                  onClear: () => updateFilter("status", "all"),
                },
              ]}
              onClearAll={resetFilters}
            />
          </FilterPanelCard>
          <ResourceView
            isLoading={loading}
            isSyncing={isSyncing}
            error={billingError}
            isEmpty={sortedFiltered.length === 0}
            onRetry={() => refetchBillings()}
            skeleton={<SkeletonListPage rows={10} />}
            emptyProps={{
              title: "No billing records",
              description: "Adjust filters or generate a new cycle when contracts are active."
            }}
          >
            <Card className="overflow-hidden rounded-2xl border-stone-200 !p-0 shadow-sm hs-glass-effect">
              <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/50 px-8 py-4">
                <h2 className="hs-strip-title uppercase tracking-[0.2em] text-[10px] font-black text-stone-400">Invoice Directory</h2>
                <div className="text-[10px] font-mono font-bold text-stone-400 uppercase tracking-widest leading-none">
                  {listMeta?.total ?? sortedFiltered.length} records matching
                </div>
              </div>
              <Table
                embedded
                columns={[
                  { key: "billing_id", label: "BILL ID", sortable: true, sortKey: "billing_id", className: "pl-8" },
                  { key: "tenant", label: "TENANT NAME", sortable: true, sortKey: "tenant" },
                  { key: "period", label: "BILLING CYCLES", sortable: true, sortKey: "period", className: "text-center" },
                  { key: "balance", label: "OUTSTANDING", sortable: true, sortKey: "balance", className: "text-right" },
                  { key: "status", label: "STATUS", sortable: true, sortKey: "status", className: "text-center" },
                  { key: "actions", label: "", className: "text-right w-16 px-8" },
                ]}
                sortColumn={sortColumn}
                sortDirection={sortDirection}
                onSortChange={onSortChange}
                rows={sortedFiltered.map((billing) => {
                  const tenant = billing?.contract?.tenant;
                  const tenantName = tenant ? formatTenantDirectoryName(tenant) : "—";
                  const roomCode = billing?.contract?.room?.room_code || "—";
                  const bedLabel = billing?.contract?.bed_space?.bed_label || billing?.contract?.bedSpace?.bed_label || "";
                  const amountDue = Number(billing.total_amount);
                  const amountPaid = Number(billing.total_paid);
                  const balance = Number(billing.balance);
                  return (
                    <ExpandableTableRow
                      key={billing.billing_id}
                      className={interactiveTableRowClass}
                      expandableContent={
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border border-stone-200 bg-white rounded-xl p-6 shadow-sm">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase text-stone-400 tracking-widest">Financial Summary</span>
                            <div className="mt-2 text-sm text-stone-900 font-mono font-bold">
                              Total Billed: {formatPHP(amountDue)} <span className="text-stone-300 mx-3">|</span>
                              Collected: {formatPHP(amountPaid)}
                            </div>
                          </div>
                          <Button 
                            onClick={() => router.push(`/billing/${billing.billing_id}`)} 
                            variant="primary" 
                            className="!h-10 px-8 text-[10px] font-black tracking-widest uppercase shadow-md active:scale-95 transition-transform bg-stone-900 hover:bg-stone-800"
                          >
                            Access Details
                          </Button>
                        </div>
                      }
                    >
                      <td className="px-8 py-5">
                        <div className="flex flex-col">
                          <ResourceIdCell id={billing.billing_id} type="billing" />
                          <div className="mt-1.5">
                            <CorrelationIdCell value={billing.correlation_id} />
                          </div>
                        </div>
                      </td>
                      <td className="py-5">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-stone-900 group-hover:text-teal-700 transition-colors leading-tight flex items-center gap-2">
                            {tenantName}
                            {tenant?.correlation_id && (
                              <CorrelationIdCell value={tenant.correlation_id} className="opacity-60 scale-90" />
                            )}
                          </span>
                          <span className="mt-1 text-[10px] font-mono font-bold uppercase tracking-widest text-stone-400">
                            Room {roomCode}{bedLabel ? ` / ${bedLabel}` : ""}
                          </span>
                        </div>
                      </td>
                      <td className="py-5 text-center">
                        <div className="flex flex-col items-center">
                          <span className="text-xs font-bold text-stone-700">
                            Due {formatDateString(billing.due_date)}
                          </span>
                          <span className="mt-1 text-[10px] font-mono font-medium text-stone-400 uppercase tracking-tight">
                            {formatDateString(billing.billing_period_from)} – {formatDateString(billing.billing_period_to)}
                          </span>
                        </div>
                      </td>
                      <td className="py-5 text-right">
                        <div className="flex flex-col items-end">
                          {balance < 0 ? (
                            <span className="inline-flex items-center gap-1.5 font-mono text-xs font-black tabular-nums text-emerald-700">
                              {formatPHP(Math.abs(balance))}
                              <span className="rounded-full border border-emerald-100 bg-emerald-50 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest text-emerald-700">
                                Credit
                              </span>
                            </span>
                          ) : balance === 0 ? (
                            <span className="font-mono text-xs font-bold tabular-nums text-emerald-700">
                              {formatPHP(0)}
                            </span>
                          ) : (
                            <span className="font-mono text-sm font-black tabular-nums text-rose-600">
                              {formatPHP(balance)}
                            </span>
                          )}
                          <div className="mt-1.5 flex items-center justify-end gap-1 font-mono text-[9px] font-bold uppercase tracking-tighter text-stone-400 tabular-nums">
                            <span>{formatPHP(amountPaid)}</span>
                            <span className="opacity-40">/</span>
                            <span>{formatPHP(amountDue)}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-5 text-center">
                        <StatusBadge>{billing.status}</StatusBadge>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <RowOpenIndicator />
                      </td>
                    </ExpandableTableRow>
                  );
                })}
              />
              <TablePagination
                meta={listMeta}
                page={page}
                perPage={perPage}
                onPageChange={setPage}
                onPerPageChange={(n) => { setPage(1); setPerPage(n); }}
                disabled={loading || isSyncing}
              />
            </Card>
          </ResourceView>
        </div>
      )}
    </StandardPage>
  );
}
