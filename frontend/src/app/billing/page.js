"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { FileText, Search, Building2, TrendingUp, AlertCircle, PlusCircle } from "lucide-react";

import useSWR from "swr";
import { fetcher } from "../../lib/api";
import { canManageBilling, canViewBilling } from "../../lib/auth";
import { useTableSort } from "../../hooks/useTableSort";
import { sortClientRows } from "../../lib/tableSort";
import {
  compareTenantDirectoryName,
  formatDateString,
  formatPHP,
  formatTenantDirectoryName,
} from "../../lib/formatters";
import Alert from "../_components/ui/Alert";
import { Card } from "../_components/ui/Card";
import FilterChips from "../_components/ui/FilterChips";
import { Field, Input, Select } from "../_components/ui/Fields";
import Breadcrumbs from "../_components/ui/Breadcrumbs";
import { StatusBadge } from "../_components/ui/StatusBadge";
import { Table } from "../_components/ui/Table";
import { KpiCard } from "../_components/ui/KpiCard";
import {
  BILLING_STATUS_LABELS,
} from "../../lib/constants";
import {
  normalizePaginatedList,
} from "../../lib/pagination";
import ResourceView from "../_components/ui/ResourceView";
import TablePagination from "../_components/ui/TablePagination";
import StandardPage from "../_components/ui/StandardPage";
import ResourceIdCell from "../_components/ui/ResourceIdCell";
import { useAuth } from "../_context/AuthContext";
import { usePaginatedFilters } from "../../hooks/usePaginatedFilters";
import RowOpenIndicator from "../_components/ui/RowOpenIndicator";
import PageHeaderActions from "../_components/ui/PageHeaderActions";
import { interactiveTableRowClass } from "../../lib/tableRows";

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

  const { data: collectionsData, isValidating: collectionsValidating } = useSWR(
    currentUser && canView ? (() => {
      const today = new Date();
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, "0");
      const start = `${y}-${m}-01`;
      const end = today.toISOString().slice(0, 10);
      return `/api/reports/collections-performance?start_date=${start}&end_date=${end}`;
    })() : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  );

  const totalOutstanding = outstandingData?.summary?.total_outstanding ?? 0;
  const pastDueReceivables = outstandingData?.summary?.past_due_amount ?? 0;
  const collectedThisMonth = collectionsData?.summary?.total_collected ?? 0;

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
      title="Billing"
      subtitle="Monitor account balances and track monthly billing cycles across all contracts."
      breadcrumbs={<Breadcrumbs items={[{ label: "Billing" }]} />}
      loading={loading}
      error={billingError}
      actions={
        <PageHeaderActions
          ctaHref={canGenerateBilling ? "/billing/new" : null}
          ctaLabel="Generate Bill"
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <KpiCard
              label="Total Uncollected"
              icon={Building2}
              value={formatPHP(totalOutstanding)}
              sub="OVERALL RECEIVABLES"
              isWarning={totalOutstanding > 0}
              isLoading={!outstandingData && !collectionsData}
              isSyncing={outstandingValidating || collectionsValidating}
            />
            <KpiCard
              label="Past-Due"
              icon={AlertCircle}
              value={formatPHP(pastDueReceivables)}
              sub="DELINQUENT BALANCES"
              isDanger={pastDueReceivables > 0}
              isLoading={!outstandingData && !collectionsData}
              isSyncing={outstandingValidating || collectionsValidating}
            />
            <KpiCard 
              label="MTD Collections" 
              icon={TrendingUp}
              value={formatPHP(collectedThisMonth)} 
              sub="MONTH-TO-DATE POSTED"
              isSuccess={collectedThisMonth > 0} 
              isLoading={!outstandingData && !collectionsData}
              isSyncing={outstandingValidating || collectionsValidating}
            />
          </div>

          <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
            <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/50 px-6 py-4 sm:px-8 sm:py-5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-stone-100 text-stone-600">
                  <FileText size={14} aria-hidden />
                </div>
                <h2 className="hs-strip-title text-stone-400 tracking-widest uppercase font-black text-sm">Filters</h2>
              </div>
            </div>
            <div className="p-8">
              <div className="grid items-end gap-6 md:grid-cols-12">
                <div className="md:col-span-8 lg:col-span-8">
                  <Field label="Search billing">
                    <div className="group relative">
                      <Search
                        className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-stone-400 transition-colors group-focus-within:text-teal-600"
                        aria-hidden
                      />
                      <Input
                        value={tenantQuery}
                        onChange={(event) => updateFilter("query", event.target.value)}
                        placeholder="Tenant name, phone, or billing ID…"
                        className="!h-12 border-stone-200 pl-11 font-medium transition-[border-color,box-shadow] focus:border-teal-500/50 focus:ring-4 focus:ring-teal-500/5"
                      />
                    </div>
                  </Field>
                </div>
                <div className="md:col-span-4 lg:col-span-4">
                  <Field label="Status">
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
            </div>
          </Card>

          <ResourceView
            isLoading={loading}
            isSyncing={isSyncing}
            error={billingError}
            isEmpty={sortedFiltered.length === 0}
            onRetry={() => refetchBillings()}
            emptyProps={{
              title: "No billing records",
              message: "Adjust filters or generate a new cycle when contracts are active."
            }}
          >
            <Card className="overflow-hidden rounded-2xl border-stone-200 !p-0 shadow-sm transition-all duration-300">
              <Table
                embedded
                caption={`Billing cycles by tenant and room assignment — ${listMeta?.total ?? sortedFiltered.length} matching`}
                columns={[
                  { key: "billing_id", label: "BILLING ID", sortable: true, sortKey: "billing_id", className: "w-32" },
                  { key: "tenant", label: "TENANT", sortable: true, sortKey: "tenant" },
                  { key: "period", label: "BILLING PERIOD", sortable: true, sortKey: "period" },
                  { key: "balance", label: "BALANCE", sortable: true, sortKey: "balance", className: "text-right" },
                  { key: "status", label: "STATUS", sortable: true, sortKey: "status" },
                  { key: "actions", label: "", className: "text-right w-16" },
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
                    <tr
                      key={billing.billing_id}
                      title="Open billing record"
                      className={interactiveTableRowClass}
                      onClick={() => router.push(`/billing/${billing.billing_id}`)}
                    >
                      <td className="px-6 py-4">
                        <ResourceIdCell id={billing.billing_id} prefix="BILL" />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-stone-900 group-hover:text-teal-900 leading-tight">
                            {tenantName}
                          </span>
                          <span className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-stone-400">
                            Room {roomCode}{bedLabel ? ` / ${bedLabel}` : ""}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-stone-700">
                            Due {formatDateString(billing.due_date)}
                          </span>
                          <span className="mt-0.5 text-[10px] font-medium text-stone-400">
                            {formatDateString(billing.billing_period_from)} – {formatDateString(billing.billing_period_to)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex flex-col items-end">
                          {balance < 0 ? (
                            <span className="inline-flex items-center gap-1.5 font-mono text-xs font-black tabular-nums text-emerald-800">
                              {formatPHP(Math.abs(balance))}
                              <span className="rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide">
                                Credit
                              </span>
                            </span>
                          ) : balance === 0 ? (
                            <span className="font-mono text-xs font-medium tabular-nums text-stone-300">
                              {formatPHP(0)}
                            </span>
                          ) : (
                            <span className="font-mono text-sm font-black tabular-nums text-teal-700">
                              {formatPHP(balance)}
                            </span>
                          )}
                          <div className="mt-0.5 flex items-center justify-end gap-1 font-mono text-[9px] font-bold uppercase tracking-tighter text-stone-400 tabular-nums">
                            <span>{formatPHP(amountPaid)}</span>
                            <span className="opacity-40">/</span>
                            <span>{formatPHP(amountDue)}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge size="sm">{billing.status}</StatusBadge>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <RowOpenIndicator />
                      </td>
                    </tr>
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
