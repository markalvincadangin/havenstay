"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Activity, Search, X, Terminal, ListFilter, ExternalLink } from "lucide-react";
import useSWR from "swr";
import { fetcher } from "../../lib/api";
import { canManageUsers } from "../../lib/auth";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { useTableSort } from "../../hooks/useTableSort";
import { sortClientRows } from "../../lib/tableSort";
import { formatTimestamp, safeParseJson } from "../../lib/formatters";
import Alert from "../_components/ui/Alert";
import Breadcrumbs from "../_components/ui/Breadcrumbs";
import Button from "../_components/ui/Button";
import { Card } from "../_components/ui/Card";
import { Field, Input, Select } from "../_components/ui/Fields";
import FilterChips from "../_components/ui/FilterChips";
import UserRoleBadge from "../_components/ui/UserRoleBadge";
import { Table } from "../_components/ui/Table";
import { StatusBadge } from "../_components/ui/StatusBadge";
import { KpiCard } from "../_components/ui/KpiCard";
import { CorrelationIdCell } from "../_components/ui/CorrelationIdCell";
import { TX_LOG_STATUS_LABELS } from "../../lib/constants";
import {
  buildPaginationQuery,
  normalizePaginatedList,
  readStoredPerPage,
} from "../../lib/pagination";
import ResourceView from "../_components/ui/ResourceView";
import TablePagination from "../_components/ui/TablePagination";
import StandardPage from "../_components/ui/StandardPage";
import ResourceIdCell from "../_components/ui/ResourceIdCell";
import { useAuth } from "../_context/AuthContext";

function formatTxName(name) {
  if (!name) return "—";
  return name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function TransactionLogsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user: currentUser } = useAuth();

  const [filterQuery, setFilterQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const urlCorrelation = searchParams.get("correlation");
  const [correlationFilter, setCorrelationFilter] = useState(urlCorrelation || "");
  const [appliedCorrelation, setAppliedCorrelation] = useState(urlCorrelation || "");

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [appliedQuery, setAppliedQuery] = useState("");
  const [appliedStatus, setAppliedStatus] = useState("all");
  const [appliedFrom, setAppliedFrom] = useState("");
  const [appliedTo, setAppliedTo] = useState("");

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(() => readStoredPerPage());

  const [selectedLog, setSelectedLog] = useState(null);
  const modalRef = useFocusTrap(!!selectedLog);

  const { sortColumn, sortDirection, onSortChange } = useTableSort();

  const canAccess = useMemo(() => canManageUsers(currentUser), [currentUser]);

  const qs = useMemo(() => {
    const extra = {};
    if (appliedQuery) extra.q = appliedQuery;
    if (appliedStatus !== "all") extra.status = appliedStatus;
    if (appliedCorrelation) extra.correlation_id = appliedCorrelation;
    if (appliedFrom) extra.from = appliedFrom;
    if (appliedTo) extra.to = appliedTo;
    return buildPaginationQuery(page, perPage, extra);
  }, [page, perPage, appliedQuery, appliedStatus, appliedCorrelation, appliedFrom, appliedTo]);

  const { data: logData, error: logError, isValidating: isSyncing, mutate: refetchLogs } = useSWR(
    currentUser && canAccess ? `/api/transaction-logs${qs}` : null,
    fetcher,
    { keepPreviousData: true, dedupingInterval: 30000 }
  );

  const { rows: logs = [], meta: listMeta = null } = useMemo(() => {
    if (!logData) return { rows: [], meta: null };
    return normalizePaginatedList(logData);
  }, [logData]);

  const loading = !logData && !logError;

  const stats = useMemo(() => {
    return {
      total: listMeta?.total ?? 0,
      committed: listMeta?.committed_count ?? 0,
      failed: listMeta?.failed_count ?? 0,
      rolled_back: listMeta?.rolled_back_count ?? 0,
    };
  }, [listMeta]);

  const sortedRows = useMemo(() => {
    if (!sortColumn) return logs;
    return sortClientRows(logs, sortColumn, sortDirection, (log) => {
      switch (sortColumn) {
        case "id": return Number(log.id) || 0;
        case "ts": return log.created_at || "";
        case "tx": return (log.action || "").toLowerCase();
        default: return "";
      }
    });
  }, [logs, sortColumn, sortDirection]);

  return (
    <StandardPage
      title="Transaction logs"
      subtitle="System administration: monitor workflow process lifecycle and database transaction safety."
      breadcrumbs={<Breadcrumbs items={[{ label: "System Administration" }, { label: "Transaction Logs" }]} />}
      loading={loading}
      error={logError}
      actions={
        <div className="flex flex-wrap items-center justify-end gap-3">
          <Link
            href="/audit-logs"
            className="inline-flex h-11 items-center rounded-xl border border-stone-200 bg-white px-4 text-[10px] font-bold uppercase tracking-widest text-stone-600 transition-colors hover:border-teal-300 hover:text-teal-700"
          >
            Audit Trail →
          </Link>
          <div className="border-l border-stone-200 pl-3">
            <UserRoleBadge username={currentUser?.username} roleName={currentUser?.role?.role_name} />
          </div>
        </div>
      }
    >
      {!canAccess ? (
        <Alert variant="warning" title="Access denied">
          Only administrators can view transaction logs.
        </Alert>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="Runs after filters"
              value={stats.total}
              icon={Terminal}
              sub="Matching record count"
              isSyncing={isSyncing}
            />
            <KpiCard
              label="Committed"
              value={stats.committed}
              progress={stats.total > 0 ? (stats.committed / stats.total) * 100 : 0}
              sub="Successful state transitions"
              isSyncing={isSyncing}
            />
            <KpiCard
              label="Failed"
              value={stats.failed}
              isDanger={stats.failed > 0}
              sub="Logic or validation errors"
              isSyncing={isSyncing}
            />
            <KpiCard
              label="Rolled Back"
              value={stats.rolled_back}
              isDanger={stats.rolled_back > 0}
              sub="Database safety reverts"
              isSyncing={isSyncing}
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
                    Cross-link to Audit Trail using Correlation IDs to trace row changes.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                onClick={() => refetchLogs()}
                disabled={isSyncing}
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
                  setAppliedCorrelation(correlationFilter.trim());
                  setAppliedFrom(dateFrom);
                  setAppliedTo(dateTo);
                }}
              >
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-12 lg:gap-6">
                  <div className="min-w-0 lg:col-span-6">
                    <Field
                      label="Search"
                      helpText="Matches process name, actor username, or reference code."
                    >
                      <div className="group relative">
                        <Search
                          className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-stone-400 transition-colors group-focus-within:text-teal-600"
                          aria-hidden
                        />
                        <Input
                          placeholder="Process, actor, or reference…"
                          value={filterQuery}
                          onChange={(e) => setFilterQuery(e.target.value)}
                          className="!h-12 w-full min-w-0 border-stone-200 pl-11 font-medium transition-[border-color,box-shadow] focus:border-teal-500/50 focus:ring-4 focus:ring-teal-500/5"
                        />
                      </div>
                    </Field>
                  </div>
                  <div className="min-w-0 lg:col-span-3">
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
                  <div className="min-w-0 lg:col-span-3">
                    <Field label="Correlation ID" helpText="Cross-link to Audit Trail">
                      <Input
                        placeholder="UUID or partial…"
                        value={correlationFilter}
                        onChange={(e) => setCorrelationFilter(e.target.value)}
                        className="!h-12 w-full min-w-0 border-stone-200 font-mono text-[11px] focus:border-teal-500/50"
                      />
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
                    key: "correlation",
                    label: "Correlation",
                    value: appliedCorrelation,
                    onClear: () => {
                      setPage(1);
                      setCorrelationFilter("");
                      setAppliedCorrelation("");
                      if (searchParams.get("correlation")) {
                        router.replace("/transaction-logs");
                      }
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
                  setCorrelationFilter("");
                  setDateFrom("");
                  setDateTo("");
                  setAppliedQuery("");
                  setAppliedStatus("all");
                  setAppliedCorrelation("");
                  setAppliedFrom("");
                  setAppliedTo("");
                  router.replace("/transaction-logs");
                }}
              />
            </div>
          </Card>

          <ResourceView
            isLoading={loading}
            isSyncing={isSyncing}
            error={logError}
            isEmpty={logs.length === 0}
            onRetry={() => refetchLogs()}
            emptyProps={{
              title: "No transaction logs found",
              message: "Runs appear here when critical business events like payments or check-ins occur."
            }}
          >
            <Card className="mt-6 overflow-hidden rounded-2xl border-stone-200 !p-0 shadow-sm">
              <Table
                embedded
                caption="Sequential business process records"
                sortColumn={sortColumn}
                sortDirection={sortDirection}
                onSortChange={onSortChange}
                columns={[
                  { key: "id", label: "TX ID", sortable: true, sortKey: "id", className: "w-[8.5rem]", headerClassName: "!px-4" },
                  { key: "ts", label: "Timestamp", sortable: true, sortKey: "ts" },
                  { key: "tx", label: "Action", sortable: true, sortKey: "tx" },
                  { key: "user", label: "Actor" },
                  { key: "status", label: "Status" },
                  { key: "correlation", label: "Correlation" },
                  { key: "ref", label: "Reference", className: "text-right" },
                ]}
                rows={sortedRows.map((log) => (
                  <tr
                    key={log.id}
                    className="cursor-pointer border-t border-stone-100 transition-colors hover:bg-stone-50"
                    onClick={() => setSelectedLog(log)}
                  >
                    <td className="px-4 py-4 align-middle">
                      <ResourceIdCell id={log.id} prefix="TX" />
                    </td>
                    <td className="px-6 py-4 font-mono text-[11px] tabular-nums text-stone-600">
                      {formatTimestamp(log.created_at)}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-bold text-stone-900">{formatTxName(log.action)}</span>
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-stone-500">
                      {log.user_username || "System"}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge size="sm">{log.status}</StatusBadge>
                    </td>
                    <td className="px-6 py-4">
                      <CorrelationIdCell value={log.correlation_id} variant="teal" />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-mono text-[10px] uppercase tracking-tighter text-stone-400">
                        {log.txn_reference || "—"}
                      </span>
                    </td>
                  </tr>
                ))}
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
          </ResourceView>
        </>
      )}

      {selectedLog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 backdrop-blur-sm bg-stone-900/20" role="dialog" aria-modal="true">
          <button type="button" className="absolute inset-0" aria-label="Close" onClick={() => setSelectedLog(null)} />
          <div 
            ref={modalRef}
            className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between border-b border-stone-100 bg-stone-50/50 px-8 py-6">
              <div>
                <h2 className="text-sm font-black uppercase tracking-widest text-stone-900">Run detail</h2>
                <div className="flex items-center gap-2 mt-1">
                    <p className="font-mono text-[10px] font-black tracking-tighter text-stone-400 uppercase">
                        Log #{selectedLog.id} · {formatTimestamp(selectedLog.created_at)}
                    </p>
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
                        <p className="text-lg font-black text-stone-900 leading-tight">{formatTxName(selectedLog.action)}</p>
                      </div>
                  </div>
                  <div className="space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Status</span>
                      <div>
                        <StatusBadge>{selectedLog.status}</StatusBadge>
                      </div>
                  </div>
              </div>

              {selectedLog.error_message && (
                <div className="mb-10 animate-in fade-in slide-in-from-top-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-rose-400">Failure reason</span>
                  <div className="mt-2 rounded-2xl border border-rose-100 bg-rose-50 p-4 font-mono text-xs font-bold text-rose-600 shadow-sm">
                    {selectedLog.error_message}
                  </div>
                </div>
              )}

              <div className="space-y-4 mb-10">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-stone-500">Correlation & Linkage</h3>
                <div className="rounded-2xl border border-stone-100 bg-stone-50/50 p-6 space-y-4 shadow-inner">
                   <div className="space-y-3">
                      <div className="flex items-center justify-between">
                         <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Correlation ID</span>
                         <span className="text-[10px] font-mono text-stone-400 tabular-nums uppercase">UUID v4</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <CorrelationIdCell value={selectedLog.correlation_id} preferFull variant="teal" className="flex-1" />
                        {selectedLog.correlation_id && (
                          <Link
                            href={`/audit-logs?correlation=${selectedLog.correlation_id}`}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-3 py-1.5 text-[10px] font-bold text-teal-700 transition-colors hover:bg-teal-100"
                          >
                            <ExternalLink size={12} />
                            <span>See in Audit Trail →</span>
                          </Link>
                        )}
                      </div>
                   </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-stone-500">Process Details</h3>
                    <span className="bg-stone-100 px-2 py-0.5 rounded text-[9px] font-bold text-stone-400 uppercase tracking-widest font-mono">application/json</span>
                </div>
                <div className="relative group">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-teal-500 to-emerald-500 rounded-2xl blur opacity-10 group-hover:opacity-20 transition duration-500"></div>
                    <pre className="relative max-h-80 overflow-y-auto rounded-2xl bg-stone-900 p-6 font-mono text-[11px] leading-relaxed text-emerald-400 shadow-2xl border border-white/5 HS-scrollbar">
                      {selectedLog.details ? JSON.stringify(safeParseJson(selectedLog.details), null, 2) : "// No details recorded"}
                    </pre>
                </div>
              </div>
            </div>

            <div className="px-8 py-6 bg-stone-50/50 border-t border-stone-100 flex justify-end">
              <Button variant="secondary" onClick={() => setSelectedLog(null)} className="rounded-xl !h-11 px-8 font-black text-[10px] uppercase tracking-widest border-stone-200">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </StandardPage>
  );
}
