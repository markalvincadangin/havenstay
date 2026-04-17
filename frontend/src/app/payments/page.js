"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search, Wallet, PlusCircle } from "lucide-react";

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
import { StatusBadge } from "../_components/ui/StatusBadge";
import { Card } from "../_components/ui/Card";
import FilterPanelCard from "../_components/ui/FilterPanelCard";
import FilterChips from "../_components/ui/FilterChips";
import { Field, Input, Select } from "../_components/ui/Fields";
import Breadcrumbs from "../_components/ui/Breadcrumbs";
import { Table } from "../_components/ui/Table";
import { KpiCard } from "../_components/ui/KpiCard";
import { METHOD_LABELS, PAYMENT_STATUS_LABELS } from "../../lib/constants";
import {
  normalizePaginatedList,
} from "../../lib/pagination";
import ResourceView from "../_components/ui/ResourceView";
import TablePagination from "../_components/ui/TablePagination";
import StandardPage from "../_components/ui/StandardPage";
import ResourceIdCell from "../_components/ui/ResourceIdCell";
import { useAuth } from "../_context/AuthContext";
import PageHeaderActions from "../_components/ui/PageHeaderActions";
import { usePaginatedFilters } from "../../hooks/usePaginatedFilters";
import RowOpenIndicator from "../_components/ui/RowOpenIndicator";
import { interactiveTableRowClass } from "../../lib/tableRows";

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
      const d = new Date();
      const start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
      const today = d.toISOString().slice(0, 10);
      return `/api/reports/collections-performance?start_date=${start}&end_date=${today}`;
    })() : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  );

  const collectedToday = todayRepData?.summary?.total_collected ?? 0;
  const collectedThisMonth = monthRepData?.summary?.total_collected ?? 0;

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
      title="Payments"
      subtitle="Chronological ledger of payments, reference codes, and contract links."
      breadcrumbs={<Breadcrumbs items={[{ label: "Payments" }]} />}
      loading={loading}
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
        <div className="grid gap-6 sm:grid-cols-2">
          <KpiCard
            label="Daily Collections"
            value={formatPHP(collectedToday)}
            sub="TOTAL TAKEN TODAY"
            isSuccess={collectedToday > 0}
            isLoading={!todayRepData && !monthRepData}
            isSyncing={todayValidating}
          />
          <KpiCard
            label="Monthly Volume"
            value={formatPHP(collectedThisMonth)}
            sub="POSTED COLLECTIONS MTD"
            isSuccess={collectedThisMonth > 0}
            isLoading={!todayRepData && !monthRepData}
            isSyncing={monthValidating}
          />
        </div>

        <FilterPanelCard icon={Search}>
            <div className="grid items-end gap-6 lg:grid-cols-12">
              <div className="lg:col-span-5">
                <Field label="Search payments">
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
                <Field label="Status">
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
          emptyProps={{
            title: "No payments found",
            message: "Adjust filters or record a payment to see results here."
          }}
        >
          <Card className="!p-0 overflow-hidden border-stone-200 rounded-2xl shadow-sm">
            <Table
              embedded
              caption={`Payments ledger — ${listMeta?.total ?? sortedFiltered.length} matching`}
              columns={[
                { key: "payment_id", label: "PAYMENT ID", sortable: true, sortKey: "payment_id", className: "w-28" },
                { key: "date", label: "PAYMENT DATE", sortable: true, sortKey: "date" },
                { key: "tenant", label: "RESIDENT", sortable: true, sortKey: "tenant" },
                { key: "amount", label: "AMOUNT PAID", sortable: true, sortKey: "amount", className: "text-right" },
                { key: "method", label: "PAYMENT METHOD", sortable: true, sortKey: "method" },
                { key: "status", label: "STATUS", sortable: true, sortKey: "status" },
                { key: "actions", label: "", className: "text-right w-16" },
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
                  <tr
                    key={payment.payment_id}
                    title="Open payment detail"
                    className={interactiveTableRowClass}
                    onClick={() => router.push(`/payments/${payment.payment_id}`)}
                  >
                    <td className="px-6 py-4">
                      <ResourceIdCell id={payment.payment_id} prefix="PAY" />
                    </td>
                    <td className="px-6 py-4 text-sm font-bold tabular-nums text-stone-600">
                      {formatDateString(payment.payment_date)}
                    </td>
                    <td className="px-6 py-4 text-sm font-black text-stone-900 group-hover:text-teal-700 transition-colors leading-tight">
                      {tenantName}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={`font-mono font-black tabular-nums ${isVoided ? "text-stone-300 line-through" : "text-emerald-700"}`}>
                        {formatPHP(payment.amount_paid)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Wallet size={12} className="text-stone-300" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-stone-500">
                          {METHOD_LABELS[methodKey] || payment?.payment_method || "Other"}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge size="sm">{rowStatus}</StatusBadge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <RowOpenIndicator compact />
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
    </StandardPage>
  );
}
