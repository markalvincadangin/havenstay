"use client";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { FileText, Search, AlertCircle, PlusCircle, Activity, Wallet, Receipt } from "lucide-react";
import useSWR from "swr";
import { fetcher } from "@/lib/api";
import { canManageBilling, canViewBilling } from "@/lib/auth";
import {
  compareTenantDirectoryName,
  formatDateString,
  formatTenantDirectoryName,
  getCurrentMonthRange,
} from "@/lib/formatters";
import CurrencyDisplay from "@/components/ui/CurrencyDisplay";
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
  SEARCH_LABELS,
  SEARCH_PLACEHOLDERS,
  FILTER_ALL_OPTION
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
import CurrencyCell from "@/components/ui/CurrencyCell";
import { interactiveTableRowClass } from "@/lib/tableRows";
export default function BillingListPage() {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const {
    filters,
    updateFilter,
    resetFilters,
    sort,
    onSortChange,
    page,
    setPage,
    perPage,
    setPerPage,
    queryString,
  } = usePaginatedFilters({
    initialFilters: { query: "", status: "all", due_date: "" },
    initialSort: { by: "id", dir: "desc" },
    debounceKeys: ["query"],
    buildExtraParams: ({ filters: current, debounced }) => {
      const extra = {};
      const q = String(debounced.query ?? "").trim();
      if (q) extra.q = q;
      if (current.status !== "all") extra.status = current.status;
      if (current.due_date) extra.due_date = current.due_date;
      return extra;
    },
  });
  const statusFilter = filters.status;
  const tenantQuery = filters.query;
  const dueDate = filters.due_date;

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

  const sortedFiltered = billings;

  const hasActiveFilters = Boolean(String(tenantQuery ?? "").trim()) || statusFilter !== "all" || Boolean(dueDate);
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
          ctaLabel="GENERATE BILLS"
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
              value={totalBilled}
              sub="Total billed this month"
              icon={Receipt}
              isLoading={!billingSummaryData}
              isSyncing={summaryValidating}
              currency={true}
              className="hs-glass-effect"
            />
            <KpiCard
              label="Outstanding Balance"
              value={totalOutstanding}
              sub="UNPAID BALANCES"
              icon={Wallet}
              isWarning={totalOutstanding > 0}
              isLoading={!outstandingData}
              isSyncing={outstandingValidating}
              href="/billing?status=unpaid"
              currency={true}
              className="hs-glass-effect"
            />
            <KpiCard
              label="Overdue Volume"
              value={overdueVolume}
              sub={`${overdueCount} overdue accounts`}
              icon={AlertCircle}
              isDanger={overdueVolume > 0}
              isLoading={!outstandingData}
              isSyncing={outstandingValidating}
              href="/billing?status=overdue"
              currency={true}
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
              <div className="md:col-span-12 lg:col-span-5">
                <Field label={SEARCH_LABELS.billing}>
                  <div className="group relative">
                    <Search
                      className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-stone-400 transition-colors group-focus-within:text-teal-600"
                      aria-hidden
                    />
                    <Input
                      value={tenantQuery}
                      onChange={(event) => updateFilter("query", event.target.value)}
                      placeholder={SEARCH_PLACEHOLDERS.billing}
                      className="!h-12 border-stone-200 pl-11 font-bold transition-[border-color,box-shadow] focus:border-teal-500/50 focus:ring-4 focus:ring-teal-500/5"
                    />
                  </div>
                </Field>
              </div>
              <div className="md:col-span-6 lg:col-span-4">
                <Field label="Billing Status">
                  <Select
                    value={statusFilter}
                    onChange={(event) => updateFilter("status", event.target.value)}
                    className="!h-12 border-stone-200 font-bold focus:border-teal-500/50"
                  >
                    <option value="all">{FILTER_ALL_OPTION}</option>
                    {Object.entries(BILLING_STATUS_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </Select>
                </Field>
              </div>
              <div className="md:col-span-6 lg:col-span-3">
                <Field label="Due Date">
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(e) => updateFilter("due_date", e.target.value)}
                    className="!h-12 border-stone-200 font-bold tabular-nums focus:border-teal-500/50"
                  />
                </Field>
              </div>
            </div>
            <FilterChips
              className="mt-6"
              items={[
                { key: "search", label: "Billing", value: tenantQuery, onClear: () => updateFilter("query", "") },
                {
                  key: "status",
                  label: "Billing Status",
                  value: statusFilter !== "all" ? BILLING_STATUS_LABELS[statusFilter] || statusFilter : "",
                  onClear: () => updateFilter("status", "all"),
                },
                {
                  key: "due_date",
                  label: "Due Date",
                  value: dueDate,
                  onClear: () => updateFilter("due_date", ""),
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
              description: "Adjust filters or generate a new cycle when contracts are active.",
              action: hasActiveFilters ? (
                <Button
                  variant="secondary"
                  className="!h-12 rounded-xl px-10 text-[10px] font-bold uppercase tracking-widest"
                  onClick={resetFilters}
                >
                  Clear filters
                </Button>
              ) : null
            }}
          >
            <Card className="overflow-hidden rounded-2xl border-stone-200 !p-0 shadow-sm hs-glass-effect">
              <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/50 px-8 py-4">
                <h2 className="hs-strip-title uppercase tracking-[0.2em] text-[10px] font-black text-stone-400">BILLING DIRECTORY</h2>
                <div className="text-[10px] font-mono font-bold text-stone-400 uppercase tracking-widest leading-none">
                  {listMeta?.total ?? sortedFiltered.length} BILLS MATCHING
                </div>
              </div>
              <Table
                embedded={true}
                dense={true}
                sortable={true}
                sortColumn={sort.by}
                sortDirection={sort.dir}
                onSortChange={onSortChange}
                columns={[
                  { key: "billing_id", label: "BILLING ID", sortable: true, className: "pl-8" },
                  { key: "tenant", label: "TENANT", sortable: true },
                  { key: "period", label: "BILLING PERIOD", sortable: true, sortKey: "period_from" },
                  { key: "dueDate", label: "DUE DATE", sortable: true, sortKey: "due_date", className: "text-center" },
                  { key: "amount", label: "AMOUNT", sortable: true, sortKey: "total_amount", className: "text-right" },
                  { key: "status", label: "STATUS", sortable: true, sortKey: "status", className: "text-center" },
                  { key: "actions", label: "", className: "text-right w-16 px-8" },
                ]}
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
                            <div className="mt-2 text-sm text-stone-900 flex items-center gap-1 font-bold">
                              Total Billed: <CurrencyDisplay amount={amountDue} /> <span className="text-stone-300 mx-3 font-normal">|</span>
                              Collected: <CurrencyDisplay amount={amountPaid} />
                            </div>
                          </div>
                          <Button
                            onClick={() => router.push(`/billing/${billing.billing_id}`)}
                            variant="secondary"
                            className="!h-10 px-8 text-[10px] font-black tracking-widest uppercase shadow-md active:scale-95 transition-transform"
                          >
                            View Details
                          </Button>
                        </div>
                      }
                    >
                      <td className="px-8 py-5">
                        <ResourceIdCell id={billing.billing_id} type="billing" />
                      </td>
                      <td className="py-5">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-stone-900 group-hover:text-teal-700 transition-colors leading-tight flex items-center gap-2">
                            {tenantName}
                          </span>
                          <span className="mt-1 text-[10px] font-mono font-bold uppercase tracking-widest text-stone-400">
                            {roomCode}{bedLabel ? ` / ${bedLabel}` : ""}
                          </span>
                        </div>
                      </td>
                      <td className="py-5 text-center">
                        <span className="text-[10px] font-mono font-bold text-stone-700 uppercase tracking-tight">
                          {formatDateString(billing.billing_period_from)} – {formatDateString(billing.billing_period_to)}
                        </span>
                      </td>
                      <td className="py-5 text-center">
                        <span className="text-xs font-bold text-stone-700">
                          {formatDateString(billing.due_date)}
                        </span>
                      </td>
                      <td className="py-5 text-right">
                        <div className="flex flex-col items-end">
                          <CurrencyCell amount={balance} className="!text-sm !font-black" />
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
