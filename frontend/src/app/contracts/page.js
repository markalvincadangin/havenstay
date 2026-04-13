"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { FileText, Plus, Search, ArrowUpRight, ShieldCheck, Wallet, Receipt } from "lucide-react";

import { apiRequest } from "../../lib/api";
import { flattenApiErrors } from "../../lib/errors";
import { canManageContracts } from "../../lib/auth";
import { useAuthGuard } from "../../hooks/useAuthGuard";
import { useTableSort } from "../../hooks/useTableSort";
import { sortClientRows } from "../../lib/tableSort";
import {
  compareTenantDirectoryName,
  formatDateString,
  formatPHP,
  formatTenantDirectoryName,
} from "../../lib/formatters";
import Button from "../_components/ui/Button";
import Alert from "../_components/ui/Alert";
import { AppMain } from "../_components/ui/AppShell";
import { Card } from "../_components/ui/Card";
import TablePagination from "../_components/ui/TablePagination";
import { Field, Input, Select } from "../_components/ui/Fields";
import FilterChips from "../_components/ui/FilterChips";
import Breadcrumbs from "../_components/ui/Breadcrumbs";
import PageHeader from "../_components/ui/PageHeader";
import { SkeletonListPage } from "../_components/ui/Skeleton";
import UserRoleBadge from "../_components/ui/UserRoleBadge";
import { primaryLinkCtaClass } from "../_components/ui/LinkTokens";
import { Table } from "../_components/ui/Table";
import { StatusBadge } from "../_components/ui/StatusBadge";
import { KpiCard } from "../_components/ui/KpiCard";
import EmptyState from "../_components/ui/EmptyState";
import {
  buildPaginationQuery,
  normalizePaginatedList,
  readStoredPerPage,
} from "../../lib/pagination";
import { CONTRACT_STATUS_LABELS } from "../../lib/constants";

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.2, ease: "easeOut" },
};

export default function ContractsListPage() {
  const router = useRouter();
  const { user: currentUser, authLoading } = useAuthGuard();
  const shouldReduceMotion = useReducedMotion();
  const [loading, setLoading] = useState(true);
  const [kpisLoading, setKpisLoading] = useState(true);
  const [apiError, setApiError] = useState("");
  const [contracts, setContracts] = useState([]);
  const [listMeta, setListMeta] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(() => readStoredPerPage());
  const [kpis, setKpis] = useState({
    activeCount: 0,
    totalDeposits: 0,
    potentialRevenue: 0,
  });
  const { sortColumn, sortDirection, onSortChange } = useTableSort();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const fetchKpis = useCallback(async () => {
    setKpisLoading(true);
    try {
      const report = await apiRequest("/api/reports/active-contracts", { method: "GET" });
      const reportRows = report?.rows ?? [];
      const potentialRevenue = reportRows.reduce((s, r) => s + Number(r.monthly_rate || 0), 0);
      const activeCount = report?.summary?.contract_count ?? reportRows.length;

      let totalDeposits = 0;
      let p = 1;
      let lastPage = 1;
      do {
        const data = await apiRequest(`/api/contracts?status=active&per_page=100&page=${p}`, { method: "GET" });
        const { rows: batch, meta } = normalizePaginatedList(data);
        totalDeposits += batch.reduce((s, c) => s + Number(c.deposit_amount || 0), 0);
        lastPage = meta?.last_page ?? 1;
        p += 1;
      } while (p <= lastPage);

      setKpis({ activeCount, totalDeposits, potentialRevenue });
    } catch {
      /* KPIs best-effort */
    } finally {
      setKpisLoading(false);
    }
  }, []);

  const fetchContracts = useCallback(async () => {
    setApiError("");
    setLoading(true);
    try {
      const extra = {};
      if (debouncedSearch) extra.q = debouncedSearch;
      if (statusFilter !== "all") extra.status = statusFilter;
      const qs = buildPaginationQuery(page, perPage, extra);
      const data = await apiRequest(`/api/contracts${qs}`, { method: "GET" });
      const { rows, meta } = normalizePaginatedList(data);
      setContracts(rows);
      setListMeta(meta);
    } catch (error) {
      setApiError(flattenApiErrors(error));
    } finally {
      setLoading(false);
    }
  }, [page, perPage, debouncedSearch, statusFilter]);

  useEffect(() => {
    if (authLoading || !currentUser) return;
    fetchKpis();
  }, [authLoading, currentUser, fetchKpis]);

  useEffect(() => {
    if (authLoading || !currentUser) return;
    fetchContracts();
  }, [authLoading, currentUser, fetchContracts]);

  useEffect(() => {
    flushSync(() => {
      setPage(1);
    });
  }, [debouncedSearch, statusFilter]);

  const sortedRows = useMemo(() => {
    if (!sortColumn) return contracts;
    if (sortColumn === "tenant") {
      const list = [...contracts];
      const dir = sortDirection === "asc" ? 1 : -1;
      list.sort((a, b) => {
        const ta = a.tenant;
        const tb = b.tenant;
        if (!ta && !tb) return 0;
        if (!ta) return 1;
        if (!tb) return -1;
        return compareTenantDirectoryName(ta, tb) * dir;
      });
      return list;
    }
    return sortClientRows(contracts, sortColumn, sortDirection, (c) => {
      switch (sortColumn) {
        case "contract_id":
          return Number(c.contract_id) || 0;
        case "move_in_date":
          return c.move_in_date || "";
        case "room":
          return c.room?.room_code || "";
        case "monthly_rate":
          return Number(c.monthly_rate) || 0;
        case "status":
          return c.status || "";
        default:
          return "";
      }
    });
  }, [contracts, sortColumn, sortDirection]);

  if (authLoading || (loading && currentUser)) {
    return (
      <AppMain>
        <SkeletonListPage rows={10} />
      </AppMain>
    );
  }

  const canWrite = canManageContracts(currentUser);

  return (
    <AppMain>
      <motion.div
        initial={shouldReduceMotion ? false : pageVariants.initial}
        animate={shouldReduceMotion ? false : pageVariants.animate}
        transition={shouldReduceMotion ? { duration: 0 } : pageVariants.transition}
        className="space-y-6"
      >
        <PageHeader
          title="Contract Ledger"
          subtitle="Chronological history of active and historical lease agreements."
          breadcrumbs={<Breadcrumbs items={[{ label: "Contract Ledger" }]} />}
          actions={
            <div className="flex items-center gap-3">
              {canWrite ? (
                <Link
                  href="/contracts/new"
                  className={primaryLinkCtaClass + " gap-2 !px-5 shadow-lg shadow-teal-900/10 active:scale-95"}
                >
                  <Plus size={18} aria-hidden />
                  <span>Register Contract</span>
                </Link>
              ) : null}
              <div className={`flex items-center ${canWrite ? "border-l border-stone-200 pl-3" : ""}`}>
                <UserRoleBadge username={currentUser?.username} roleName={currentUser?.role?.role_name} />
              </div>
            </div>
          }
        />

        {/* KPI Summary Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <KpiCard
            label="Active Agreements"
            icon={ShieldCheck}
            value={kpis.activeCount}
            sub="Current operational leases"
            isLoading={kpisLoading}
          />
          <KpiCard
            label="Security Deposits"
            icon={Wallet}
            value={formatPHP(kpis.totalDeposits)}
            sub="Total escrowed amount"
            isLoading={kpisLoading}
          />
          <KpiCard
            label="Monthly rate (active)"
            icon={Receipt}
            value={formatPHP(kpis.potentialRevenue)}
            sub="Sum of monthly_rate (active contracts)"
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
            {!canWrite && (
              <span className="text-[10px] font-bold uppercase tracking-widest text-stone-300">Read-Only Access</span>
            )}
          </div>

          <div className="p-8">
            <div className="grid items-end gap-6 md:grid-cols-12">
              <div className="md:col-span-8 lg:col-span-9">
                <Field label="Cross-Reference Search">
                  <div className="group relative">
                    <Search
                      className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-stone-400 transition-colors group-focus-within:text-teal-600"
                      aria-hidden
                    />
                    <Input
                      placeholder="Search tenant name, room code, or contract ID…"
                      className="!h-12 border-stone-200 pl-11 transition-[border-color,box-shadow] focus:border-teal-500/50 focus:ring-4 focus:ring-teal-500/5"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </Field>
              </div>
              <div className="md:col-span-4 lg:col-span-3">
                <Field label="Agreement Status">
                  <Select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="!h-12 border-stone-200 font-bold focus:border-teal-500/50"
                  >
                    <option value="all">All Agreements</option>
                    {Object.entries(CONTRACT_STATUS_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
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
                  value: searchQuery,
                  onClear: () => setSearchQuery(""),
                },
                {
                  key: "status",
                  label: "Status",
                  value:
                    statusFilter !== "all"
                      ? CONTRACT_STATUS_LABELS[statusFilter] || statusFilter
                      : "",
                  onClear: () => setStatusFilter("all"),
                },
              ]}
              onClearAll={() => {
                setSearchQuery("");
                setStatusFilter("all");
              }}
            />
          </div>
        </Card>

        <div className="mt-6">
          {apiError ? (
            <Alert variant="error" title="Could not load contracts">
              {apiError}
              <button
                type="button"
                onClick={() => {
                  void fetchContracts();
                }}
                className="mt-2 text-xs font-bold underline"
              >
                Retry
              </button>
            </Alert>
          ) : sortedRows.length > 0 ? (
            <Card className="overflow-hidden rounded-2xl border-stone-200 !p-0 shadow-sm">
            <Table
              embedded
              caption={`Operational ledger of lease agreements — ${listMeta?.total ?? sortedRows.length} matching`}
              columns={[
                {
                  key: "contract_id",
                  label: "Contract ID",
                  sortable: true,
                  sortKey: "contract_id",
                  className: "w-32",
                },
                { key: "tenant", label: "Tenant", sortable: true, sortKey: "tenant" },
                {
                  key: "move_in_date",
                  label: "Move-in",
                  sortable: true,
                  sortKey: "move_in_date",
                  className: "w-36",
                },
                { key: "room", label: "Room / bed space", sortable: true, sortKey: "room" },
                {
                  key: "monthly_rate",
                  label: "Monthly rate",
                  sortable: true,
                  sortKey: "monthly_rate",
                  className: "text-right",
                },
                { key: "status", label: "Status", sortable: true, sortKey: "status" },
                { key: "actions", label: "", className: "text-right w-16" },
              ]}
              sortColumn={sortColumn}
              sortDirection={sortDirection}
              onSortChange={onSortChange}
              rows={sortedRows.map((c) => {
                const tenant = c.tenant;
                const tenantName = tenant ? formatTenantDirectoryName(tenant) : "—";
                const roomLabel = c.room?.room_code ? `${c.room.room_code}` : "—";
                const bedLabel = c.bed_space?.bed_label || c.bedSpace?.bed_label;

                return (
                  <tr
                    key={c.contract_id}
                    title="Open contract detail"
                    className="group cursor-pointer border-t border-stone-100 transition-colors hover:bg-stone-50 active:bg-stone-100"
                    onClick={() => router.push(`/contracts/${c.contract_id}`)}
                  >
                    <td className="px-6 py-4">
                      <span className="font-mono text-[10px] font-bold uppercase tracking-tighter text-stone-400 tabular-nums">
                        #CONTRACT-{c.contract_id}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        {tenant ? (
                          <Link
                            href={`/tenants/${tenant.tenant_id}`}
                            className="text-sm font-bold text-stone-900 transition-colors hover:text-teal-700"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {tenantName}
                          </Link>
                        ) : (
                          <span className="text-sm text-stone-600">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-sm tabular-nums text-stone-700">
                        {c.move_in_date ? formatDateString(c.move_in_date) : "—"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        {c.room ? (
                          <Link
                            href={`/rooms/${c.room.room_id}`}
                            className="text-sm font-bold text-stone-900 transition-colors hover:text-teal-700"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {roomLabel}
                          </Link>
                        ) : (
                          <span className="text-sm text-stone-600">—</span>
                        )}
                        {bedLabel && (
                          <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400 leading-none mt-1">
                            {bedLabel}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                       <span className="font-mono text-sm font-bold tabular-nums text-stone-900">
                        {c.monthly_rate != null ? formatPHP(c.monthly_rate) : "—"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge size="sm">{c.status}</StatusBadge>
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
            <div className="rounded-2xl border border-stone-200 bg-white p-12">
              <EmptyState
                icon={FileText}
                title="No agreements found"
                message="Adjust filters or register a new contract agreement when a resident moves in."
                action={canWrite ? (
                  <Button
                    variant="primary"
                    className={primaryLinkCtaClass}
                    onClick={() => router.push("/contracts/new")}
                  >
                    Register First Contract
                  </Button>
                ) : null}
              />
            </div>
          )}
        </div>
      </motion.div>
    </AppMain>
  );
}
