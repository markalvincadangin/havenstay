"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import { Plus, Search, ArrowUpRight, Wallet } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

import { apiRequest } from "../../lib/api";
import { flattenApiErrors } from "../../lib/errors";
import { canManageBilling, canViewBilling } from "../../lib/auth";
import { useAuthGuard } from "../../hooks/useAuthGuard";
import { useTableSort } from "../../hooks/useTableSort";
import { sortClientRows } from "../../lib/tableSort";
import {
  compareTenantDirectoryName,
  formatDateString,
  formatPHP,
  formatTenantDirectoryName,
} from "../../lib/formatters";
import { StatusBadge } from "../_components/ui/StatusBadge";
import Alert from "../_components/ui/Alert";
import { AppMain } from "../_components/ui/AppShell";
import { Card } from "../_components/ui/Card";
import FilterChips from "../_components/ui/FilterChips";
import { Field, Input, Select } from "../_components/ui/Fields";
import Breadcrumbs from "../_components/ui/Breadcrumbs";
import PageHeader from "../_components/ui/PageHeader";
import { SkeletonListPage } from "../_components/ui/Skeleton";
import UserRoleBadge from "../_components/ui/UserRoleBadge";
import { primaryLinkCtaClass } from "../_components/ui/LinkTokens";
import { Table } from "../_components/ui/Table";
import { KpiCard } from "../_components/ui/KpiCard";
import { METHOD_LABELS, PAYMENT_STATUS_LABELS } from "../../lib/constants";
import {
  buildPaginationQuery,
  normalizePaginatedList,
  readStoredPerPage,
} from "../../lib/pagination";
import TablePagination from "../_components/ui/TablePagination";

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.2, ease: "easeOut" },
};

function paymentRowStatus(p) {
  return p?.voided_at ? "voided" : "posted";
}

export default function PaymentsListPage() {
  const router = useRouter();
  const { user: currentUser, authLoading } = useAuthGuard();
  const shouldReduceMotion = useReducedMotion();
  const [loading, setLoading] = useState(true);
  const [kpisLoading, setKpisLoading] = useState(true);
  const [apiError, setApiError] = useState("");
  const [payments, setPayments] = useState([]);
  const [listMeta, setListMeta] = useState(null);

  const [tenantQuery, setTenantQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(() => readStoredPerPage());
  const [collectedToday, setCollectedToday] = useState(0);
  const [collectedThisMonth, setCollectedThisMonth] = useState(0);
  const { sortColumn, sortDirection, onSortChange } = useTableSort();

  const canPostPayments = useMemo(() => canManageBilling(currentUser), [currentUser]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(tenantQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [tenantQuery]);

  const fetchKpis = useCallback(async () => {
    if (!currentUser || !canViewBilling(currentUser)) return;
    setKpisLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const d = new Date();
      const start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
      const [todayRep, monthRep] = await Promise.all([
        apiRequest(`/api/reports/collections-performance?start_date=${today}&end_date=${today}`, {
          method: "GET",
        }),
        apiRequest(`/api/reports/collections-performance?start_date=${start}&end_date=${today}`, {
          method: "GET",
        }),
      ]);
      setCollectedToday(Number(todayRep?.summary?.total_collected ?? 0));
      setCollectedThisMonth(Number(monthRep?.summary?.total_collected ?? 0));
    } catch {
      /* KPIs best-effort */
    } finally {
      setKpisLoading(false);
    }
  }, [currentUser]);

  const fetchPayments = useCallback(async () => {
    if (!canViewBilling(currentUser)) {
      setLoading(false);
      return;
    }
    setApiError("");
    setLoading(true);
    try {
      const extra = {};
      if (debouncedQuery) extra.q = debouncedQuery;
      if (dateFrom) extra.payment_from = dateFrom;
      if (dateTo) extra.payment_to = dateTo;
      if (statusFilter === "posted" || statusFilter === "voided") {
        extra.posting_status = statusFilter;
      }
      const qs = buildPaginationQuery(page, perPage, extra);
      const data = await apiRequest(`/api/payments${qs}`, { method: "GET" });
      const { rows, meta } = normalizePaginatedList(data);
      setPayments(rows);
      setListMeta(meta);
    } catch (error) {
      setApiError(flattenApiErrors(error));
    } finally {
      setLoading(false);
    }
  }, [currentUser, page, perPage, debouncedQuery, dateFrom, dateTo, statusFilter]);

  useEffect(() => {
    if (authLoading || !currentUser) return;
    fetchKpis();
  }, [authLoading, currentUser, fetchKpis]);

  useEffect(() => {
    if (authLoading || !currentUser) return;
    fetchPayments();
  }, [authLoading, currentUser, fetchPayments]);

  useEffect(() => {
    flushSync(() => {
      setPage(1);
    });
  }, [debouncedQuery, dateFrom, dateTo, statusFilter]);

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

  if (authLoading || loading) {
    return (
      <AppMain>
        <SkeletonListPage />
      </AppMain>
    );
  }

  return (
    <AppMain>
      <motion.div
        className="space-y-6"
        initial={shouldReduceMotion ? false : pageVariants.initial}
        animate={shouldReduceMotion ? false : pageVariants.animate}
        transition={shouldReduceMotion ? { duration: 0 } : pageVariants.transition}
      >
        <PageHeader
          title="Payments"
          subtitle="Chronological ledger of payments, reference codes, and contract links."
          breadcrumbs={<Breadcrumbs items={[{ label: "Payments" }]} />}
          actions={
            <>
              {canPostPayments && (
                <Link href="/payments/new" className={primaryLinkCtaClass + " !h-11 rounded-xl bg-teal-600 px-4 sm:px-8 text-[10px] font-black uppercase tracking-widest shadow-xl shadow-teal-900/10 hover:bg-teal-700 active:scale-95"}>
                  <Plus size={18} aria-hidden />
                  <span className="hidden sm:inline">Register Payment</span>
                  <span className="sm:hidden">New</span>
                </Link>
              )}
              <div className="hidden sm:block border-l border-stone-200 h-6 mx-1" />
              <UserRoleBadge username={currentUser?.username} roleName={currentUser?.role?.role_name} />
            </>
          }
        />

        <div className="grid gap-6 sm:grid-cols-2">
          <KpiCard
            label="Total Collected Today"
            value={formatPHP(collectedToday)}
            emphasis="success"
            trend={null}
            isLoading={kpisLoading}
          />
          <KpiCard
            label="Total Collected This Month"
            value={formatPHP(collectedThisMonth)}
            emphasis="primary"
            trend={null}
            isLoading={kpisLoading}
          />
        </div>

        <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
          <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/50 px-8 py-5">
            <div className="flex items-center gap-3">
              <div className="flex size-8 items-center justify-center rounded-lg bg-stone-100 text-stone-600 shadow-sm">
                <Search size={16} aria-hidden />
              </div>
              <h2 className="hs-strip-title text-stone-400 tracking-widest uppercase font-black text-sm">Filter Payments</h2>
            </div>
          </div>
          <div className="p-8">
            <div className="grid items-end gap-6 lg:grid-cols-12">
              <div className="lg:col-span-5">
                <Field label="Cross-Reference Search">
                  <Input
                    icon={Search}
                    value={tenantQuery}
                    onChange={(e) => setTenantQuery(e.target.value)}
                    placeholder="Resident name, Payment ID, or Reference…"
                    className="!h-12 border-stone-200"
                  />
                </Field>
              </div>
              <div className="lg:col-span-3">
                <Field label="Posting Status">
                  <Select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="!h-12 border-stone-200 font-bold uppercase tracking-widest text-[10px]"
                  >
                    <option value="all">All Statuses</option>
                    {Object.entries(PAYMENT_STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <div className="lg:col-span-2">
                <Field label="Range From">
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="!h-12 border-stone-200 font-bold"
                  />
                </Field>
              </div>
              <div className="lg:col-span-2">
                <Field label="Range To">
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="!h-12 border-stone-200 font-bold"
                  />
                </Field>
              </div>
            </div>
            <FilterChips
              className="mt-6"
              items={[
                { key: "tenant", label: "Search", value: tenantQuery, onClear: () => setTenantQuery("") },
                {
                  key: "status",
                  label: "Status",
                  value: statusFilter !== "all" ? PAYMENT_STATUS_LABELS[statusFilter] || statusFilter : "",
                  onClear: () => setStatusFilter("all"),
                },
                { key: "from", label: "Date From", value: dateFrom, onClear: () => setDateFrom("") },
                { key: "to", label: "Date To", value: dateTo, onClear: () => setDateTo("") },
              ]}
              onClearAll={() => {
                setTenantQuery("");
                setStatusFilter("all");
                setDateFrom("");
                setDateTo("");
              }}
            />
          </div>
        </Card>

        {apiError && <Alert variant="error" title="Could not load payments">{apiError}</Alert>}

        <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden shadow-sm">
          <Table
            variant="embedded"
            caption={`Payment ledger — ${listMeta?.total ?? sortedFiltered.length} matching`}
            columns={[
              { key: "payment_id", label: "Payment ID", sortable: true, sortKey: "payment_id", className: "w-28" },
              { key: "date", label: "Payment date", sortable: true, sortKey: "date" },
              { key: "tenant", label: "Tenant", sortable: true, sortKey: "tenant" },
              { key: "amount", label: "Amount paid", sortable: true, sortKey: "amount", className: "text-right" },
              { key: "method", label: "Payment method", sortable: true, sortKey: "method" },
              { key: "status", label: "Status", sortable: true, sortKey: "status" },
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

              return (
                <tr
                  key={payment.payment_id}
                  className="group cursor-pointer border-t border-stone-50 transition-colors hover:bg-stone-50/50"
                  onClick={() => router.push(`/payments/${payment.payment_id}`)}
                >
                  <td className="px-6 py-4">
                    <span className="font-mono text-[10px] font-black tracking-widest text-stone-400">
                      PAY-{String(payment.payment_id).padStart(6, '0')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-bold tabular-nums text-stone-600">
                    {formatDateString(payment.payment_date)}
                  </td>
                  <td className="px-6 py-4 text-sm font-black text-stone-900 group-hover:text-teal-700 transition-colors">
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
                        {METHOD_LABELS[payment.payment_method.toLowerCase()] || payment.payment_method || "Other"}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge>{rowStatus}</StatusBadge>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div
                      className="inline-flex size-10 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-300 transition-all group-hover:border-teal-200 group-hover:bg-teal-50 group-hover:text-teal-600 shadow-sm"
                      aria-label="View transaction"
                    >
                      <ArrowUpRight size={16} />
                    </div>
                  </td>
                </tr>
              );
            })}
            emptyTitle="No transactions posted"
            emptyDescription="Adjust filters or check for archive entries."
          />
          <TablePagination
            meta={listMeta}
            page={page}
            perPage={perPage}
            onPageChange={setPage}
            onPerPageChange={(n) => {
              setPage(1);
              setPerPage(n);
            }}
            disabled={loading}
          />
        </div>
      </motion.div>
    </AppMain>
  );
}
