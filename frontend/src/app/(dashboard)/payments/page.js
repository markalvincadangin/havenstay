"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { 
  PlusCircle, Search, HandCoins, Receipt, Activity, FileX, Wallet 
} from "lucide-react";

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
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Card } from "@/components/ui/Card";
import FilterPanelCard from "@/components/ui/FilterPanelCard";
import FilterChips from "@/components/ui/FilterChips";
import { Field, Input, Select } from "@/components/ui/Fields";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import { Table } from "@/components/ui/Table";
import { KpiCard } from "@/components/ui/KpiCard";
import { METHOD_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/constants";
import {
  normalizePaginatedList,
} from "@/lib/pagination";
import ResourceView from "@/components/ui/ResourceView";
import TablePagination from "@/components/ui/TablePagination";
import StandardPage from "@/components/ui/StandardPage";
import { SkeletonListPage } from "@/components/ui/Skeleton";
import ResourceIdCell from "@/components/ui/ResourceIdCell";
import { useAuth } from "@/context/AuthContext";
import PageHeaderActions from "@/components/ui/PageHeaderActions";
import { usePaginatedFilters } from "@/hooks/usePaginatedFilters";
import RowOpenIndicator from "@/components/ui/RowOpenIndicator";
import { ExpandableTableRow } from "@/components/ui/ExpandableTableRow";
import Button from "@/components/ui/Button";
import { interactiveTableRowClass } from "@/lib/tableRows";
import { CorrelationIdCell } from "@/components/ui/CorrelationIdCell";

function paymentRowStatus(p) {
  return p?.voided_at ? "voided" : "posted";
}

export default function PaymentsListPage() {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const { filters, updateFilter, resetFilters, page, setPage, perPage, setPerPage, queryString } =
    usePaginatedFilters({
      initialFilters: { query: "", dateFrom: "", dateTo: "", status: "all" },
      debounceKeys: ["query"],
      buildExtraParams: ({ filters: current, debounced }) => {
        const extra = {};
        const q = String(debounced.query ?? "").trim();
        if (q) extra.q = q;
        if (current.dateFrom) extra.from = current.dateFrom;
        if (current.dateTo) extra.to = current.dateTo;
        if (current.status !== "all") extra.posting_status = current.status;
        return extra;
      },
    });
  const tenantQuery = filters.query;
  const dateFrom = filters.dateFrom;
  const dateTo = filters.dateTo;
  const statusFilter = filters.status;
  const { sortColumn, sortDirection, onSortChange } = useTableSort();

  const canView = useMemo(() => canViewBilling(currentUser), [currentUser]);
  const canPostPayments = useMemo(() => canManageBilling(currentUser), [currentUser]);

  // KPIs
  const { data: todayRepData, isValidating: todayValidating } = useSWR(
    currentUser && canView ? (() => {
      const today = new Date().toISOString().slice(0, 10);
      return `/api/reports/collections-performance?start_date=${today}&end_date=${today}`;
    })() : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  );

  const { data: monthRepData, isValidating: monthValidating } = useSWR(
    currentUser && canView ? (() => {
      const { start, end } = getCurrentMonthRange();
      return `/api/reports/collections-performance?start_date=${start}&end_date=${end}`;
    })() : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  );

  const collectedToday = todayRepData?.summary?.total_collected ?? 0;
  const collectedThisMonth = monthRepData?.summary?.total_collected ?? 0;
  const voidedThisMonth = monthRepData?.summary?.total_voided ?? 0;
  const collectionRate = monthRepData?.summary?.collection_rate ?? 0;

  // Payments
  const { data: paymentsData, error: paymentsError, isValidating: isSyncing, mutate: refetchPayments } = useSWR(
    currentUser && canView ? `/api/payments${queryString}` : null,
    fetcher,
    { keepPreviousData: true, dedupingInterval: 30000 }
  );

  const { rows: payments = [], meta: listMeta = null } = useMemo(() => {
    if (!paymentsData) return { rows: [], meta: null };
    return normalizePaginatedList(paymentsData);
  }, [paymentsData]);

  const loading = !paymentsData && !paymentsError;

  const sortedFiltered = useMemo(() => {
    if (!sortColumn) return payments;
    if (sortColumn === "tenant") {
      const list = [...payments];
      const dir = sortDirection === "asc" ? 1 : -1;
      list.sort((a, b) => {
        const ta = a?.billing?.contract?.tenant;
        const tb = b?.billing?.contract?.tenant;
        if (!ta && !tb) return 0;
        if (!ta) return 1;
        if (!tb) return -1;
        return compareTenantDirectoryName(ta, tb) * dir;
      });
      return list;
    }
    return sortClientRows(payments, sortColumn, sortDirection, (p) => {
      switch (sortColumn) {
        case "payment_id": return Number(p.payment_id) || 0;
        case "date": return p.payment_date || "";
        case "amount": return Number(p.amount_paid) || 0;
        case "method": return p.payment_method || "";
        case "status": return paymentRowStatus(p);
        default: return "";
      }
    });
  }, [payments, sortColumn, sortDirection]);

  return (
    <StandardPage
      title="Payment Registry"
      subtitle="Track collections, transaction history, and settlement ledger."
      breadcrumbs={<Breadcrumbs items={[{ label: "Payments" }]} />}
      loading={loading}
      skeleton={<SkeletonListPage rows={10} />}
      error={paymentsError}
      actions={
        <PageHeaderActions
          ctaHref={canPostPayments ? "/payments/new" : null}
          ctaLabel="Record Payment"
          ctaIcon={PlusCircle}
          user={currentUser}
        />
      }
    >
      <div className="space-y-6">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Daily Collections"
            icon={HandCoins}
            value={formatPHP(collectedToday)}
            sub="TOTAL TAKEN TODAY"
            isSuccess={collectedToday > 0}
            isLoading={!todayRepData && !monthRepData}
            isSyncing={todayValidating}
            className="hs-glass-effect"
          />
          <KpiCard
            label="Monthly Collections"
            icon={Receipt}
            value={formatPHP(collectedThisMonth)}
            sub="POSTED COLLECTIONS MTD"
            isSuccess={collectedThisMonth > 0}
            isLoading={!todayRepData && !monthRepData}
            isSyncing={monthValidating}
            className="hs-glass-effect"
          />
          <KpiCard
            label="Collection Rate"
            icon={Activity}
            value={`${collectionRate}%`}
            sub="PERFORMANCE EFFICIENCY"
            isInfo={collectionRate > 0}
            isLoading={!todayRepData && !monthRepData}
            isSyncing={monthValidating}
            className="hs-glass-effect"
          />
          <KpiCard
            label="Voided (MTD)"
            icon={FileX}
            value={formatPHP(voidedThisMonth)}
            sub="FORENSIC OVERVIEW"
            isDanger={voidedThisMonth > 0}
            isLoading={!todayRepData && !monthRepData}
            isSyncing={monthValidating}
            className="hs-glass-effect"
          />
        </div>

        <FilterPanelCard icon={Search}>
            <div className="grid items-end gap-6 lg:grid-cols-12">
              <div className="lg:col-span-5">
                <Field label="Search Registry">
                  <Input
                    icon={Search}
                    value={tenantQuery}
                    onChange={(e) => updateFilter("query", e.target.value)}
                    placeholder="Resident name, Payment ID, or reference..."
                    className="!h-12 border-stone-200"
                  />
                </Field>
              </div>
              <div className="lg:col-span-3">
                <Field label="Collection Status">
                  <Select
                    value={statusFilter}
                    onChange={(e) => updateFilter("status", e.target.value)}
                    className="!h-12 border-stone-200 font-bold uppercase tracking-widest text-[10px]"
                  >
                    <option value="all">All Statuses</option>
                    {Object.entries(PAYMENT_STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </Select>
                </Field>
              </div>
              <div className="lg:col-span-2">
                <Field label="Payment From">
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => updateFilter("dateFrom", e.target.value)}
                    className="!h-12 border-stone-200 font-bold tabular-nums"
                  />
                </Field>
              </div>
              <div className="lg:col-span-2">
                <Field label="Payment To">
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => updateFilter("dateTo", e.target.value)}
                    className="!h-12 border-stone-200 font-bold tabular-nums"
                  />
                </Field>
              </div>
            </div>
            <FilterChips
              className="mt-6"
              items={[
                { key: "tenant", label: "Search", value: tenantQuery, onClear: () => updateFilter("query", "") },
                {
                  key: "status",
                  label: "Status",
                  value: statusFilter !== "all" ? PAYMENT_STATUS_LABELS[statusFilter] || statusFilter : "",
                  onClear: () => updateFilter("status", "all"),
                },
                { key: "from", label: "Date From", value: dateFrom, onClear: () => updateFilter("dateFrom", "") },
                { key: "to", label: "Date To", value: dateTo, onClear: () => updateFilter("dateTo", "") },
              ]}
              onClearAll={resetFilters}
            />
        </FilterPanelCard>

        <ResourceView
          isLoading={loading}
          isSyncing={isSyncing}
          error={paymentsError}
          isEmpty={sortedFiltered.length === 0}
          onRetry={() => refetchPayments()}
          skeleton={<SkeletonListPage rows={10} />}
          emptyProps={{
            title: "No payments found",
            description: "Adjust filters or record a payment to see results here."
          }}
        >
          <Card className="!p-0 overflow-hidden border-stone-200 rounded-2xl shadow-sm hs-glass-effect">
            <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/50 px-8 py-4">
              <h2 className="hs-strip-title uppercase tracking-[0.2em] text-[10px] font-black text-stone-400">Collection Directory</h2>
              <div className="text-[10px] font-mono font-bold text-stone-400 uppercase tracking-widest leading-none">
                {listMeta?.total ?? sortedFiltered.length} records matching
              </div>
            </div>
            <Table
              embedded
              columns={[
                { key: "payment_id", label: "TRANSACTION ID", sortable: true, sortKey: "payment_id", className: "pl-8 w-32" },
                { key: "date", label: "POSTING DATE", sortable: true, sortKey: "date", className: "text-center" },
                { key: "tenant", label: "TENANT NAME", sortable: true, sortKey: "tenant" },
                { key: "amount", label: "PAYMENT AMOUNT", sortable: true, sortKey: "amount", className: "text-right" },
                { key: "method", label: "PAYMENT METHOD", sortable: true, sortKey: "method", className: "text-center" },
                { key: "status", label: "STATUS", sortable: true, sortKey: "status", className: "text-center" },
                { key: "actions", label: "", className: "text-right w-16 px-8" },
              ]}
              sortColumn={sortColumn}
              sortDirection={sortDirection}
              onSortChange={onSortChange}
              rows={sortedFiltered.map((payment) => {
                const tenant = payment?.billing?.contract?.tenant;
                const tenantName = tenant ? formatTenantDirectoryName(tenant) : "—";
                const rowStatus = paymentRowStatus(payment);
                const isVoided = rowStatus === "voided";
                const methodKey = String(payment?.payment_method || "").toLowerCase();

                return (
                  <ExpandableTableRow
                    key={payment.payment_id}
                    className={interactiveTableRowClass}
                    expandableContent={
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border border-stone-200 bg-white rounded-xl p-6 shadow-sm">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black uppercase text-stone-400 tracking-widest">Transaction Snapshot</span>
                          <div className="mt-2 text-sm text-stone-900 font-mono font-bold">
                            Method: {METHOD_LABELS[methodKey] || payment?.payment_method || "Other"} <span className="text-stone-300 mx-3">|</span>
                            Reference: {payment.payment_reference || "—"}
                          </div>
                        </div>
                        <Button 
                          onClick={() => router.push(`/payments/${payment.payment_id}`)} 
                          variant="primary" 
                          className="!h-10 px-8 text-[10px] font-black tracking-widest uppercase shadow-md active:scale-95 transition-transform bg-stone-900 hover:bg-stone-800"
                        >
                          Access Ledger
                        </Button>
                      </div>
                    }
                  >
                    <td className="pl-8 py-5">
                      <ResourceIdCell id={payment.payment_id} type="payment" />
                    </td>
                    <td className="py-5 text-center text-sm font-bold tabular-nums text-stone-600">
                      {formatDateString(payment.payment_date)}
                    </td>
                    <td className="py-5 text-sm font-black text-stone-900 group-hover:text-teal-700 transition-colors leading-tight">
                      <div className="flex items-center gap-2">
                        {tenantName}
                        {tenant?.correlation_id && (
                          <CorrelationIdCell value={tenant.correlation_id} className="opacity-60 scale-90" />
                        )}
                      </div>
                    </td>
                    <td className="py-5 text-right">
                      <span className={`font-mono font-black tabular-nums ${isVoided ? "text-stone-300 line-through" : "text-emerald-700"}`}>
                        {formatPHP(payment.amount_paid)}
                      </span>
                    </td>
                    <td className="py-5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Wallet size={12} className="text-stone-300" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-stone-500">
                          {METHOD_LABELS[methodKey] || payment?.payment_method || "Other"}
                        </span>
                      </div>
                    </td>
                    <td className="py-5 text-center">
                      <StatusBadge size="sm">{rowStatus}</StatusBadge>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <RowOpenIndicator compact />
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
              className="hs-glass-effect mt-6"
            />
          </Card>
        </ResourceView>
      </div>
    </StandardPage>
  );
}
