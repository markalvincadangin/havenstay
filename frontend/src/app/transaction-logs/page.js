"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Activity, Search, X, Terminal, ListFilter } from "lucide-react";
import { apiRequest } from "../../lib/api";
import { canManageUsers } from "../../lib/auth";
import { flattenApiErrors } from "../../lib/errors";
import { useAuthGuard } from "../../hooks/useAuthGuard";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import Alert from "../_components/ui/Alert";
import { AppMain } from "../_components/ui/AppShell";
import Breadcrumbs from "../_components/ui/Breadcrumbs";
import Button from "../_components/ui/Button";
import { Card } from "../_components/ui/Card";
import { Field, Input, Select } from "../_components/ui/Fields";
import FilterChips from "../_components/ui/FilterChips";
import PageHeader from "../_components/ui/PageHeader";
import { SkeletonListPage } from "../_components/ui/Skeleton";
import UserRoleBadge from "../_components/ui/UserRoleBadge";
import { Table } from "../_components/ui/Table";
import { StatusBadge } from "../_components/ui/StatusBadge";
import { KpiCard } from "../_components/ui/KpiCard";
import { CorrelationIdCell } from "../_components/ui/CorrelationIdCell";
import { AUDIT_ENTITY_LABELS, TX_LOG_STATUS_LABELS } from "../../lib/constants";
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

function formatTxName(name) {
  if (!name) return "—";
  const clean = name.replace(/^(sp_|trg_)/, "");
  return clean.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatEntity(entity) {
  return (
    AUDIT_ENTITY_LABELS[entity] ||
    entity?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) ||
    "—"
  );
}

function formatDuration(start, end) {
  if (!start || !end) return null;
  const s = new Date(start);
  const e = new Date(end);
  const diff = e.getTime() - s.getTime();
  if (diff < 0) return null;
  if (diff < 1000) return `${diff}ms`;
  return `${(diff / 1000).toFixed(2)}s`;
}

function formatLogTimestamp(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function safeParseJson(value) {
  if (!value) return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function correlationColumnLabel() {
  return (
    <span title="Optional. May match rows on Audit Trail from the same workflow run.">
      Correlation
    </span>
  );
}

export default function TransactionLogsPage() {
  const { user: currentUser, authLoading } = useAuthGuard();
  const shouldReduceMotion = useReducedMotion();

  const [logs, setLogs] = useState([]);
  const [listMeta, setListMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  /** Draft filters (edit in the form; table uses applied* until Apply). */
  const [filterQuery, setFilterQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  /** Committed filters — same pattern as Audit Trail (Apply filters). */
  const [appliedQuery, setAppliedQuery] = useState("");
  const [appliedStatus, setAppliedStatus] = useState("all");
  const [appliedFrom, setAppliedFrom] = useState("");
  const [appliedTo, setAppliedTo] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(() => readStoredPerPage());

  const [selectedLog, setSelectedLog] = useState(null);
  const modalRef = useFocusTrap(!!selectedLog);

  const canAccess = useMemo(() => canManageUsers(currentUser), [currentUser]);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const extra = {};
      if (appliedQuery) extra.q = appliedQuery;
      if (appliedStatus !== "all") extra.status = appliedStatus;
      if (appliedFrom) extra.from = appliedFrom;
      if (appliedTo) extra.to = appliedTo;
      const qs = buildPaginationQuery(page, perPage, extra);
      const data = await apiRequest(`/api/transaction-logs${qs}`);
      const { rows, meta } = normalizePaginatedList(data);
      setLogs(rows);
      setListMeta(meta);
    } catch (err) {
      console.error("Failed to load transaction logs:", flattenApiErrors(err));
      setLogs([]);
      setListMeta(null);
    } finally {
      setLoading(false);
    }
  }, [page, perPage, appliedQuery, appliedStatus, appliedFrom, appliedTo]);

  useEffect(() => {
    if (!authLoading && currentUser && canAccess) {
      loadLogs();
    }
  }, [authLoading, currentUser, canAccess, loadLogs]);

  const totalMatching = listMeta?.total ?? logs.length;

  const filteredLogs = logs;

  if (authLoading || (currentUser && canAccess && loading && !logs.length)) {
    return <SkeletonListPage rows={10} />;
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
          title="Transaction logs"
          subtitle="Workflow runs and database transaction outcomes (started, committed, rolled back, or failed)."
          breadcrumbs={<Breadcrumbs items={[{ label: "System Administration" }, { label: "Transaction logs" }]} />}
          actions={
            <div className="flex flex-wrap items-center justify-end gap-3">
              <Link
                href="/audit-logs"
                className="inline-flex h-11 items-center rounded-xl border border-stone-200 bg-white px-4 text-[10px] font-bold uppercase tracking-widest text-stone-600 transition-colors hover:border-teal-300 hover:text-teal-700"
              >
                Audit Trail
              </Link>
              <div className="border-l border-stone-200 pl-3">
                <UserRoleBadge username={currentUser?.username} roleName={currentUser?.role?.role_name} />
              </div>
            </div>
          }
        />

        {!canAccess ? (
          <Alert variant="warning" title="Access denied" data-testid="access-denied-transaction-logs">
            Only administrators can view transaction logs. Contact an admin if you need access.
          </Alert>
        ) : (
          <>
            <div className="grid max-w-md gap-4">
              <KpiCard
                label="Runs after filters"
                value={totalMatching}
                icon={Terminal}
                sub="Same rules as the table below · all pages"
              />
            </div>

            <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 bg-stone-50/50 px-6 py-4 sm:px-8 sm:py-5">
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-600">
                    <ListFilter size={14} aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <h2 className="hs-strip-title text-stone-400 tracking-widest uppercase font-black text-sm">Filters</h2>
                    <p className="mt-0.5 text-[10px] font-medium text-stone-400">
                      Search by process name, user, reference, or correlation ID. Use Apply filters to update the table.
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={loadLogs}
                  disabled={loading}
                  className="!h-8 px-3 text-[10px] font-bold uppercase tracking-widest text-stone-400 hover:text-teal-600 disabled:opacity-50"
                >
                  Refresh
                </Button>
              </div>
              <div className="p-8">
                <form
                  className="flex flex-col gap-6"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setPage(1);
                    setAppliedQuery(filterQuery.trim());
                    setAppliedStatus(statusFilter);
                    setAppliedFrom(dateFrom);
                    setAppliedTo(dateTo);
                  }}
                >
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-12 lg:gap-6">
                    <div className="min-w-0 lg:col-span-8">
                      <Field
                        label="Search"
                        helpText="Process name, user, billing or contract reference, or correlation UUID."
                      >
                        <div className="group relative">
                          <Search
                            className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-stone-400 transition-colors group-focus-within:text-teal-600"
                            aria-hidden
                          />
                          <Input
                            placeholder="Process, user, reference, or UUID…"
                            value={filterQuery}
                            onChange={(e) => setFilterQuery(e.target.value)}
                            className="!h-12 w-full min-w-0 border-stone-200 pl-11 font-medium transition-[border-color,box-shadow] focus:border-teal-500/50 focus:ring-4 focus:ring-teal-500/5"
                          />
                        </div>
                      </Field>
                    </div>
                    <div className="min-w-0 lg:col-span-4">
                      <Field label="Status">
                        <Select
                          value={statusFilter}
                          onChange={(e) => setStatusFilter(e.target.value)}
                          className="!h-12 w-full min-w-0 border-stone-200 font-bold focus:border-teal-500/50"
                        >
                          <option value="all">All statuses</option>
                          {Object.entries(TX_LOG_STATUS_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </Select>
                      </Field>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-stretch lg:gap-6">
                    <div className="grid min-w-0 grid-cols-1 gap-6 sm:grid-cols-2 lg:col-span-8">
                      <Field label="From">
                        <Input
                          type="date"
                          value={dateFrom}
                          onChange={(e) => setDateFrom(e.target.value)}
                          className="!h-12 w-full min-w-0 border-stone-200 focus:border-teal-500/50"
                        />
                      </Field>
                      <Field label="To">
                        <Input
                          type="date"
                          value={dateTo}
                          onChange={(e) => setDateTo(e.target.value)}
                          className="!h-12 w-full min-w-0 border-stone-200 focus:border-teal-500/50"
                        />
                      </Field>
                    </div>
                    <div className="flex min-w-0 w-full flex-col justify-end lg:col-span-4">
                      <Button
                        type="submit"
                        variant="secondary"
                        className="w-full !h-12 shrink-0 shadow-sm"
                      >
                        Apply filters
                      </Button>
                    </div>
                  </div>
                </form>

                <FilterChips
                  className="mt-6"
                  items={[
                    {
                      key: "q",
                      label: "Search",
                      value: appliedQuery,
                      onClear: () => {
                        setPage(1);
                        setFilterQuery("");
                        setAppliedQuery("");
                      },
                    },
                    {
                      key: "status",
                      label: "Status",
                      value: appliedStatus !== "all" ? TX_LOG_STATUS_LABELS[appliedStatus] || appliedStatus : "",
                      onClear: () => {
                        setPage(1);
                        setStatusFilter("all");
                        setAppliedStatus("all");
                      },
                    },
                    {
                      key: "from",
                      label: "From",
                      value: appliedFrom,
                      onClear: () => {
                        setPage(1);
                        setDateFrom("");
                        setAppliedFrom("");
                      },
                    },
                    {
                      key: "to",
                      label: "To",
                      value: appliedTo,
                      onClear: () => {
                        setPage(1);
                        setDateTo("");
                        setAppliedTo("");
                      },
                    },
                  ]}
                  onClearAll={() => {
                    setPage(1);
                    setFilterQuery("");
                    setStatusFilter("all");
                    setDateFrom("");
                    setDateTo("");
                    setAppliedQuery("");
                    setAppliedStatus("all");
                    setAppliedFrom("");
                    setAppliedTo("");
                  }}
                />
              </div>
            </Card>

            <Card className="mt-6 overflow-hidden rounded-2xl border-stone-200 !p-0 shadow-sm">
              <Table
                embedded
                caption="Process runs"
                ariaLabel="System workflows table"
                columns={[
                  {
                    key: "id",
                    label: "Transaction log ID",
                    className: "w-[8.5rem]",
                    headerClassName: "!px-4",
                  },
                  { key: "ts", label: "Started at" },
                  { key: "tx", label: "Transaction" },
                  { key: "user", label: "Initiated by" },
                  { key: "status", label: "Status" },
                  { key: "correlation", label: correlationColumnLabel(), className: "min-w-[7rem]" },
                  { key: "ref", label: "Reference", className: "text-right" },
                ]}
                rows={filteredLogs.map((log) => (
                  <tr
                    key={log.tx_log_id}
                    className="cursor-pointer border-t border-stone-100 transition-colors hover:bg-stone-50"
                    onClick={() => setSelectedLog(log)}
                  >
                    <td className="px-4 py-4 align-middle">
                      <span className="font-mono text-[10px] font-bold uppercase tracking-tighter text-stone-400 tabular-nums">
                        #TX-{log.tx_log_id}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-[11px] tabular-nums text-stone-600">
                      {formatLogTimestamp(log.started_at)}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-bold text-stone-900">{formatTxName(log.tx_name)}</span>
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-stone-500">
                      {log.user_username || "System"}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge size="sm">{log.status}</StatusBadge>
                    </td>
                    <td className="px-6 py-4 align-middle">
                      <CorrelationIdCell value={log.correlation_id} />
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-[10px] tracking-tighter text-stone-400">
                      {`${log.reference_entity ?? ""} ${log.reference_id != null ? `#${log.reference_id}` : ""}`.trim() ||
                        "—"}
                    </td>
                  </tr>
                ))}
                emptyTitle="No transaction logs found"
                emptyDescription={
                  appliedQuery || appliedStatus !== "all" || appliedFrom || appliedTo
                    ? "No rows match the current filters."
                    : "Runs appear here when staff use billing, contracts, payments, and related actions."
                }
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
          </>
        )}
      </motion.div>

      {selectedLog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 backdrop-blur-sm bg-stone-900/20" role="dialog" aria-modal="true">
          <button type="button" className="absolute inset-0" aria-label="Close" onClick={() => setSelectedLog(null)} />
          <motion.div 
            ref={modalRef}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between border-b border-stone-100 bg-stone-50/50 px-8 py-6">
              <div>
                <h2 className="text-sm font-black uppercase tracking-widest text-stone-900">Run detail</h2>
                <div className="flex items-center gap-2 mt-1">
                    <p className="font-mono text-[10px] font-black tracking-tighter text-stone-400 uppercase">
                        Log #{selectedLog.tx_log_id} · {formatLogTimestamp(selectedLog.started_at)}
                    </p>
                    {selectedLog.completed_at && (
                        <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${selectedLog.status === 'failed' ? 'bg-rose-50 text-rose-600' : 'bg-teal-50 text-teal-600'}`}>
                            {formatDuration(selectedLog.started_at, selectedLog.completed_at)}
                        </span>
                    )}
                </div>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-500 hover:bg-stone-50"
              >
                <X size={18} />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto p-8">
              <div className="grid gap-8 sm:grid-cols-2 mb-10">
                  <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Process</span>
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                            <Activity size={20} />
                        </div>
                        <p className="text-lg font-black text-stone-900 leading-tight">{formatTxName(selectedLog.tx_name)}</p>
                      </div>
                  </div>
                  <div className="space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Status</span>
                      <div>
                        <StatusBadge>{selectedLog.status}</StatusBadge>
                      </div>
                  </div>
              </div>

              <div className="space-y-4 mb-10">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-stone-500">Times &amp; reference</h3>
                <div className="rounded-2xl border border-stone-100 bg-stone-50/50 p-6 space-y-4 shadow-inner">
                    <div className="flex justify-between items-center text-xs">
                        <span className="text-stone-400 font-bold uppercase tracking-wider">Started</span>
                        <span className="text-stone-900 font-mono font-bold tabular-nums">{formatLogTimestamp(selectedLog.started_at)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                        <span className="text-stone-400 font-bold uppercase tracking-wider">Completed</span>
                        <span className="text-stone-900 font-mono font-bold tabular-nums">{formatLogTimestamp(selectedLog.completed_at)}</span>
                    </div>
                    <div className="pt-4 border-t border-stone-200/50 flex justify-between items-center text-xs">
                        <span className="text-stone-400 font-bold uppercase tracking-wider">Reference</span>
                        <span className="text-teal-700 font-black px-2 py-1 bg-teal-100/50 rounded-lg text-[9px] tracking-widest uppercase">
                            {formatEntity(selectedLog.reference_entity)} #{selectedLog.reference_id}
                        </span>
                    </div>
                    <div className="pt-4 border-t border-stone-200/50 space-y-2">
                        <span className="text-stone-400 font-bold uppercase tracking-wider text-xs">Correlation ID</span>
                        <div className="rounded-xl border border-stone-100 bg-white px-3 py-2">
                          <CorrelationIdCell value={selectedLog.correlation_id} preferFull />
                        </div>
                    </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-stone-500">Details (JSON)</h3>
                    <span className="bg-stone-100 px-2 py-0.5 rounded text-[9px] font-bold text-stone-400 uppercase tracking-widest font-mono">application/json</span>
                </div>
                <div className="relative group">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-teal-500 to-emerald-500 rounded-2xl blur opacity-10 group-hover:opacity-20 transition duration-500"></div>
                    <pre className="relative max-h-80 overflow-y-auto rounded-2xl bg-stone-900 p-6 font-mono text-[11px] leading-relaxed text-emerald-400 shadow-2xl border border-white/5 HS-scrollbar">
                      {selectedLog.details_json ? JSON.stringify(safeParseJson(selectedLog.details_json), null, 2) : "// No details recorded"}
                    </pre>
                </div>
              </div>
            </div>

            <div className="px-8 py-6 bg-stone-50/50 border-t border-stone-100 flex justify-end">
              <Button variant="secondary" onClick={() => setSelectedLog(null)} className="rounded-xl !h-11 px-8 font-black text-[10px] uppercase tracking-widest border-stone-200">
                Close
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AppMain>
  );
}
