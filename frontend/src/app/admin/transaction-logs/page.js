"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Activity, Search, X, Terminal, ListFilter, ExternalLink } from "lucide-react";
import useSWR from "swr";
import { fetcher } from "../../../lib/api";
import { canManageUsers } from "../../../lib/auth";
import { useFocusTrap } from "../../../hooks/useFocusTrap";
import { useTableSort } from "../../../hooks/useTableSort";
import { sortClientRows } from "../../../lib/tableSort";
import { formatTimestamp, safeParseJson } from "../../../lib/formatters";
import Alert from "../../_components/ui/Alert";
import Breadcrumbs from "../../_components/ui/Breadcrumbs";
import Button from "../../_components/ui/Button";
import { Card } from "../../_components/ui/Card";
import FilterPanelCard from "../../_components/ui/FilterPanelCard";
import { Field, Input, Select } from "../../_components/ui/Fields";
import FilterChips from "../../_components/ui/FilterChips";
import UserRoleBadge from "../../_components/ui/UserRoleBadge";
import { Table } from "../../_components/ui/Table";
import { StatusBadge } from "../../_components/ui/StatusBadge";
import { KpiCard } from "../../_components/ui/KpiCard";
import { CorrelationIdCell } from "../../_components/ui/CorrelationIdCell";
import { TX_LOG_STATUS_LABELS } from "../../../lib/constants";
import {
  buildPaginationQuery,
  normalizePaginatedList,
  readStoredPerPage,
} from "../../../lib/pagination";
import ResourceView from "../../_components/ui/ResourceView";
import TablePagination from "../../_components/ui/TablePagination";
import StandardPage from "../../_components/ui/StandardPage";
import ResourceIdCell from "../../_components/ui/ResourceIdCell";
import { useAuth } from "../../_context/AuthContext";
import { usePaginatedFilters } from "../../../hooks/usePaginatedFilters";

function formatTxName(name) {
  if (!name) return "—";
  return name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function TransactionLogsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user: currentUser } = useAuth();

  const [logsReady, setLogsReady] = useState(false);
  const [apiError, setApiError] = useState("");
  const urlCorrelation = searchParams.get("correlation") || "";

  const {
    filters,
    updateFilter,
    resetFilters,
    page,
    setPage,
    perPage,
    setPerPage,
    queryString: qs,
  } = usePaginatedFilters({
    initialFilters: {
      q: "",
      status: "all",
      correlation_id: urlCorrelation,
      from: "",
      to: "",
    },
    debounceKeys: ["q", "correlation_id"],
    buildExtraParams: ({ filters: f, debounced }) => {
      const extra = {};
      if (debounced.q?.trim()) extra.q = debounced.q.trim();
      if (f.status !== "all") extra.status = f.status;
      if (debounced.correlation_id?.trim()) extra.correlation_id = debounced.correlation_id.trim();
      if (f.from) extra.from = f.from;
      if (f.to) extra.to = f.to;
      return extra;
    },
  });

  const { q: filterQuery, status: statusFilter, correlation_id: correlationFilter, from: dateFrom, to: dateTo } = filters;

  const [selectedLog, setSelectedLog] = useState(null);
  const modalRef = useFocusTrap(!!selectedLog);

  const { sortColumn, sortDirection, onSortChange } = useTableSort();

  const canAccess = useMemo(() => canManageUsers(currentUser), [currentUser]);

  const { data: logData, error: logError, isValidating: isSyncing, mutate: refetchLogs } = useSWR(
    currentUser && canAccess ? `/api/transaction-logs${qs}` : null,
    fetcher,
    { keepPreviousData: true, dedupingInterval: 30000 }
  );

  useEffect(() => {
    if (logError) {
      setApiError(flattenApiErrors(logError));
    }
  }, [logError]);

  useEffect(() => {
    if (logData) {
      setLogsReady(true);
    }
  }, [logData]);

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
      subtitle="PROCESS LIFECYCLE MONITORING AND DATABASE TRANSACTION SAFETY"
      breadcrumbs={<Breadcrumbs items={[{ label: "System Administration" }, { label: "Transaction Logs" }]} />}
      loading={loading}
      error={logError}
      actions={
        <div className="flex flex-wrap items-center justify-end gap-3">
          <Link
            href="/admin/audit-logs"
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
              label="FILTERED RUNS"
              value={stats.total}
              icon={Terminal}
              sub="MATCHING PROCESS COUNT"
              isSyncing={isSyncing}
            />
            <KpiCard
              label="COMMITTED"
              value={stats.committed}
              progress={stats.total > 0 ? (stats.committed / stats.total) * 100 : 0}
              sub="SUCCESSFUL TRANSITIONS"
              isSyncing={isSyncing}
            />
            <KpiCard
              label="FAILED EXECUTIONS"
              value={stats.failed}
              isDanger={stats.failed > 0}
              sub="VALIDATION FAILURES"
              isSyncing={isSyncing}
            />
            <KpiCard
              label="ROLLED BACK"
              value={stats.rolled_back}
              isWarning={stats.rolled_back > 0}
              sub="DATABASE REVERSIONS"
              isSyncing={isSyncing}
            />
          </div>

          <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
            <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/50 px-6 py-4 sm:px-8 sm:py-5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-stone-100 text-stone-600">
                  <ListFilter size={14} aria-hidden />
                </div>
                <h2 className="hs-strip-title text-stone-400 tracking-widest uppercase font-black text-[10px]">
                  Filters
                </h2>
              </div>
              <Button
                type="button"
                variant="ghost"
                onClick={() => { resetFilters(); refetchLogs(); }}
                className="!h-8 px-3 text-[10px] font-black uppercase tracking-widest text-stone-400 hover:text-teal-600 border border-stone-200 rounded-lg bg-white"
              >
                Reset & Refresh
              </Button>
            </div>
            <div className="p-8">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-12 lg:gap-6">
                <div className="min-w-0 lg:col-span-6">
                  <Field
                    label="Search Registry"
                    helpText="Matches process name, actor identity, or reference."
                  >
                    <div className="group relative">
                      <Search
                        className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-stone-400 transition-colors group-focus-within:text-teal-600"
                        aria-hidden
                      />
                      <Input
                        placeholder="Process name, actor, or code…"
                        value={filterQuery}
                        onChange={(e) => updateFilter("q", e.target.value)}
                        className="!h-12 w-full min-w-0 border-stone-200 pl-11 font-medium transition-[border-color,box-shadow] focus:border-teal-500/50 focus:ring-4 focus:ring-teal-500/5"
                      />
                    </div>
                  </Field>
                </div>
                <div className="min-w-0 lg:col-span-3">
                  <Field label="Execution Status">
                    <Select
                      value={statusFilter}
                      onChange={(e) => updateFilter("status", e.target.value)}
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
                  <Field label="Correlation ID" helpText="Cross-link to Audit Registry">
                    <Input
                      placeholder="UUID or partial…"
                      value={correlationFilter}
                      onChange={(e) => updateFilter("correlation_id", e.target.value)}
                      className="!h-12 w-full min-w-0 border-stone-200 font-mono text-[11px] font-bold focus:border-teal-500/50"
                    />
                  </Field>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-center">
                <div className="grid min-w-0 grid-cols-1 gap-6 sm:grid-cols-2 lg:col-span-8">
                  <Field label="Chronological Start">
                    <Input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => updateFilter("from", e.target.value)}
                      className="!h-12 w-full min-w-0 border-stone-200 font-bold focus:border-teal-500/50"
                    />
                  </Field>
                  <Field label="Chronological End">
                    <Input
                      type="date"
                      value={dateTo}
                      onChange={(e) => updateFilter("to", e.target.value)}
                      className="!h-12 w-full min-w-0 border-stone-200 font-bold focus:border-teal-500/50"
                    />
                  </Field>
                </div>
              </div>

              <FilterChips
                className="mt-6"
                items={[
                  {
                    key: "q",
                    label: "Search",
                    value: filterQuery,
                    onClear: () => updateFilter("q", ""),
                  },
                  {
                    key: "status",
                    label: "Status",
                    value: statusFilter !== "all" ? TX_LOG_STATUS_LABELS[statusFilter] || statusFilter : "",
                    onClear: () => updateFilter("status", "all"),
                  },
                  {
                    key: "correlation",
                    label: "Correlation",
                    value: correlationFilter,
                    onClear: () => updateFilter("correlation_id", ""),
                  },
                  {
                    key: "from",
                    label: "From",
                    value: dateFrom,
                    onClear: () => updateFilter("from", ""),
                  },
                  {
                    key: "to",
                    label: "To",
                    value: dateTo,
                    onClear: () => updateFilter("to", ""),
                  },
                ]}
                onClearAll={resetFilters}
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
              title: "No transaction records",
              message: "Runs appear here when critical business events like payments or check-ins occur."
            }}
          >
            <Card className="mt-6 overflow-hidden rounded-2xl border-stone-200 !p-0 shadow-sm">
              <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/50 px-8 py-4">
                <h2 className="hs-strip-title uppercase tracking-[0.2em] text-[10px] font-black text-stone-400">Process Registry</h2>
                <div className="text-[10px] font-mono font-bold text-stone-400 uppercase tracking-widest leading-none">
                  {listMeta?.total ?? stats.total} runs logged
                </div>
              </div>
              <Table
                embedded
                sortColumn={sortColumn}
                sortDirection={sortDirection}
                onSortChange={onSortChange}
                columns={[
                  { key: "id", label: "ID", sortable: true, sortKey: "id", className: "pl-8 w-32", headerClassName: "hs-strip-title" },
                  { key: "ts", label: "TIMESTAMP", sortable: true, sortKey: "ts", className: "w-48 text-center", headerClassName: "hs-strip-title" },
                  { key: "tx", label: "ACTION", sortable: true, sortKey: "tx", className: "w-48 text-center", headerClassName: "hs-strip-title" },
                  { key: "user", label: "ACTOR", className: "w-40", headerClassName: "hs-strip-title" },
                  { key: "status", label: "STATUS", className: "w-32 text-center", headerClassName: "hs-strip-title" },
                  { key: "correlation", label: "CORRELATION", className: "w-40", headerClassName: "hs-strip-title" },
                  { key: "ref", label: "REF", className: "text-right px-8 w-24", headerClassName: "hs-strip-title" },
                ]}
                rows={sortedRows.map((log) => (
                  <tr
                    key={log.id}
                    className="cursor-pointer border-t border-stone-50 transition-colors hover:bg-stone-50/50 group"
                    onClick={() => setSelectedLog(log)}
                  >
                    <td className="px-8 py-5">
                      <ResourceIdCell id={log.id} prefix="TX" />
                    </td>
                    <td className="py-5 font-mono text-[10px] font-black uppercase tracking-tight text-stone-600 text-center tabular-nums">
                      {formatTimestamp(log.created_at)}
                    </td>
                    <td className="py-5 text-center">
                      <span className="text-sm font-bold text-stone-900 group-hover:text-teal-700 transition-colors leading-tight">{formatTxName(log.action)}</span>
                    </td>
                    <td className="py-5 text-xs font-bold text-stone-500">
                      {log.user_username || "System"}
                    </td>
                    <td className="py-5 text-center">
                      <StatusBadge size="xs" variant="pastel">{log.status}</StatusBadge>
                    </td>
                    <td className="py-5">
                      <CorrelationIdCell value={log.correlation_id} variant="teal" />
                    </td>
                    <td className="px-8 py-5 text-right">
                      <span className="font-mono text-[10px] font-black uppercase tracking-tighter text-stone-300">
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
                    Log #{selectedLog.id} · <span className="tabular-nums">{formatTimestamp(selectedLog.created_at)}</span>
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
                            href={`/admin/audit-logs?correlation=${selectedLog.correlation_id}`}
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
                    <h3 className="hs-strip-title">Raw Data</h3>
                    <span className="bg-stone-50 px-2 py-0.5 rounded text-[9px] font-bold text-stone-400 uppercase tracking-widest font-mono border border-stone-100">application/json</span>
                </div>
                <div className="relative group">
                    <div className="absolute -inset-0.5 bg-stone-100 rounded-2xl opacity-10 group-hover:opacity-20 transition duration-500"></div>
                    <pre className="relative max-h-80 overflow-y-auto rounded-2xl bg-stone-50 border border-stone-100 p-6 font-mono text-[10px] leading-relaxed text-stone-500 shadow-inner HS-scrollbar">
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
