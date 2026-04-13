"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { FileText, Plus, Search, Building2, TrendingUp, AlertCircle, ArrowUpRight } from "lucide-react";

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
import Alert from "../_components/ui/Alert";
import Button from "../_components/ui/Button";
import { AppMain } from "../_components/ui/AppShell";
import { Card } from "../_components/ui/Card";
import FilterChips from "../_components/ui/FilterChips";
import { Field, Input, Select } from "../_components/ui/Fields";
import Breadcrumbs from "../_components/ui/Breadcrumbs";
import PageHeader from "../_components/ui/PageHeader";
import { SkeletonListPage } from "../_components/ui/Skeleton";
import UserRoleBadge from "../_components/ui/UserRoleBadge";
import { primaryLinkCtaClass } from "../_components/ui/LinkTokens";
import { StatusBadge } from "../_components/ui/StatusBadge";
import { Table } from "../_components/ui/Table";
import { KpiCard } from "../_components/ui/KpiCard";
import EmptyState from "../_components/ui/EmptyState";
import { BILLING_STATUS_LABELS } from "../../lib/constants";
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

export default function BillingListPage() {
  const router = useRouter();
  const { user: currentUser, authLoading } = useAuthGuard();
  const shouldReduceMotion = useReducedMotion();
  const [loading, setLoading] = useState(true);
  const [kpisLoading, setKpisLoading] = useState(true);
  const [viewDenied, setViewDenied] = useState(false);
  const [apiError, setApiError] = useState("");
  const [billings, setBillings] = useState([]);
  const [listMeta, setListMeta] = useState(null);

  const [statusFilter, setStatusFilter] = useState("all");
  const [tenantQuery, setTenantQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(() => readStoredPerPage());
  const [totalOutstanding, setTotalOutstanding] = useState(0);
  const [pastDueAmount, setPastDueAmount] = useState(0);
  const [collectedThisMonth, setCollectedThisMonth] = useState(0);
  const { sortColumn, sortDirection, onSortChange } = useTableSort();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(tenantQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [tenantQuery]);

  const fetchKpis = useCallback(async () => {
    if (!currentUser || !canViewBilling(currentUser)) return;
    setKpisLoading(true);
    try {
      const today = new Date();
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, "0");
      const start = `${y}-${m}-01`;
      const end = today.toISOString().slice(0, 10);
      const [outstanding, collections] = await Promise.all([
        apiRequest("/api/reports/outstanding-balances", { method: "GET" }),
        apiRequest(`/api/reports/collections-performance?start_date=${start}&end_date=${end}`, {
          method: "GET",
        }),
      ]);
      const rows = Array.isArray(outstanding?.rows) ? outstanding.rows : [];
      const todayStart = new Date(`${end}T00:00:00`);
      let pastDue = 0;
      if (outstanding?.summary?.past_due_amount != null) {
        pastDue = Number(outstanding.summary.past_due_amount);
      } else {
        for (const r of rows) {
          const bal = Number(r.outstanding_balance ?? 0);
          if (bal <= 0 || !r.due_date) continue;
          const due = new Date(String(r.due_date).slice(0, 10) + "T00:00:00");
          if (due < todayStart) pastDue += bal;
        }
      }
      setTotalOutstanding(Number(outstanding?.summary?.total_outstanding ?? 0));
      setPastDueAmount(pastDue);
      setCollectedThisMonth(Number(collections?.summary?.total_collected ?? 0));
    } catch {
      /* KPIs best-effort */
    } finally {
      setKpisLoading(false);
    }
  }, [currentUser]);

  const fetchBillings = useCallback(async () => {
    if (!canViewBilling(currentUser)) {
      setViewDenied(true);
      setLoading(false);
      return;
    }
    setApiError("");
    setLoading(true);
    try {
      const extra = {};
      if (debouncedQuery) extra.q = debouncedQuery;
      if (statusFilter === "overdue") extra.past_due = "1";
      else if (statusFilter !== "all") extra.status = statusFilter;
      const qs = buildPaginationQuery(page, perPage, extra);
      const data = await apiRequest(`/api/billing${qs}`, { method: "GET" });
      const { rows, meta } = normalizePaginatedList(data);
      setBillings(rows);
      setListMeta(meta);
    } catch (error) {
      setApiError(flattenApiErrors(error));
    } finally {
      setLoading(false);
    }
  }, [currentUser, page, perPage, debouncedQuery, statusFilter]);

  useEffect(() => {
    if (authLoading || !currentUser) return;
    fetchKpis();
  }, [authLoading, currentUser, fetchKpis]);

  useEffect(() => {
    if (authLoading || !currentUser) return;
    fetchBillings();
  }, [authLoading, currentUser, fetchBillings]);

  useEffect(() => {
    flushSync(() => {
      setPage(1);
    });
  }, [debouncedQuery, statusFilter]);

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
      list.sort(
        (a, b) =>
          ((Number(a.billing_id) || 0) - (Number(b.billing_id) || 0)) * dir
      );
      return list;
    }
    return sortClientRows(billings, sortColumn, sortDirection, (b) => {
      switch (sortColumn) {
        case "room":
          return b?.contract?.room?.room_code || String(b?.contract?.room_id ?? "");
        case "period":
          return b.billing_period_from || "";
        case "due_date":
          return b.due_date || "";
        case "total_amount":
          return Number(b.total_amount) || 0;
        case "total_paid":
          return Number(b.total_paid) || 0;
        case "balance":
          return Number(b.balance) || 0;
        case "status":
          return b.status || "";
        default:
          return "";
      }
    });
  }, [billings, sortColumn, sortDirection]);

  const canGenerateBilling = useMemo(() => canManageBilling(currentUser), [currentUser]);

  if (authLoading || (loading && currentUser)) {
    return (
      <AppMain>
        <SkeletonListPage />
      </AppMain>
    );
  }

  if (viewDenied) {
    return (
      <AppMain>
        <motion.div
          className="space-y-6"
          initial={shouldReduceMotion ? false : pageVariants.initial}
          animate={shouldReduceMotion ? false : pageVariants.animate}
          transition={shouldReduceMotion ? { duration: 0 } : pageVariants.transition}
        >
          <PageHeader
            title="Billing"
            subtitle="Monitor account balances and track monthly billing cycles across all contracts."
            breadcrumbs={<Breadcrumbs items={[{ label: "Billing" }]} />}
            actions={
              <UserRoleBadge username={currentUser?.username} roleName={currentUser?.role?.role_name} />
            }
          />
          <Alert variant="warning" title="Protocol Restricted">
            Clearing not granted for billing ledger access.
          </Alert>
        </motion.div>
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
          title="Billing"
          subtitle="Monitor account balances and track monthly billing cycles across all contracts."
          breadcrumbs={<Breadcrumbs items={[{ label: "Billing" }]} />}
          actions={
            <div className="flex flex-wrap items-center justify-end gap-3">
               {canGenerateBilling ? (
                <Link href="/billing/new" className={primaryLinkCtaClass + " gap-2 !px-5 shadow-sm"}>
                  <Plus size={18} aria-hidden />
                  Generate Bill
                </Link>
              ) : null}
              <div className="flex items-center border-l border-stone-200 pl-3">
                <UserRoleBadge username={currentUser?.username} roleName={currentUser?.role?.role_name} />
              </div>
            </div>
          }
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <KpiCard
            label="Total Uncollected"
            icon={Building2}
            value={formatPHP(totalOutstanding)}
            isLoading={kpisLoading}
          />
          <KpiCard
            label="Past Due Amount"
            icon={AlertCircle}
            value={formatPHP(pastDueAmount)}
            isDanger={pastDueAmount > 0}
            isLoading={kpisLoading}
          />
          <KpiCard 
            label="MTD Collection" 
            icon={TrendingUp}
            value={formatPHP(collectedThisMonth)} 
            isSuccess 
            isLoading={kpisLoading}
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
            {!canGenerateBilling ? (
              <span className="text-[10px] font-bold uppercase tracking-widest text-stone-300">Read-only access</span>
            ) : null}
          </div>
          <div className="p-8">
            <div className="grid items-end gap-6 md:grid-cols-12">
              <div className="md:col-span-8 lg:col-span-9">
                <Field label="Cross-reference search">
                  <div className="group relative">
                    <Search
                      className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-stone-400 transition-colors group-focus-within:text-teal-600"
                      aria-hidden
                    />
                    <Input
                      value={tenantQuery}
                      onChange={(event) => setTenantQuery(event.target.value)}
                      placeholder="Tenant name, phone, or billing ID…"
                      className="!h-12 border-stone-200 pl-11 font-medium transition-[border-color,box-shadow] focus:border-teal-500/50 focus:ring-4 focus:ring-teal-500/5"
                    />
                  </div>
                </Field>
              </div>
              <div className="md:col-span-4 lg:col-span-3">
                <Field label="Billing status">
                  <Select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                    className="!h-12 border-stone-200 font-bold focus:border-teal-500/50"
                  >
                    <option value="all">All statuses</option>
                    {Object.entries(BILLING_STATUS_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {key === "overdue" ? "Past due (receivable)" : label}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            </div>

            <FilterChips
              className="mt-6"
              items={[
                {
                  key: "search",
                  label: "Query",
                  value: tenantQuery,
                  onClear: () => setTenantQuery(""),
                },
                {
                  key: "status",
                  label: "Status",
                  value:
                    statusFilter !== "all"
                      ? statusFilter === "overdue"
                        ? "Past due (receivable)"
                        : BILLING_STATUS_LABELS[statusFilter] || statusFilter
                      : "",
                  onClear: () => setStatusFilter("all"),
                },
              ]}
              onClearAll={() => {
                setTenantQuery("");
                setStatusFilter("all");
              }}
            />
          </div>
        </Card>

        {apiError ? (
          <Alert variant="error" title="Could not load billing">
            {apiError}
          </Alert>
        ) : null}

        <div className="mt-6">
          {sortedFiltered.length > 0 ? (
            <Card className="overflow-hidden rounded-2xl border-stone-200 !p-0 shadow-sm">
            <Table
              embedded
              caption={`Billing cycles by tenant and room assignment — ${listMeta?.total ?? sortedFiltered.length} matching`}
              ariaLabel="Billing records table"
              columns={[
                {
                  key: "billing_id",
                  label: "Billing ID",
                  sortable: true,
                  sortKey: "billing_id",
                  className: "w-32",
                },
                { key: "tenant", label: "Tenant", sortable: true, sortKey: "tenant" },
                { key: "period", label: "Billing period", sortable: true, sortKey: "period" },
                {
                  key: "balance",
                  label: "Balance",
                  sortable: true,
                  sortKey: "balance",
                  className: "text-right",
                },
                { key: "status", label: "Status", sortable: true, sortKey: "status" },
                { key: "actions", label: "", className: "text-right w-16" },
              ]}
              sortColumn={sortColumn}
              sortDirection={sortDirection}
              onSortChange={onSortChange}
              rows={sortedFiltered.map((billing) => {
                const tenant = billing?.contract?.tenant;
                const tenantName = tenant ? formatTenantDirectoryName(tenant) : "—";
                const roomCode = billing?.contract?.room?.room_code || "—";
                const amountDue = Number(billing.total_amount);
                const amountPaid = Number(billing.total_paid);
                const balance = Number(billing.balance);

                return (
                  <tr
                    key={billing.billing_id}
                    title="Open billing record"
                    className="group cursor-pointer border-t border-stone-100 transition-colors hover:bg-stone-50 active:bg-stone-100"
                    onClick={() => router.push(`/billing/${billing.billing_id}`)}
                  >
                    <td className="px-6 py-4">
                      <span className="font-mono text-[10px] font-bold uppercase tracking-tighter text-stone-400 tabular-nums">
                        #BILL-{billing.billing_id}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-stone-900 group-hover:text-teal-900">
                          {tenantName}
                        </span>
                        <span className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-stone-400">
                          Room {roomCode}
                        </span>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-stone-700">
                          Due {formatDateString(billing.due_date)}
                        </span>
                        <span className="mt-0.5 text-[10px] font-medium text-stone-400">
                          {formatDateString(billing.billing_period_from)} –{" "}
                          {formatDateString(billing.billing_period_to)}
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
                        <div className="mt-0.5 flex items-center gap-1 font-mono text-[9px] font-bold uppercase tracking-tighter text-stone-400">
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
                      <div className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-400 transition-[border-color,box-shadow,colors] group-hover:border-teal-200 group-hover:bg-teal-50 group-hover:text-teal-600">
                        <ArrowUpRight size={16} aria-hidden />
                      </div>
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
              onPerPageChange={(n) => {
                setPage(1);
                setPerPage(n);
              }}
              disabled={loading}
            />
            </Card>
          ) : (
            <div className="rounded-2xl border border-stone-200 bg-white p-12 shadow-sm">
              <EmptyState
                icon={FileText}
                title="No billing records"
                message="Adjust filters or generate a new cycle when contracts are active."
                action={
                  canGenerateBilling ? (
                    <Button
                      variant="primary"
                      className={primaryLinkCtaClass}
                      onClick={() => router.push("/billing/new")}
                    >
                      Generate bill
                    </Button>
                  ) : null
                }
              />
            </div>
          )}
        </div>
      </motion.div>
    </AppMain>
  );
}
