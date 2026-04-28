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
import { SkeletonListPage } from "@/components/ui/Skeleton";
import Button from "@/components/ui/Button";
import FilterChips from "@/components/ui/FilterChips";
import { Field, Input, Select } from "@/components/ui/Fields";
import { Table } from "@/components/ui/Table";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TENANT_HISTORY_STATUS_FILTER_LABELS } from "@/lib/constants";
import { flattenApiErrors } from "@/lib/errors";
import { formatDateString } from "@/lib/formatters";
import { exportReportCsv } from "@/lib/downloads";
import { useToasts } from "@/context/ToastContext";
import { Calendar, Activity, ChevronRight } from "lucide-react";
import ResourceView from "@/components/ui/ResourceView";
import ResourceIdCell from "@/components/ui/ResourceIdCell";
import TablePagination from "@/components/ui/TablePagination";
import StandardPage from "@/components/ui/StandardPage";
import {
  buildReportListQuery,
  normalizeReportRows,
  readStoredPerPage,
} from "@/lib/pagination";
import ReportHeaderActions from "@/components/ui/ReportHeaderActions";
import ReportFilterCard from "@/components/ui/ReportFilterCard";

export default function TenantHistoryReportPage() {
  const { user: currentUser, authLoading, isUnauthorized } = useAuthGuard();
  const { showToast } = useToasts();
  const [exporting, setExporting] = useState(false);
  const [apiError, setApiError] = useState("");
  const [report, setReport] = useState({ rows: [], summary: {} });
  const [tableMeta, setTableMeta] = useState(null);

  const [filters, setFilters] = useState({
    from: "",
    to: "",
    status: "all",
  });
  const [appliedFilters, setAppliedFilters] = useState({
    from: "",
    to: "",
    status: "all",
  });
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(() => readStoredPerPage());

  const reportQs = useMemo(() => {
    const extra = {};
    if (appliedFilters.from) extra.from = appliedFilters.from;
    if (appliedFilters.to) extra.to = appliedFilters.to;
    if (appliedFilters.status && appliedFilters.status !== "all") {
      extra.status = appliedFilters.status;
    }
    return buildReportListQuery(page, perPage, extra);
  }, [appliedFilters, page, perPage]);

  const canAccess = useMemo(() => canViewReports(currentUser), [currentUser]);

  const { data: reportData, error: reportError, mutate: loadReport, isValidating } = useSWR(
    !authLoading && currentUser && canAccess ? `/api/reports/tenant-history${reportQs}` : null,
    fetcher,
    { keepPreviousData: true }
  );

  const loading = authLoading || (!reportData && !reportError && canAccess);
  const tableRefreshing = isValidating;

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

  const onApplyFilters = (event) => {
    event.preventDefault();
    setApiError("");
    setAppliedFilters({ ...filters });
    setPage(1);
  };

  const onExport = async () => {
    setApiError("");
    setExporting(true);

    try {
      const exportFilters = Object.fromEntries(
        Object.entries(appliedFilters).filter(([, value]) => value && value !== "all")
      );
      await exportReportCsv({
        endpoint: "/api/reports/tenant-history/export",
        filters: exportFilters,
        filenamePrefix: "tenant-history-report",
      });
    } catch (error) {
      showToast(flattenApiErrors(error), "error");
    } finally {
      setExporting(false);
    }
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

      <ReportFilterCard onRefresh={() => loadReport()} refreshDisabled={tableRefreshing} className="hs-glass-effect">
        <form className="grid gap-6 sm:grid-cols-4" onSubmit={onApplyFilters}>
          <Field label="Start Date" icon={Calendar}>
            <Input type="date" value={filters.from} onChange={(e) => setFilters((prev) => ({ ...prev, from: e.target.value }))} className="!h-11" />
          </Field>
          <Field label="End Date" icon={Calendar}>
            <Input type="date" value={filters.to} onChange={(e) => setFilters((prev) => ({ ...prev, to: e.target.value }))} className="!h-11" />
          </Field>
          <Field label="Contract filter" icon={Activity}>
            <Select value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))} className="!h-11" aria-describedby="tenant-history-status-hint">
              {Object.entries(TENANT_HISTORY_STATUS_FILTER_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex items-end">
            <Button type="submit" variant="secondary" className="w-full !h-11 shadow-sm">
              Apply filters
            </Button>
          </div>
        </form>

        <div className="mt-6">
          <FilterChips
            items={[
              {
                key: "from",
                label: "From",
                value: appliedFilters.from,
                onClear: () => {
                  setFilters((prev) => ({ ...prev, from: "" }));
                  setAppliedFilters((prev) => ({ ...prev, from: "" }));
                  setPage(1);
                },
              },
              {
                key: "to",
                label: "To",
                value: appliedFilters.to,
                onClear: () => {
                  setFilters((prev) => ({ ...prev, to: "" }));
                  setAppliedFilters((prev) => ({ ...prev, to: "" }));
                  setPage(1);
                },
              },
              {
                key: "status",
                label: "Status",
                value:
                  appliedFilters.status !== "all"
                    ? TENANT_HISTORY_STATUS_FILTER_LABELS[appliedFilters.status] || appliedFilters.status
                    : "",
                onClear: () => {
                  setFilters((prev) => ({ ...prev, status: "all" }));
                  setAppliedFilters((prev) => ({ ...prev, status: "all" }));
                  setPage(1);
                },
              },
            ]}
            onClearAll={() => {
              const cleared = { from: "", to: "", status: "all" };
              setFilters(cleared);
              setAppliedFilters(cleared);
              setPage(1);
            }}
          />
        </div>

        {apiError ? <Alert variant="error" className="mt-6" title="Sync Issue">{apiError}</Alert> : null}
      </ReportFilterCard>

      <ResourceView
        isLoading={loading}
        isSyncing={isValidating}
        error={reportError}
        isEmpty={reportRows.length === 0}
        onRetry={() => loadReport()}
        skeleton={<SkeletonListPage rows={10} />}
        emptyProps={{
          title: "No history records found",
          message: "Adjust filters or check for archive entries to view historical lease data."
        }}
      >
        <Card className="relative mt-8 overflow-hidden border-stone-200 !p-0 shadow-sm rounded-2xl hs-glass-effect">
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
