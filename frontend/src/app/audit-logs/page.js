"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { Search, X, Activity, ShieldAlert, Database, Download, ListFilter } from "lucide-react";
import { apiRequest } from "../../lib/api";
import { downloadCsvWithAuth } from "../../lib/downloads";
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
import {
  AUDIT_ACTION_LABELS,
  AUDIT_ENTITY_FILTER_KEYS,
  AUDIT_ENTITY_LABELS,
  formatAuditEntityIdDisplay,
  formatAuditEntityOrResource,
} from "../../lib/constants";
import { buildPaginationQuery, normalizePaginatedList, readStoredPerPage } from "../../lib/pagination";
import TablePagination from "../_components/ui/TablePagination";

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.2, ease: "easeOut" },
};

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

function formatForensicTimestamp(ts) {
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
  if (value == null) return null;
  if (typeof value === "object") return value;
  if (typeof value !== "string") return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
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

function correlationHeaderLabel() {
  return (
    <span title="Optional. May match a row on Transaction logs when this change was part of that run.">
      Correlation
    </span>
  );
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
  const { user: currentUser, authLoading } = useAuthGuard();
  const shouldReduceMotion = useReducedMotion();

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
  const [correlationQuery, setCorrelationQuery] = useState("");

  const [selectedLog, setSelectedLog] = useState(null);
  const modalRef = useFocusTrap(!!selectedLog);
  const [exportingCsv, setExportingCsv] = useState(false);

  const canAccess = useMemo(() => canManageUsers(currentUser), [currentUser]);
  const accessDenied = !authLoading && currentUser !== null && !canManageUsers(currentUser);

  const loadData = useCallback(
    async (overrides = {}) => {
      setApiError("");
      const silent = overrides.silent === true;
      if (!silent) {
        setLogsReady(false);
      }
      setListLoading(true);

      const filters = {
        entityType,
        actionType,
        dateFrom,
        dateTo,
        userQuery,
        correlationQuery,
      };

      const aPage = overrides.auditPage ?? auditPage;
      const aPer = overrides.auditPerPage ?? auditPerPage;

      const auditQs = buildPaginationQuery(aPage, aPer, auditListExtra(filters));

      try {
        const auditData = await apiRequest(`/api/audit-logs${auditQs}`, { method: "GET" });

        const { rows: aRows, meta: aMeta } = normalizePaginatedList(auditData);

        setLogs(aRows);
        setAuditMeta(aMeta);
      } catch (error) {
        setApiError(flattenApiErrors(error));
      } finally {
        setLogsReady(true);
        setListLoading(false);
      }
    },
    [entityType, actionType, dateFrom, dateTo, userQuery, correlationQuery, auditPage, auditPerPage],
  );

  useEffect(() => {
    if (authLoading || !currentUser || accessDenied) return;
    loadData();
  }, [authLoading, currentUser, accessDenied, loadData]);

  const accessDeniedFallback = useMemo(
    () => logs.filter((l) => l.action === "access_denied").length,
    [logs],
  );
  const accessDeniedCount =
    typeof auditMeta?.access_denied_total === "number"
      ? auditMeta.access_denied_total
      : accessDeniedFallback;

  const diffLines = useMemo(() => {
    if (!selectedLog) return [];
    return buildDiffLines(selectedLog.old_values_json, selectedLog.new_values_json, selectedLog.action);
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

  if (authLoading || (!accessDenied && !!currentUser && canManageUsers(currentUser) && !logsReady)) {
    return <SkeletonListPage rows={8} />;
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
          title="Audit Trail"
          subtitle="Who changed what: data changes, sign-ins, and access denied (admin)."
          breadcrumbs={<Breadcrumbs items={[{ label: "System Administration" }, { label: "Audit Trail" }]} />}
          actions={
            <div className="flex flex-wrap items-center justify-end gap-3">
              <Link
                href="/transaction-logs"
                className="inline-flex h-11 items-center rounded-xl border border-stone-200 bg-white px-4 text-[10px] font-bold uppercase tracking-widest text-stone-600 transition-colors hover:border-teal-300 hover:text-teal-700"
              >
                Transaction logs
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
        />

        {accessDenied ? (
          <Alert variant="warning" title="Access Denied" data-testid="access-denied-audit-logs">
            Administrative privileges are required to view the forensic audit trail. 
            If you require access for investigative purposes, please contact the system owner.
          </Alert>
        ) : null}

        {canAccess && (
          <>
            {apiError ? (
              <Alert variant="error" title="Could not load audit logs">
                {apiError}
              </Alert>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <KpiCard
                label="Rows after filters"
                value={auditMeta?.total ?? logs.length}
                icon={Database}
                sub="Same rules as the table below · all pages"
              />
              <KpiCard
                label="Access denied"
                value={accessDeniedCount}
                icon={ShieldAlert}
                isDanger={accessDeniedCount > 5}
                sub="Denials in that same filtered total"
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
                      Filter by entity, action, actor, dates, or correlation ID.
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => void loadData({ silent: true })}
                  disabled={listLoading}
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
                    void loadData({ auditPage: 1 });
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
                      helpText="Optional. Filter rows that share this correlation value."
                    >
                      <Input
                        value={correlationQuery}
                        onChange={(e) => setCorrelationQuery(e.target.value)}
                        placeholder="e.g. 8f3a1b2c-… or partial match"
                        autoComplete="off"
                        spellCheck={false}
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
                      onClear: () => setEntityType("all"),
                    },
                    {
                      key: "action",
                      label: "Action",
                      value: actionType !== "all" ? AUDIT_ACTION_LABELS[actionType] || actionType : "",
                      onClear: () => setActionType("all"),
                    },
                    {
                      key: "user",
                      label: "Actor",
                      value: userQuery,
                      onClear: () => setUserQuery(""),
                    },
                    {
                      key: "correlation",
                      label: "Correlation",
                      value: correlationQuery,
                      onClear: () => setCorrelationQuery(""),
                    },
                    { key: "from", label: "From", value: dateFrom, onClear: () => setDateFrom("") },
                    { key: "to", label: "To", value: dateTo, onClear: () => setDateTo("") },
                  ]}
                  onClearAll={() => {
                    setEntityType("all");
                    setActionType("all");
                    setDateFrom("");
                    setDateTo("");
                    setUserQuery("");
                    setCorrelationQuery("");
                    setAuditPage(1);
                    void loadData({ auditPage: 1 });
                  }}
                />
              </div>
            </Card>

            <Card className="mt-6 overflow-hidden rounded-2xl border-stone-200 !p-0 shadow-sm">
              <Table
                embedded
                caption="Row-level data and security events"
                ariaLabel="Audit log table"
                columns={[
                  {
                    key: "id",
                    label: "Audit log ID",
                    className: "w-[7.5rem]",
                    headerClassName: "!px-4",
                  },
                  { key: "ts", label: "Timestamp" },
                  { key: "user", label: "Actor" },
                  { key: "action", label: "Action" },
                  { key: "entity", label: "Resource" },
                  { key: "correlation", label: correlationHeaderLabel(), className: "min-w-[7rem]" },
                  { key: "ref", label: "Record ID", className: "text-right" },
                ]}
                rows={logs.map((log, idx) => {
                  const ts = log.created_at;
                  const userName = log.user_username || "System";

                  return (
                    <tr
                      key={log.audit_log_id || idx}
                      className="cursor-pointer border-t border-stone-100 transition-colors hover:bg-stone-50"
                      onClick={() => setSelectedLog(log)}
                    >
                      <td className="px-4 py-4 align-middle">
                        <span className="font-mono text-[10px] font-bold uppercase tracking-tighter text-stone-400 tabular-nums">
                          #AUDIT-{log.audit_log_id}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-[11px] tabular-nums text-stone-600">
                        {formatForensicTimestamp(ts)}
                      </td>
                      <td className="px-6 py-4 text-xs font-bold text-stone-900">{userName}</td>
                      <td className="px-6 py-4">
                        <StatusBadge size="sm">{log.action}</StatusBadge>
                      </td>
                      <td className="px-6 py-4 text-xs font-medium text-stone-500">
                        {formatAuditEntityOrResource(log.entity_name)}
                      </td>
                      <td className="px-6 py-4 align-middle">
                        <CorrelationIdCell value={log.correlation_id} />
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-[10px] font-bold uppercase tracking-tighter text-stone-400 tabular-nums">
                        {formatAuditEntityIdDisplay(log.entity_id, log.action)}
                      </td>
                    </tr>
                  );
                })}
              />
              <TablePagination
                meta={auditMeta}
                page={auditPage}
                perPage={auditPerPage}
                onPageChange={(p) => {
                  setAuditPage(p);
                  void loadData({ auditPage: p });
                }}
                onPerPageChange={(n) => {
                  setAuditPage(1);
                  setAuditPerPage(n);
                  void loadData({ auditPage: 1, auditPerPage: n });
                }}
                disabled={!logsReady || listLoading}
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
            className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between border-b border-stone-100 bg-stone-50/50 px-8 py-6">
              <div>
                <h2 className="text-sm font-black uppercase tracking-widest text-stone-900">Event detail</h2>
                <p className="mt-1 font-mono text-[10px] font-black tracking-tighter text-stone-400">
                  Log #{selectedLog.audit_log_id} · {formatForensicTimestamp(selectedLog.created_at)}
                </p>
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
                        {formatAuditEntityOrResource(selectedLog.entity_name)}
                        {formatAuditEntityIdDisplay(selectedLog.entity_id, selectedLog.action) !== "—" ? (
                          <span className="text-stone-400 font-mono text-xs">
                            {" "}
                            #{formatAuditEntityIdDisplay(selectedLog.entity_id, selectedLog.action)}
                          </span>
                        ) : null}
                      </p>
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Correlation ID</span>
                      <div className="rounded-xl border border-stone-100 bg-stone-50/50 px-3 py-2">
                        <CorrelationIdCell value={selectedLog.correlation_id} preferFull />
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
                      <tbody className="divide-y divide-stone-50">
                        {diffLines.map((line) => (
                          <tr key={line.field} className="hover:bg-stone-50/30 transition-colors">
                            <td className="px-5 py-4 font-bold text-stone-900 bg-stone-50/20 border-r border-stone-50">
                              {formatFieldLabel(line.field)}
                            </td>
                            <td className="px-5 py-4">
                                <span className="inline-block rounded px-2 py-0.5 bg-rose-50/50 text-rose-900/70 line-through decoration-rose-400/50 font-mono text-[10px]">
                                    {line.before === '""' ? "—" : line.before.replace(/"/g, "")}
                                </span>
                            </td>
                            <td className="px-5 py-4">
                                <span className="inline-block rounded px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-100/50 font-bold font-mono text-[10px]">
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
                    <p className="mt-1 text-xs font-medium text-stone-500">No before/after values for this event (for example login or access denied).</p>
                </div>
              )}

              <details className="mt-12 group">
                <summary className="flex cursor-pointer items-center gap-2 text-[10px] font-black uppercase tracking-widest text-stone-400 transition-colors hover:text-stone-600">
                  <div className="transition-transform group-open:rotate-90">▶</div>
                  Raw JSON
                </summary>
                <div className="mt-6 grid gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-stone-300">Before</p>
                    <pre className="max-h-60 overflow-y-auto rounded-2xl bg-stone-900 p-4 font-mono text-[10px] leading-relaxed text-stone-300 shadow-inner">
                      {JSON.stringify(safeParseJson(selectedLog.old_values_json), null, 2)}
                    </pre>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-stone-300">After</p>
                    <pre className="max-h-60 overflow-y-auto rounded-2xl bg-stone-900 p-4 font-mono text-[10px] leading-relaxed text-stone-300 shadow-inner">
                      {JSON.stringify(safeParseJson(selectedLog.new_values_json), null, 2)}
                    </pre>
                  </div>
                </div>
              </details>
            </div>
          </motion.div>
        </div>
      )}
    </AppMain>
  );
}
