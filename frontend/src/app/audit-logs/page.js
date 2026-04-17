"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Search, X, Activity, ShieldAlert, Database, Download, ListFilter, ExternalLink } from "lucide-react";
import { fetcher } from "../../lib/api";
import useSWR from "swr";
import { downloadCsvWithAuth } from "../../lib/downloads";
import { canManageUsers } from "../../lib/auth";
import { flattenApiErrors } from "../../lib/errors";
import { useFocusTrap } from "../../hooks/useFocusTrap";
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
import StandardPage from "../_components/ui/StandardPage";
import ResourceIdCell from "../_components/ui/ResourceIdCell";
import {
  AUDIT_ACTION_LABELS,
  AUDIT_ENTITY_FILTER_KEYS,
  AUDIT_ENTITY_LABELS,
  formatAuditEntityIdDisplay,
  formatAuditEntityOrResource,
} from "../../lib/constants";
import { buildPaginationQuery, normalizePaginatedList, readStoredPerPage } from "../../lib/pagination";
import ResourceView from "../_components/ui/ResourceView";
import TablePagination from "../_components/ui/TablePagination";
import { useAuth } from "../_context/AuthContext";

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
  if (filters?.userQuery) params.set("user", filters.userQuery);
  if (filters?.correlationQuery?.trim()) params.set("correlation", filters.correlationQuery.trim());
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

function auditListExtra(filters) {
  const extra = {};
  if (filters?.entityType && filters.entityType !== "all") extra.entity_type = filters.entityType;
  if (filters?.actionType && filters.actionType !== "all") extra.action = filters.actionType;
  if (filters?.dateFrom) extra.from = filters.dateFrom;
  if (filters?.dateTo) extra.to = filters.dateTo;
  if (filters?.userQuery) extra.user = filters.userQuery;
  if (filters?.correlationQuery?.trim()) extra.correlation = filters.correlationQuery.trim();
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

  const [logsReady, setLogsReady] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const [logs, setLogs] = useState([]);
  const [auditMeta, setAuditMeta] = useState(null);
  const [auditPage, setAuditPage] = useState(1);
  const [auditPerPage, setAuditPerPage] = useState(() => readStoredPerPage());

  const [entityType, setEntityType] = useState("all");
  const [actionType, setActionType] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [userQuery, setUserQuery] = useState("");
  const initialCorrelationQuery = searchParams.get("correlation") || "";
  const [correlationQuery, setCorrelationQuery] = useState(initialCorrelationQuery);

  const [selectedLog, setSelectedLog] = useState(null);
  const modalRef = useFocusTrap(!!selectedLog);
  const [exportingCsv, setExportingCsv] = useState(false);

  const [appliedFilters, setAppliedFilters] = useState({
    entityType: "all",
    actionType: "all",
    dateFrom: "",
    dateTo: "",
    userQuery: "",
    correlationQuery: initialCorrelationQuery,
  });

  const canAccess = useMemo(() => canManageUsers(currentUser), [currentUser]);

  const auditQs = useMemo(() => {
    return buildPaginationQuery(auditPage, auditPerPage, auditListExtra(appliedFilters));
  }, [auditPage, auditPerPage, appliedFilters]);

  const { data: auditData, error: auditError, mutate, isValidating } = useSWR(
    currentUser && canAccess ? `/api/audit-logs${auditQs}` : null,
    fetcher,
    { keepPreviousData: true, dedupingInterval: 30000 }
  );

  useEffect(() => {
    if (auditError) {
      setApiError(flattenApiErrors(auditError));
      setListLoading(false);
    }
  }, [auditError]);

  useEffect(() => {
    if (auditData) {
      const { rows: aRows, meta: aMeta } = normalizePaginatedList(auditData);
      setLogs(aRows);
      setAuditMeta(aMeta);
      setLogsReady(true);
    }
  }, [auditData]);

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

  const onExportCsv = useCallback(async () => {
    setApiError("");
    setExportingCsv(true);
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      const q = buildAuditQueryParams({ entityType, actionType, dateFrom, dateTo, userQuery, correlationQuery });
      await downloadCsvWithAuth(`/api/audit-logs/export${q}`, `audit-logs-${stamp}.csv`);
    } catch (error) {
      setApiError(flattenApiErrors(error));
    } finally {
      setExportingCsv(false);
    }
  }, [entityType, actionType, dateFrom, dateTo, userQuery, correlationQuery]);

  const loading = !logsReady && !apiError;

  return (
    <StandardPage
      title="Audit Trail"
      subtitle="Who changed what — data changes, sign-ins, and access denied events."
      breadcrumbs={<Breadcrumbs items={[{ label: "System Administration" }, { label: "Audit Trail" }]} />}
      loading={loading}
      error={apiError}
      actions={
        <div className="flex flex-wrap items-center justify-end gap-3">
          <Link
            href="/transaction-logs"
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
              label="Rows after filters"
              value={auditMeta?.total ?? logs.length}
              icon={Database}
              sub="Matching record count"
              isSyncing={isValidating}
            />
            <KpiCard
              label="Access denied"
              value={auditMeta?.access_denied_total ?? 0}
              icon={ShieldAlert}
              isDanger={(auditMeta?.access_denied_total ?? 0) > 5}
              sub="System rejection events"
              isSyncing={isValidating}
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
                    Find specific activity by user, action, date, or reference ID.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                onClick={() => mutate()}
                disabled={isValidating}
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
                  setAuditPage(1);
                  setAppliedFilters({
                    entityType,
                    actionType,
                    dateFrom,
                    dateTo,
                    userQuery,
                    correlationQuery,
                  });
                }}
              >
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-12 lg:gap-6">
                  <div className="min-w-0 lg:col-span-3">
                    <Field label="Entity">
                      <Select
                        value={entityType}
                        onChange={(e) => setEntityType(e.target.value)}
                        className="!h-12 border-stone-200 font-bold focus:border-teal-500/50"
                      >
                        <option value="all">All entities</option>
                        {AUDIT_ENTITY_FILTER_KEYS.map((key) => (
                          <option key={key} value={key}>
                            {AUDIT_ENTITY_LABELS[key]}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </div>
                  <div className="min-w-0 lg:col-span-3">
                    <Field label="Action">
                      <Select
                        value={actionType}
                        onChange={(e) => setActionType(e.target.value)}
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
                  <div className="min-w-0 md:col-span-2 lg:col-span-6">
                    <Field label="Actor search">
                      <div className="group relative">
                        <Search
                          className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-stone-400 transition-colors group-focus-within:text-teal-600"
                          aria-hidden
                        />
                        <Input
                          value={userQuery}
                          onChange={(e) => setUserQuery(e.target.value)}
                          placeholder="Username or display name…"
                          className="!h-12 w-full min-w-0 border-stone-200 pl-11 font-medium transition-[border-color,box-shadow] focus:border-teal-500/50 focus:ring-4 focus:ring-teal-500/5"
                        />
                      </div>
                    </Field>
                  </div>
                </div>

                <div className="min-w-0">
                  <Field
                    label="Correlation ID"
                    helpText="Use this to match entries from the same transaction."
                  >
                    <Input
                      value={correlationQuery}
                      onChange={(e) => setCorrelationQuery(e.target.value)}
                      placeholder="e.g. 8f3a1b2c-… or partial match"
                      autoComplete="off"
                      className="!h-12 w-full min-w-0 border-stone-200 font-mono text-[11px] focus:border-teal-500/50"
                    />
                  </Field>
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
                    key: "entity",
                    label: "Entity",
                    value: entityType !== "all" ? AUDIT_ENTITY_LABELS[entityType] || entityType : "",
                    onClear: () => { setEntityType("all"); setAppliedFilters(prev => ({...prev, entityType: "all"})); },
                  },
                  {
                    key: "action",
                    label: "action",
                    value: actionType !== "all" ? AUDIT_ACTION_LABELS[actionType] || actionType : "",
                    onClear: () => { setActionType("all"); setAppliedFilters(prev => ({...prev, actionType: "all"})); },
                  },
                  {
                    key: "user",
                    label: "Actor",
                    value: userQuery,
                    onClear: () => { setUserQuery(""); setAppliedFilters(prev => ({...prev, userQuery: ""})); },
                  },
                  {
                    key: "correlation",
                    label: "Correlation",
                    value: correlationQuery,
                    onClear: () => { setCorrelationQuery(""); setAppliedFilters(prev => ({...prev, correlationQuery: ""})); },
                  },
                  { key: "from", label: "From", value: dateFrom, onClear: () => { setDateFrom(""); setAppliedFilters(prev => ({...prev, dateFrom: ""})); } },
                  { key: "to", label: "To", value: dateTo, onClear: () => { setDateTo(""); setAppliedFilters(prev => ({...prev, dateTo: ""})); } },
                ]}
                onClearAll={() => {
                  setEntityType("all");
                  setActionType("all");
                  setDateFrom("");
                  setDateTo("");
                  setUserQuery("");
                  setCorrelationQuery("");
                  setAuditPage(1);
                  setAppliedFilters({
                    entityType: "all",
                    actionType: "all",
                    dateFrom: "",
                    dateTo: "",
                    userQuery: "",
                    correlationQuery: "",
                  });
                }}
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
              title: "No records found",
              message: "Try changing your filters to find matching activity."
            }}
          >
            <Card className="mt-6 overflow-hidden rounded-2xl border-stone-200 !p-0 shadow-sm">
              <Table
                embedded
                caption="Audit and access activity records"
                columns={[
                  { key: "id", label: "Audit ID", className: "w-[7.5rem]", headerClassName: "!px-4" },
                  { key: "ts", label: "Timestamp" },
                  { key: "user", label: "Actor" },
                  { key: "action", label: "Action" },
                  { key: "entity", label: "Resource" },
                  { key: "correlation", label: "Correlation", className: "min-w-[7rem]" },
                  { key: "ref", label: "Record ID", className: "text-right" },
                ]}
                rows={logs.map((log, idx) => (
                  <tr
                    key={log.id || idx}
                    className="cursor-pointer border-t border-stone-100 transition-colors hover:bg-stone-50"
                    onClick={() => setSelectedLog(log)}
                  >
                    <td className="px-4 py-4 align-middle">
                      <ResourceIdCell id={log.id} prefix="AUDIT" />
                    </td>
                    <td className="px-6 py-4 font-mono text-[11px] tabular-nums text-stone-600">
                      {formatTimestamp(log.changed_at)}
                    </td>
                    <td className="px-6 py-4 text-xs font-bold text-stone-900">{log.user_username || "System"}</td>
                    <td className="px-6 py-4">
                      <StatusBadge size="sm">{log.action}</StatusBadge>
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-stone-500">
                      {formatAuditEntityOrResource(log.target_table)}
                    </td>
                    <td className="px-6 py-4 align-middle">
                      <CorrelationIdCell value={log.correlation_id} variant="amber" />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-mono text-[10px] font-bold uppercase tracking-tighter text-stone-400 tabular-nums">
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
                onPageChange={(p) => setAuditPage(p)}
                onPerPageChange={(n) => {
                  setAuditPage(1);
                  setAuditPerPage(n);
                }}
                disabled={!logsReady || listLoading}
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
                            href={`/transaction-logs?correlation=${selectedLog.correlation_id}`}
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
                    <pre className="max-h-60 overflow-y-auto rounded-2xl bg-stone-900 p-6 font-mono text-[10px] leading-relaxed text-stone-300 shadow-inner HS-scrollbar">
                      {JSON.stringify(safeParseJson(selectedLog.old_value), null, 2)}
                    </pre>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-stone-300">After</p>
                    <pre className="max-h-60 overflow-y-auto rounded-2xl bg-stone-900 p-6 font-mono text-[10px] leading-relaxed text-emerald-400/80 shadow-inner HS-scrollbar">
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
