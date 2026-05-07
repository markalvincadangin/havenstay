"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { fetcher } from "@/lib/api";
import useSWR from "swr";
import { canViewReports } from "@/lib/auth";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import Alert from "@/components/ui/Alert";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import { Card } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { KpiCard } from "@/components/ui/KpiCard";
import { SkeletonListPage } from "@/components/ui/Skeleton";
import FilterPanelCard from "@/components/ui/FilterPanelCard";
import FilterChips from "@/components/ui/FilterChips";
import { Field, Input, Select } from "@/components/ui/Fields";
import { Table } from "@/components/ui/Table";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TENANT_HISTORY_STATUS_FILTER_LABELS } from "@/lib/constants";
import { flattenApiErrors } from "@/lib/errors";
import { formatDateString } from "@/lib/formatters";
import { exportReportCsv } from "@/lib/downloads";
import { useToasts } from "@/context/ToastContext";
import { Calendar, Activity, ChevronRight, Search, Users, BookOpen } from "lucide-react";
import ResourceView from "@/components/ui/ResourceView";
import ResourceIdCell from "@/components/ui/ResourceIdCell";
import TablePagination from "@/components/ui/TablePagination";
import StandardPage from "@/components/ui/StandardPage";
import { normalizeReportRows } from "@/lib/pagination";
import { usePaginatedFilters } from "@/hooks/usePaginatedFilters";
import { useReportExport } from "@/hooks/useReportExport";
import ReportHeaderActions from "@/components/ui/ReportHeaderActions";

export default function TenantHistoryReportPage() {
  const { user: currentUser, authLoading, isUnauthorized } = useAuthGuard();
  const { showToast } = useToasts();
  const { exporting, performExport } = useReportExport();
  const [apiError, setApiError] = useState("");
  const [report, setReport] = useState({ rows: [], summary: {} });
  const [tableMeta, setTableMeta] = useState(null);

  const {
    filters,
    updateFilter,
    resetFilters,
    page,
    setPage,
    perPage,
    setPerPage,
    queryString,
  } = usePaginatedFilters({
    initialFilters: { from: "", to: "", status: "all" },
    buildExtraParams: ({ filters: current }) => {
      const extra = {};
      if (current.from) extra.from = current.from;
      if (current.to) extra.to = current.to;
      if (current.status && current.status !== "all") extra.status = current.status;
      return extra;
    },
  });

  const canAccess = useMemo(() => canViewReports(currentUser), [currentUser]);

  const { data: reportData, error: reportError, mutate: loadReport, isValidating } = useSWR(
    !authLoading && currentUser && canAccess ? `/api/reports/tenant-history${queryString}` : null,
    fetcher,
    { keepPreviousData: true }
  );

  const loading = authLoading || (!reportData && !reportError && canAccess);
  const tableRefreshing = isValidating;
  const hasActiveFilters = Boolean(filters.from) || Boolean(filters.to) || filters.status !== "all";

  useEffect(() => {
    if (reportError) {
      setApiError(flattenApiErrors(reportError));
    } else if (authLoading === false && currentUser && !canAccess) {
      setApiError("Access restricted. You don’t have permission to view this report.");
    }
  }, [reportError, authLoading, currentUser, canAccess]);

  useEffect(() => {
    if (reportData) {
      setReport(reportData);
      setTableMeta(normalizeReportRows(reportData, "rows").meta);
    }
  }, [reportData]);

  const onExport = async () => {
    const exportFilters = Object.fromEntries(
      Object.entries(filters).filter(([, value]) => value && value !== "all")
    );
    await performExport({
      endpoint: "/api/reports/tenant-history/export",
      filters: exportFilters,
      filenamePrefix: "tenant-history-report",
      label: "Tenant History Report",
    });
  };

  if (isUnauthorized) return null;

  const { rows: reportRows } = normalizeReportRows(report, "rows");

  return (
    <StandardPage
      title="Tenant History"
      subtitle={
        <div className="flex flex-col gap-2">
          <p>Filter and export system data.</p>
          <div className="flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-[0.15em] text-stone-400/70">
            <span>Generated {new Date().toLocaleDateString()} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            <span className="text-stone-200">|</span>
            <span>{tableMeta?.total ?? 0} Records</span>
          </div>
        </div>
      }
      loading={loading}
      skeleton={<SkeletonListPage rows={10} />}
      breadcrumbs={
        <Breadcrumbs
          items={[
            { label: "Reports", href: "/admin/reports" },
            { label: "Tenant History" },
          ]}
        />
      }
      actions={
        <ReportHeaderActions
          user={currentUser}
          onExport={onExport}
          exporting={exporting}
          exportDisabled={exporting}
        />
      }
    >
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total History"
          value={report.summary?.total_history_count ?? "—"}
          icon={BookOpen}
          isSyncing={isValidating}
          className="hs-glass-effect"
        />
        <KpiCard
          label="Unique Tenants"
          value={report.summary?.unique_tenants_count ?? "—"}
          icon={Users}
          isSyncing={isValidating}
          className="hs-glass-effect"
        />
      </div>

      <FilterPanelCard icon={Search}>
        <div className="grid gap-6 sm:grid-cols-4">
          <Field label="Start Date" icon={Calendar}>
            <Input type="date" value={filters.from} onChange={(e) => updateFilter("from", e.target.value)} className="!h-11" />
          </Field>
          <Field label="End Date" icon={Calendar}>
            <Input type="date" value={filters.to} onChange={(e) => updateFilter("to", e.target.value)} className="!h-11" />
          </Field>
          <Field label="Contract filter" icon={Activity}>
            <Select value={filters.status} onChange={(e) => updateFilter("status", e.target.value)} className="!h-11" aria-describedby="tenant-history-status-hint">
              {Object.entries(TENANT_HISTORY_STATUS_FILTER_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="mt-6">
          <FilterChips
            items={[
              {
                key: "from",
                label: "From",
                value: filters.from,
                onClear: () => updateFilter("from", ""),
              },
              {
                key: "to",
                label: "To",
                value: filters.to,
                onClear: () => updateFilter("to", ""),
              },
              {
                key: "status",
                label: "Status",
                value:
                  filters.status !== "all"
                    ? TENANT_HISTORY_STATUS_FILTER_LABELS[filters.status] || filters.status
                    : "",
                onClear: () => updateFilter("status", "all"),
              },
            ]}
            onClearAll={resetFilters}
          />
        </div>

        {apiError ? <Alert variant="error" className="mt-6" title="Sync Issue">{apiError}</Alert> : null}
      </FilterPanelCard>

      <ResourceView
        isLoading={loading}
        isSyncing={isValidating}
        error={reportError}
        isEmpty={reportRows.length === 0}
        onRetry={() => loadReport()}
        skeleton={<SkeletonListPage rows={10} />}
        emptyProps={{
          title: "No history records found",
          description: "Adjust filters or check for archive entries to view historical lease data.",
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
        <Card className="relative mt-8 overflow-hidden border-stone-200 !p-0 shadow-sm rounded-2xl hs-glass-effect">
          <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/50 px-8 py-4">
            <h2 className="hs-strip-title uppercase tracking-[0.2em] text-[10px] font-black text-stone-400">HISTORICAL LEASE DIRECTORY</h2>
            <div className="text-[10px] font-mono font-bold text-stone-400 uppercase tracking-widest leading-none">
              {tableMeta?.total ?? reportRows.length} RECORDS MATCHING
            </div>
          </div>
          <Table
            embedded={true}
            caption="Historical lease records"
            ariaLabel="Tenant history ledger"
            columns={[
              { key: "tenant", label: "Tenant" },
              { key: "email", label: "Email" },
              { key: "move_in", label: "Move-in", className: "text-center", headerClassName: "whitespace-nowrap" },
              { key: "move_out", label: "Move-out", className: "text-center", headerClassName: "whitespace-nowrap" },
              { key: "clearance", label: "Clearance", className: "text-center" },
              { key: "room", label: "Room" },
              { key: "status", label: "Status" },
              { key: "action", label: "", className: "text-right w-16" },
            ]}
            rows={reportRows.map((row) => (
              <tr
                key={row?.contract_id ?? `${row?.tenant_name}-${row?.move_in_date}`}
                className="border-t border-stone-100 hover:bg-stone-50 transition-colors duration-100"
              >
                <td className="px-6 py-4 text-xs font-bold text-stone-900">{row?.tenant_name || "—"}</td>
                <td className="px-6 py-4 font-mono text-[10px] text-stone-400 lowercase">{row?.email || "—"}</td>
                <td className="px-6 py-4 text-center text-[10px] font-medium text-stone-500">{formatDateString(row?.move_in_date)}</td>
                <td className="px-6 py-4 text-center text-[10px] font-medium text-stone-500">{formatDateString(row?.move_out_date)}</td>
                <td className="px-6 py-4 text-center">
                  <StatusBadge variant={row?.is_cleared ? 'success' : 'warning'}>
                    {row?.is_cleared ? 'Deposit Cleared' : 'Pending'}
                  </StatusBadge>
                </td>
                <td className="px-6 py-4">
                  <div className="font-mono text-[10px] font-black uppercase tracking-tighter text-teal-600 leading-tight">{row?.room_label || "—"}</div>
                  {row?.room_id && <ResourceIdCell id={row.room_id} prefix="ROOM" />}
                </td>
                <td className="px-6 py-4 text-center">
                  <StatusBadge>{row?.status || "—"}</StatusBadge>
                </td>
                <td className="px-6 py-4 text-right">
                  <Link href={`/tenants/${row.tenant_id}`} className="text-stone-300 hover:text-teal-600 transition-colors">
                    <ChevronRight size={16} />
                  </Link>
                </td>
              </tr>
            ))}
            emptyTitle="No history records found"
            emptyDescription="Adjust filters or check for archive entries to view historical lease data."
          />
          <TablePagination
            meta={tableMeta}
            page={page}
            perPage={perPage}
            onPageChange={setPage}
            onPerPageChange={(n) => {
              setPage(1);
              setPerPage(n);
            }}
            disabled={isValidating}
            className="hs-glass-effect"
          />
        </Card>
      </ResourceView>
    </StandardPage>
  );
}
