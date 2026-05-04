/**
 * @module Admin/AuditLogs
 * @description Inspector for tracking system changes and access security.
 * @version 4.8.0
 * 
 * @traceability
 * - Requirements: FR-053, FR-054
 * - Business Rules: BR-GEN-005, BR-AUD-001, BR-AUD-003
 * 
 * @performance
 * - Category: Audit Logs (30s cache)
 * - Pattern: SWR Paginated
 */
"use client";
import { useState, useMemo } from "react";
import useSWR from "swr";
import {
  Download, Lock, Zap, User, Activity, ShieldAlert, Search, Eye
} from "lucide-react";
import { fetcher } from "@/lib/api";
import { canViewAuditLogs } from "@/lib/auth";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { usePaginatedFilters } from "@/hooks/usePaginatedFilters";
import { normalizePaginatedList } from "@/lib/pagination";
import { formatDateString } from "@/lib/formatters";
import {
  formatAuditEntityOrResource,
  formatAuditEntityIdDisplay,
  AUDIT_ENTITY_FILTER_GROUPS,
  AUDIT_ACTION_LABELS,
  SEARCH_LABELS,
  SEARCH_PLACEHOLDERS,
  FILTER_ALL_ACTIONS,
  FILTER_ALL_RESOURCES
} from "@/lib/constants";
import Alert from "@/components/ui/Alert";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import FilterPanelCard from "@/components/ui/FilterPanelCard";
import { Field, Input, Select } from "@/components/ui/Fields";
import FilterChips from "@/components/ui/FilterChips";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table } from "@/components/ui/Table";
import TablePagination from "@/components/ui/TablePagination";
import ResourceView from "@/components/ui/ResourceView";
import ResourceIdCell from "@/components/ui/ResourceIdCell";
import { CorrelationIdCell } from "@/components/ui/CorrelationIdCell";
import StandardPage from "@/components/ui/StandardPage";
import { SkeletonListPage } from "@/components/ui/Skeleton";
import { KpiCard } from "@/components/ui/KpiCard";
import { useTableSort } from "@/hooks/useTableSort";
import { useToasts } from "@/context/ToastContext";
import ReportHeaderActions from "@/components/ui/ReportHeaderActions";

import { downloadCsvWithAuth } from "@/lib/downloads";
import { AuditLogDiffModal } from "@/features/admin/components/AuditLogDiffModal";
export default function AuditLogsPage() {
  const { user: currentUser, authLoading, isUnauthorized } = useAuthGuard();
  const { showToast } = useToasts();
  const canAccess = useMemo(() => canViewAuditLogs(currentUser), [currentUser]);
  const viewDenied = !authLoading && currentUser !== null && !canAccess;
  const [activeDiff, setActiveDiff] = useState(null);
  const {
    filters,
    updateFilter,
    resetFilters,
    sort,
    onSortChange,
    page,
    setPage,
    perPage,
    setPerPage,
    queryString,
  } = usePaginatedFilters({
    initialFilters: { query: "", action: "all", resource: "all" },
    initialSort: { by: "timestamp", dir: "desc" },
    debounceKeys: ["query"],
    buildExtraParams: ({ filters: current, debounced }) => {
      const extra = {};
      const q = String(debounced.query || "").trim();
      if (q) extra.q = q;
      if (current.action !== "all") extra.action = current.action;
      if (current.resource !== "all") extra.entity_type = current.resource;
      return extra;
    },
  });
  const { data: logsData, error: logsError, isValidating: isSyncing, mutate: refetchLogs } = useSWR(
    !authLoading && currentUser && canAccess ? `/api/audit-logs${queryString}` : null,
    fetcher,
    { keepPreviousData: true }
  );
  const { data: pulseData, isValidating: pulseValidating } = useSWR(
    !authLoading && currentUser && canAccess ? "/api/reports/security-pulse" : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  );
  const { rows: logs = [], meta: listMeta = null } = useMemo(() => {
    if (!logsData) return { rows: [], meta: null };
    return normalizePaginatedList(logsData);
  }, [logsData]);
  const sortedRows = logs;
  const interactiveTableRowClass = "group border-t border-stone-100 hover:bg-stone-50 cursor-pointer transition-colors duration-100";
  const loading = (!logsData && !logsError) || authLoading;

  const hasActiveFilters = Boolean(String(filters.query ?? "").trim()) || filters.action !== "all" || filters.resource !== "all";

  const [exporting, setExporting] = useState(false);
  const handleExport = async () => {
    try {
      setExporting(true);
      showToast("Preparing audit log export...", "info");
      const stamp = new Date().toISOString().slice(0, 10);
      await downloadCsvWithAuth(`/api/audit-logs/export${queryString}`, `audit-logs-${stamp}.csv`);
      showToast("Audit log exported successfully.", "success");
    } catch (err) {
      console.error("Export failed:", err);
      showToast("Export failed. Please try again.", "error");
    } finally {
      setExporting(false);
    }
  };
  if (isUnauthorized) return null;
  return (
    <StandardPage
      title="Audit Logs"
      subtitle="Track activity and changes in HavenStay."
      breadcrumbs={<Breadcrumbs items={[{ label: "Audit Logs" }]} />}
      loading={loading}
      skeleton={<SkeletonListPage rows={10} />}
      actions={canAccess && (
        <ReportHeaderActions
          user={currentUser}
          onExport={handleExport}
          exporting={exporting}
          exportDisabled={exporting || loading || logs?.length === 0}
          exportLabel="Export Audit Logs"
        />
      )}
    >
      <div className="space-y-6">
        {viewDenied && (
          <Alert variant="warning" title="Access restricted" data-testid="access-denied-audit">
            You do not have administrative permission to view system audit logs.
          </Alert>
        )}
        {!viewDenied && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <KpiCard
                label="System Events"
                value={pulseData?.total_events_24h ?? 0}
                sub="LOGGED LAST 24H"
                icon={Activity}
                isLoading={!pulseData}
                isSyncing={pulseValidating}
                className="hs-glass-effect"
              />
              <KpiCard
                label="Sensitive Changes"
                value={pulseData?.sensitive_mutations_24h ?? 0}
                sub="PROTECTED RECORDS"
                icon={ShieldAlert}
                isWarning={(pulseData?.sensitive_mutations_24h ?? 0) > 0}
                isLoading={!pulseData}
                isSyncing={pulseValidating}
                className="hs-glass-effect"
              />
              <KpiCard
                label="Access Denied"
                value={pulseData?.access_denied_24h ?? 0}
                sub="FAILED AUTH ATTEMPTS"
                icon={Lock}
                isDanger={(pulseData?.access_denied_24h ?? 0) > 0}
                isActiveDecision={(pulseData?.access_denied_24h ?? 0) > 0}
                isLoading={!pulseData}
                isSyncing={pulseValidating}
                className="hs-glass-effect"
              />
            </div>
            <FilterPanelCard icon={ShieldAlert} title="Filters">
              <div className="grid items-end gap-6 md:grid-cols-12 space-y-0">
                <div className="md:col-span-12 lg:col-span-6">
                  <Field label={SEARCH_LABELS.audit_logs}>
                    <div className="group relative">
                      <Search
                        className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-stone-400 transition-colors group-focus-within:text-teal-600"
                        aria-hidden
                      />
                      <Input
                        value={filters.query}
                        onChange={(e) => updateFilter("query", e.target.value)}
                        placeholder={SEARCH_PLACEHOLDERS.audit_logs}
                        className="!h-12 border-stone-200 pl-11 font-bold transition-[border-color,box-shadow] focus:border-teal-500/50 focus:ring-4 focus:ring-teal-500/5"
                      />
                    </div>
                  </Field>
                </div>
                <div className="md:col-span-6 lg:col-span-3">
                  <Field label="Event Action">
                    <Select
                      value={filters.action}
                      onChange={(e) => updateFilter("action", e.target.value)}
                      className="!h-12 border-stone-200 font-bold focus:border-teal-500/50"
                    >
                      <option value="all">{FILTER_ALL_ACTIONS}</option>
                      {Object.entries(AUDIT_ACTION_LABELS)
                        .filter(([key]) => key === key.toUpperCase()) // Use uppercase keys for consistency with database
                        .map(([key, label]) => (
                          <option key={key} value={key}>{label}</option>
                        ))}
                    </Select>
                  </Field>
                </div>
                <div className="md:col-span-6 lg:col-span-3">
                  <Field label="Target Resource">
                    <Select
                      value={filters.resource}
                      onChange={(e) => updateFilter("resource", e.target.value)}
                      className="!h-12 border-stone-200 font-bold focus:border-teal-500/50"
                    >
                      <option value="all">{FILTER_ALL_RESOURCES}</option>
                      {Object.entries(AUDIT_ENTITY_FILTER_GROUPS).map(([group, entities]) => (
                        <optgroup key={group} label={group}>
                          {entities.map((key) => (
                            <option key={key} value={key}>
                              {formatAuditEntityOrResource(key)}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </Select>
                  </Field>
                </div>
              </div>
              <FilterChips
                className="mt-6"
                items={[
                  { key: "q", label: "Audit Logs", value: filters.query, onClear: () => updateFilter("query", "") },
                  {
                    key: "action",
                    label: "Action",
                    value: filters.action !== "all" ? AUDIT_ACTION_LABELS[filters.action] || filters.action : "",
                    onClear: () => updateFilter("action", "all"),
                  },
                  {
                    key: "resource",
                    label: "Resource",
                    value: filters.resource !== "all" ? formatAuditEntityOrResource(filters.resource) : "",
                    onClear: () => updateFilter("resource", "all"),
                  },
                ]}
                onClearAll={resetFilters}
              />
            </FilterPanelCard>
            <ResourceView
              isLoading={loading}
              isSyncing={isSyncing}
              error={logsError}
              isEmpty={logs.length === 0}
              onRetry={() => refetchLogs()}
              emptyProps={{
                title: "No audit events found",
                description: "No activity logs match your current filters. Try broadening your search.",
                action: hasActiveFilters ? (
                  <Button
                    variant="secondary"
                    className="!h-12 rounded-xl px-10 text-[10px] font-bold uppercase tracking-widest"
                    onClick={resetFilters}
                  >
                    Clear filters
                  </Button>
                ) : null
              }}
            >
              <Card className="overflow-hidden border-stone-200 !p-0 shadow-sm rounded-2xl hs-glass-effect">
                <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/50 px-8 py-4">
                  <h2 className="hs-strip-title uppercase tracking-[0.2em] text-[10px] font-black text-stone-400">
                    AUDIT TRAIL
                  </h2>
                  <div className="text-[10px] font-mono font-bold tabular-nums text-stone-400 uppercase tracking-widest leading-none">
                    {listMeta?.total ?? sortedRows.length} EVENTS MATCHING
                  </div>
                </div>
                <Table
                  embedded={true}
                  dense={true}
                  sortable={true}
                  sortColumn={sort.by}
                  sortDirection={sort.dir}
                  onSortChange={onSortChange}
                  columns={[
                    { key: "audit_id", label: "AUDIT ID", sortable: true, className: "pl-8 w-28" },
                    { key: "timestamp", label: "DATE", sortable: true, className: "w-44" },
                    { key: "category", label: "CATEGORY", sortable: true, className: "w-32" },
                    { key: "actor", label: "ACTOR", sortable: true },
                    { key: "action", label: "ACTION", sortable: true, className: "w-28 text-center" },
                    { key: "status", label: "STATUS", sortable: true, className: "w-24 text-center" },
                    { key: "resource", label: "RESOURCE", sortable: true, className: "w-32" },
                    { key: "actions", label: "", className: "w-16 text-right pr-8" },
                  ]}
                  rows={sortedRows.map((log) => (
                    <tr key={log.id} className={interactiveTableRowClass} onClick={() => setActiveDiff(log)}>
                      <td className="pl-8 py-6">
                        <ResourceIdCell id={log.id} type="audit" />
                      </td>
                      <td className="py-6">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold tabular-nums text-stone-900">
                            {formatDateString(log.changed_at)}
                          </span>
                          <span className="mt-1 font-mono text-[10px] font-bold tabular-nums uppercase tracking-widest text-stone-400">
                            {log.changed_at
                              ? (() => {
                                const normalized =
                                  typeof log.changed_at === "string" &&
                                    log.changed_at.includes(" ") &&
                                    !log.changed_at.includes("T") &&
                                    !log.changed_at.includes("Z")
                                    ? log.changed_at.replace(" ", "T") + "Z"
                                    : log.changed_at;
                                return new Date(normalized).toLocaleTimeString("en-PH", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  hour12: true,
                                });
                              })()
                              : "—"}
                          </span>
                        </div>
                      </td>
                      <td className="py-6">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400">
                            {log.event_category}
                          </span>
                        </div>
                      </td>
                      <td className="py-6">
                        <div className="flex items-center gap-3">
                          <div className="flex size-8 items-center justify-center rounded-lg bg-stone-100 text-stone-400 group-hover:bg-stone-200 group-hover:text-stone-600 transition-colors">
                            <User size={14} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-stone-900 truncate">
                              {log.actor_snapshot?.name ||
                                (log.user ? `${log.user.first_name} ${log.user.last_name}` : "System Trace")}
                            </p>
                            {(log.user?.username || log.actor_snapshot?.role) && (
                              <p className="font-mono text-[10px] font-bold text-teal-600 uppercase tracking-widest mt-0.5">
                                @{log.user?.username || log.actor_snapshot?.role}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-6 text-center">
                        <StatusBadge>{log.action}</StatusBadge>
                      </td>
                      <td className="py-6 text-center">
                        <div
                          className={`mx-auto size-2 rounded-full ${log.is_success
                              ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                              : "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]"
                            }`}
                        />
                      </td>
                      <td className="py-6">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-stone-900">
                            {formatAuditEntityOrResource(log.target_table)}
                          </span>
                          <span className="mt-1 font-mono text-[10px] font-bold text-stone-400 uppercase tracking-widest leading-none">
                            REF #{formatAuditEntityIdDisplay(log.record_id, log.action)}
                          </span>
                        </div>
                      </td>
                      <td className="pr-8 py-6 text-right">
                        <div className="flex justify-end">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-400 group-hover:border-teal-200 group-hover:bg-teal-50 group-hover:text-teal-600 transition-colors">
                            <Eye size={14} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                  emptyTitle="No activity found"
                  emptyDescription="No activity logs found."
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
                  className="hs-glass-effect"
                />
              </Card>
            </ResourceView>
          </div>
        )}
      </div>
      {activeDiff && <AuditLogDiffModal audit={activeDiff} onClose={() => setActiveDiff(null)} />}
    </StandardPage>
  );
}
