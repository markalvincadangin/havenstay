"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Search, X, Activity, ShieldAlert, Database, Download, ListFilter, ExternalLink } from "lucide-react";
import { fetcher } from "../../../lib/api";
import useSWR from "swr";
import { downloadCsvWithAuth } from "../../../lib/downloads";
import { canManageUsers } from "../../../lib/auth";
import { flattenApiErrors } from "../../../lib/errors";
import { useFocusTrap } from "../../../hooks/useFocusTrap";
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
import StandardPage from "../../_components/ui/StandardPage";
import ResourceIdCell from "../../_components/ui/ResourceIdCell";
import {
  AUDIT_ACTION_LABELS,
  AUDIT_ENTITY_FILTER_KEYS,
  AUDIT_ENTITY_LABELS,
  formatAuditEntityIdDisplay,
  formatAuditEntityOrResource,
} from "../../../lib/constants";
import { buildPaginationQuery, normalizePaginatedList, readStoredPerPage } from "../../../lib/pagination";
import ResourceView from "../../_components/ui/ResourceView";
import TablePagination from "../../_components/ui/TablePagination";
import { useAuth } from "../../_context/AuthContext";
import { usePaginatedFilters } from "../../../hooks/usePaginatedFilters";

/** Humanize technical database field names */
const FIELD_LABELS = {
  first_name: "First Name",
  last_name: "Last Name",
  contact_number: "Phone Number",
  status: "Status",
  role_id: "Role ID",
  is_active: "Active Status",
  monthly_rate: "Monthly Rate",
  expected_move_out_date: "Expected Move-out",
  due_date: "Due Date",
  bed_label: "Bed Label",
  room_code: "Room Code",
  deposit_amount: "Deposit",
};

function formatFieldLabel(field) {
  if (!field) return "—";
  return FIELD_LABELS[field] ?? field.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Query string for CSV export (matches GET /api/audit-logs/export). */
function buildAuditQueryParams(filters) {
  const params = new URLSearchParams();
  if (filters?.entityType && filters.entityType !== "all") params.set("entity_type", filters.entityType);
  if (filters?.actionType && filters.actionType !== "all") params.set("action", filters.actionType);
  if (filters?.dateFrom) params.set("from", filters.dateFrom);
  if (filters?.dateTo) params.set("to", filters.dateTo);
  if (filters?.searchQuery?.trim()) params.set("q", filters.searchQuery.trim());
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

function auditListExtra(filters) {
  const extra = {};
  if (filters?.entityType && filters.entityType !== "all") extra.entity_type = filters.entityType;
  if (filters?.actionType && filters.actionType !== "all") extra.action = filters.actionType;
  if (filters?.dateFrom) extra.from = filters.dateFrom;
  if (filters?.dateTo) extra.to = filters.dateTo;
  if (filters?.searchQuery?.trim()) extra.q = filters.searchQuery.trim();
  return extra;
}

function buildDiffLines(oldValues, newValues, action) {
  const oldObj = safeParseJson(oldValues);
  const newObj = safeParseJson(newValues);

  if (!oldObj && !newObj) return [];

  if (action === "create" && newObj) {
    return Object.entries(newObj).map(([key, value]) => ({
      field: key,
      before: "—",
      after: value === null ? "null" : JSON.stringify(value),
    }));
  }

  if (action === "delete" && oldObj) {
    return Object.entries(oldObj).map(([key, value]) => ({
      field: key,
      before: value === null ? "null" : JSON.stringify(value),
      after: "—",
    }));
  }

  if (!oldObj || !newObj || typeof oldObj !== "object" || typeof newObj !== "object") return [];

  const keys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);
  const lines = [];
  for (const key of keys) {
    const before = oldObj[key];
    const after = newObj[key];
    const beforeStr = before === undefined || before === null ? (before === null ? "null" : "—") : JSON.stringify(before);
    const afterStr = after === undefined || after === null ? (after === null ? "null" : "—") : JSON.stringify(after);
    if (beforeStr !== afterStr) {
      lines.push({ field: key, before: beforeStr, after: afterStr });
    }
  }
  return lines;
}

export default function AuditLogsPage() {
  const searchParams = useSearchParams();
  const { user: currentUser } = useAuth();
  const initialSearch = searchParams.get("correlation") || searchParams.get("q") || "";

  const {
    filters,
    updateFilter,
    resetFilters,
    page: auditPage,
    setPage: setAuditPage,
    perPage: auditPerPage,
    setPerPage: setAuditPerPage,
    queryString: auditQs,
  } = usePaginatedFilters({
    initialFilters: {
      entityType: "all",
      actionType: "all",
      dateFrom: "",
      dateTo: "",
      q: initialSearch,
    },
    debounceKeys: ["q"],
    buildExtraParams: ({ filters: f, debounced }) => {
      const extra = {};
      if (f.entityType !== "all") extra.entity_type = f.entityType;
      if (f.actionType !== "all") extra.action = f.actionType;
      if (f.dateFrom) extra.from = f.dateFrom;
      if (f.dateTo) extra.to = f.dateTo;
      if (debounced.q?.trim()) extra.q = debounced.q.trim();
      return extra;
    },
  });

  const { entityType, actionType, dateFrom, dateTo, q: searchQuery } = filters;

  const canAccess = useMemo(() => canManageUsers(currentUser), [currentUser]);

  const [logsReady, setLogsReady] = useState(false);
  const [apiError, setApiError] = useState("");
  const [exportingCsv, setExportingCsv] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const modalRef = useFocusTrap(!!selectedLog);

  const diffLines = useMemo(() => {
    if (!selectedLog) return [];
    return buildDiffLines(selectedLog.old_value, selectedLog.new_value, selectedLog.action);
  }, [selectedLog]);

  useEffect(() => {
    if (!selectedLog) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") setSelectedLog(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedLog]);

  const { data: auditData, error: auditError, mutate, isValidating } = useSWR(
    currentUser && canAccess ? `/api/audit-logs${auditQs}` : null,
    fetcher,
    { keepPreviousData: true, dedupingInterval: 30000 }
  );

  useEffect(() => {
    if (auditError) {
      setApiError(flattenApiErrors(auditError));
    }
  }, [auditError]);

  useEffect(() => {
    if (auditData) {
      setLogsReady(true);
    }
  }, [auditData]);

  const { rows: logs = [], meta: auditMeta = null } = useMemo(() => {
    if (!auditData) return { rows: [], meta: null };
    return normalizePaginatedList(auditData);
  }, [auditData]);

  const onExportCsv = useCallback(async () => {
    setApiError("");
    setExportingCsv(true);
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      const q = buildAuditQueryParams({ entityType, actionType, dateFrom, dateTo, searchQuery });
      await downloadCsvWithAuth(`/api/audit-logs/export${q}`, `audit-logs-${stamp}.csv`);
    } catch (error) {
      setApiError(flattenApiErrors(error));
    } finally {
      setExportingCsv(false);
    }
  }, [entityType, actionType, dateFrom, dateTo, searchQuery]);

  const loading = !logsReady && !apiError;

  return (
    <StandardPage
      title="Audit Trail"
      subtitle="FORENSIC ACTIVITY LEDGER AND TRACEABILITY LOGS"
      breadcrumbs={<Breadcrumbs items={[{ label: "System Administration" }, { label: "Audit Trail" }]} />}
      loading={loading}
      error={apiError}
      actions={
        <div className="flex flex-wrap items-center justify-end gap-3">
          <Link
            href="/admin/transaction-logs"
            className="inline-flex h-11 items-center rounded-xl border border-stone-200 bg-white px-4 text-[10px] font-bold uppercase tracking-widest text-stone-600 transition-colors hover:border-teal-300 hover:text-teal-700"
          >
            Transaction logs →
          </Link>
          <Button
            variant="primary"
            className="!h-11 rounded-xl px-6 text-[10px] font-bold uppercase tracking-widest"
            onClick={onExportCsv}
            disabled={exportingCsv}
            loading={exportingCsv}
          >
            <Download size={14} className="mr-2" />
            Export CSV
          </Button>
          <div className="border-l border-stone-200 pl-3">
            <UserRoleBadge username={currentUser?.username} roleName={currentUser?.role?.role_name} />
          </div>
        </div>
      }
    >
      {!canAccess ? (
        <Alert variant="warning" title="Access Denied">
          Only administrators can view the audit trail.
        </Alert>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <KpiCard
              label="FILTERED RECORDS"
              value={auditMeta?.total ?? logs.length}
              icon={Database}
              sub="TOTAL MATCHING EVENTS"
              isSyncing={isValidating}
            />
            <KpiCard
              label="ACCESS DENIED"
              value={auditMeta?.access_denied_total ?? 0}
              icon={ShieldAlert}
              isDanger={(auditMeta?.access_denied_total ?? 0) > 5}
              sub="SYSTEM REJECTION EVENTS"
              isSyncing={isValidating}
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
                      onClick={() => { resetFilters(); mutate(); }}
                      className="!h-8 px-3 text-[10px] font-black uppercase tracking-widest text-stone-400 hover:text-teal-600 border border-stone-200 rounded-lg bg-white"
                    >
                      Reset & Refresh
                    </Button>
                  </div>
                  <div className="p-8">
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-12 lg:gap-6">
                      <div className="min-w-0 md:col-span-2 lg:col-span-6">
                        <Field 
                          label="Search Registry"
                          helpText="Quick scan by Actor, Correlation, or Record ID."
                        >
                          <div className="group relative">
                            <Search
                              className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-stone-400 transition-colors group-focus-within:text-teal-600"
                              aria-hidden
                            />
                            <Input
                              value={searchQuery}
                              onChange={(e) => updateFilter("q", e.target.value)}
                              placeholder="Actor, Correlation, or ID…"
                              className="!h-12 w-full min-w-0 border-stone-200 pl-11 font-medium transition-[border-color,box-shadow] focus:border-teal-500/50 focus:ring-4 focus:ring-teal-500/5"
                            />
                          </div>
                        </Field>
                      </div>
                      <div className="min-w-0 lg:col-span-3">
                        <Field label="Event Category">
                          <Select
                            value={entityType}
                            onChange={(e) => updateFilter("entityType", e.target.value)}
                            className="!h-12 border-stone-200 font-bold focus:border-teal-500/50"
                          >
                            <option value="all">All categories</option>
                            {AUDIT_ENTITY_FILTER_KEYS.map((key) => (
                              <option key={key} value={key}>
                                {AUDIT_ENTITY_LABELS[key]}
                              </option>
                            ))}
                          </Select>
                        </Field>
                      </div>
                      <div className="min-w-0 lg:col-span-3">
                        <Field label="Activity Type">
                          <Select
                            value={actionType}
                            onChange={(e) => updateFilter("actionType", e.target.value)}
                            className="!h-12 border-stone-200 font-bold focus:border-teal-500/50"
                          >
                            <option value="all">All actions</option>
                            {Object.entries(AUDIT_ACTION_LABELS).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </Select>
                        </Field>
                      </div>
                    </div>

                    <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-center">
                      <div className="grid min-w-0 grid-cols-1 gap-6 sm:grid-cols-2 lg:col-span-8">
                        <Field label="Chronological Start">
                          <Input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => updateFilter("dateFrom", e.target.value)}
                            className="!h-12 w-full min-w-0 border-stone-200 font-bold focus:border-teal-500/50"
                          />
                        </Field>
                        <Field label="Chronological End">
                          <Input
                            type="date"
                            value={dateTo}
                            onChange={(e) => updateFilter("dateTo", e.target.value)}
                            className="!h-12 w-full min-w-0 border-stone-200 font-bold focus:border-teal-500/50"
                          />
                        </Field>
                      </div>
                    </div>

                    <FilterChips
                      className="mt-6"
                      items={[
                        {
                          key: "entity",
                          label: "Category",
                          value: entityType !== "all" ? AUDIT_ENTITY_LABELS[entityType] || entityType : "",
                          onClear: () => updateFilter("entityType", "all"),
                        },
                        {
                          key: "action",
                          label: "Activity",
                          value: actionType !== "all" ? AUDIT_ACTION_LABELS[actionType] || actionType : "",
                          onClear: () => updateFilter("actionType", "all"),
                        },
                        {
                          key: "q",
                          label: "Search",
                          value: searchQuery,
                          onClear: () => updateFilter("q", ""),
                        },
                        { key: "from", label: "From", value: dateFrom, onClear: () => updateFilter("dateFrom", "") },
                        { key: "to", label: "To", value: dateTo, onClear: () => updateFilter("dateTo", "") },
                      ]}
                      onClearAll={resetFilters}
                    />
                  </div>
                </Card>

          <ResourceView
            isLoading={loading}
            isSyncing={isValidating}
            error={auditError}
            isEmpty={logsReady && logs.length === 0}
            onRetry={() => mutate()}
            emptyProps={{
              title: "No forensic records",
              message: "Adjust search constraints or date ranges to find matching activity."
            }}
          >
            <Card className="mt-6 overflow-hidden rounded-2xl border-stone-200 !p-0 shadow-sm">
              <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/50 px-8 py-4">
                <h2 className="hs-strip-title uppercase tracking-[0.2em] text-[10px] font-black text-stone-400">Activity Registry</h2>
                <div className="text-[10px] font-mono font-bold text-stone-400 uppercase tracking-widest leading-none">
                  {auditMeta?.total ?? logs.length} events logged
                </div>
              </div>
              <Table
                embedded
                columns={[
                  { key: "id", label: "ID", className: "pl-8 w-32", headerClassName: "hs-strip-title" },
                  { key: "ts", label: "TIMESTAMP", className: "w-48 text-center", headerClassName: "hs-strip-title" },
                  { key: "user", label: "ACTOR", className: "w-40", headerClassName: "hs-strip-title" },
                  { key: "action", label: "ACTION", className: "w-32 text-center", headerClassName: "hs-strip-title" },
                  { key: "entity", label: "RESOURCE", headerClassName: "hs-strip-title" },
                  { key: "correlation", label: "CORRELATION", className: "w-40", headerClassName: "hs-strip-title" },
                  { key: "ref", label: "REF", className: "text-right px-8 w-24", headerClassName: "hs-strip-title" },
                ]}
                rows={logs.map((log, idx) => (
                  <tr
                    key={log.id || idx}
                    className="cursor-pointer border-t border-stone-50 transition-colors hover:bg-stone-50/50 group"
                    onClick={() => setSelectedLog(log)}
                  >
                    <td className="px-8 py-5">
                      <ResourceIdCell id={log.id} prefix="AUDIT" />
                    </td>
                    <td className="py-5 font-mono text-[10px] font-black uppercase tracking-tight text-stone-600 text-center tabular-nums">
                      {formatTimestamp(log.changed_at)}
                    </td>
                    <td className="py-5 text-xs font-bold text-stone-900 group-hover:text-teal-700 transition-colors">
                      {log.user_username || "System"}
                    </td>
                    <td className="py-5 text-center">
                      <StatusBadge size="xs" variant="pastel">{log.action}</StatusBadge>
                    </td>
                    <td className="py-5 text-[10px] font-bold uppercase tracking-widest text-stone-400">
                      {formatAuditEntityOrResource(log.target_table)}
                    </td>
                    <td className="py-5">
                      <CorrelationIdCell value={log.correlation_id} variant="amber" />
                    </td>
                    <td className="px-8 py-5 text-right">
                      <span className="font-mono text-[10px] font-black uppercase tracking-tighter text-stone-300 tabular-nums">
                        {formatAuditEntityIdDisplay(log.record_id, log.action)}
                      </span>
                    </td>
                  </tr>
                ))}
              />
              <TablePagination
                meta={auditMeta}
                page={auditPage}
                perPage={auditPerPage}
                onPageChange={setAuditPage}
                onPerPageChange={(n) => {
                  setAuditPage(1);
                  setAuditPerPage(n);
                }}
                disabled={!logsReady}
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
            className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between border-b border-stone-100 bg-stone-50/50 px-8 py-6">
              <div>
                <h2 className="text-sm font-black uppercase tracking-widest text-stone-900">Event detail</h2>
                <div className="flex items-center gap-2 mt-1">
                    <div className="flex items-center gap-2">
                      <ResourceIdCell id={selectedLog.id} prefix="AUDIT" />
                      <p className="font-mono text-[10px] font-black tracking-tighter text-stone-400 uppercase">
                        · {formatTimestamp(selectedLog.changed_at)}
                      </p>
                    </div>
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
              <div className="grid gap-6 sm:grid-cols-2 mb-8">
                  <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Actor</span>
                      <p className="text-sm font-bold text-stone-900">{selectedLog.user_username || 'System'}</p>
                  </div>
                  <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Resource</span>
                      <p className="text-sm font-bold text-stone-900">
                        {formatAuditEntityOrResource(selectedLog.target_table)}
                        {formatAuditEntityIdDisplay(selectedLog.record_id, selectedLog.action) !== "—" ? (
                          <span className="text-stone-400 font-mono text-xs ml-1">
                            #{formatAuditEntityIdDisplay(selectedLog.record_id, selectedLog.action)}
                          </span>
                        ) : null}
                      </p>
                  </div>
              </div>

              <div className="space-y-4 mb-10">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-stone-500">Correlation & Linkage</h3>
                <div className="rounded-2xl border border-stone-100 bg-stone-50/50 p-6 space-y-4 shadow-inner">
                   <div className="space-y-3">
                      <div className="flex items-center justify-between">
                         <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Correlation ID</span>
                         <span className="text-[10px] font-mono text-stone-400 tabular-nums uppercase">UUID v4</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <CorrelationIdCell value={selectedLog.correlation_id} preferFull variant="amber" className="flex-1" />
                        {selectedLog.correlation_id && (
                          <Link
                            href={`/admin/transaction-logs?correlation=${selectedLog.correlation_id}`}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-[10px] font-bold text-amber-700 transition-colors hover:bg-amber-100"
                          >
                            <ExternalLink size={12} />
                            <span>View TX →</span>
                          </Link>
                        )}
                      </div>
                   </div>
                </div>
              </div>

              {diffLines.length > 0 ? (
                <div className="space-y-4">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-stone-500">Field changes</h3>
                  <div className="overflow-hidden rounded-2xl border border-stone-100 shadow-sm">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-stone-50/80 text-[10px] font-black uppercase tracking-widest text-stone-400 border-b border-stone-100">
                        <tr>
                          <th className="px-5 py-3">Attribute</th>
                          <th className="px-5 py-3">Original</th>
                          <th className="px-5 py-3">Modified</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-50 text-[11px]">
                        {diffLines.map((line) => (
                          <tr key={line.field} className="hover:bg-stone-50/30 transition-colors">
                            <td className="px-5 py-4 font-bold text-stone-900 bg-stone-50/20 border-r border-stone-50">
                              {formatFieldLabel(line.field)}
                            </td>
                            <td className="px-5 py-4">
                                <span className="inline-block rounded px-2 py-1 bg-rose-50/50 text-rose-900/70 line-through decoration-rose-400/50 font-mono italic">
                                    {line.before === '""' ? "—" : line.before.replace(/"/g, "")}
                                </span>
                            </td>
                            <td className="px-5 py-4">
                                <span className="inline-block rounded px-2 py-1 bg-emerald-50 text-emerald-800 border border-emerald-100/50 font-bold font-mono">
                                    {line.after === '""' ? "—" : line.after.replace(/"/g, "")}
                                </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-stone-200 bg-stone-50/30 py-12 text-center">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-stone-100 text-stone-400">
                        <Activity size={24} />
                    </div>
                    <p className="text-sm font-bold text-stone-900">No field changes recorded</p>
                    <p className="mt-1 text-xs font-medium text-stone-500">Session/security event with no row modifications.</p>
                </div>
              )}

              <details className="mt-12 group border-t border-stone-100 pt-8">
                <summary className="flex cursor-pointer items-center justify-between text-[10px] font-black uppercase tracking-widest text-stone-400 transition-colors hover:text-stone-600 outline-none">
                  <div className="flex items-center gap-2">
                    <div className="transition-transform group-open:rotate-90">▶</div>
                    Raw JSON
                  </div>
                  <span className="group-open:hidden">Show raw buffer</span>
                  <span className="hidden group-open:inline">Hide raw buffer</span>
                </summary>
                <div className="mt-6 grid gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-stone-300">Before</p>
                    <pre className="max-h-60 overflow-y-auto rounded-2xl bg-stone-50 border border-stone-100 p-6 font-mono text-[10px] leading-relaxed text-stone-500 shadow-inner HS-scrollbar">
                      {JSON.stringify(safeParseJson(selectedLog.old_value), null, 2)}
                    </pre>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-stone-300">After</p>
                    <pre className="max-h-60 overflow-y-auto rounded-2xl bg-stone-50 border border-stone-100 p-6 font-mono text-[10px] leading-relaxed text-stone-500 shadow-inner HS-scrollbar">
                      {JSON.stringify(safeParseJson(selectedLog.new_value), null, 2)}
                    </pre>
                  </div>
                </div>
              </details>
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
