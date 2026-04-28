"use client";
import { useEffect, useState, useMemo } from "react";
import { fetcher } from "@/lib/api";
import useSWR from "swr";
import { canViewReports } from "@/lib/auth";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { flattenApiErrors } from "@/lib/errors";
import { formatDateString } from "@/lib/formatters";
import CurrencyDisplay from "@/components/ui/CurrencyDisplay";
import { useToasts } from "@/context/ToastContext";
import { exportReportCsv } from "@/lib/downloads";
import Alert from "@/components/ui/Alert";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import FilterChips from "@/components/ui/FilterChips";
import { Field, Input } from "@/components/ui/Fields";
import { SkeletonListPage } from "@/components/ui/Skeleton";
import { KpiCard } from "@/components/ui/KpiCard";
import { Table } from "@/components/ui/Table";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Receipt, Calendar, Landmark, DollarSign, Activity } from "lucide-react";
import ResourceView from "@/components/ui/ResourceView";
import TablePagination from "@/components/ui/TablePagination";
import StandardPage from "@/components/ui/StandardPage";
import {
  buildReportListQuery,
  normalizeReportRows,
  readStoredPerPage,
} from "@/lib/pagination";
import ReportHeaderActions from "@/components/ui/ReportHeaderActions";
import ReportFilterCard from "@/components/ui/ReportFilterCard";
import ResourceIdCell from "@/components/ui/ResourceIdCell";
export default function BillingSummaryReportPage() {
  const { user: currentUser, authLoading, isUnauthorized } = useAuthGuard();
  const { showToast } = useToasts();
  const [exporting, setExporting] = useState(false);
  const [apiError, setApiError] = useState("");
  const [apiUnavailable, setApiUnavailable] = useState(false);
  const [report, setReport] = useState({ summary: null, rows: [] });
  const [tableMeta, setTableMeta] = useState(null);
  const [filters, setFilters] = useState({ start_date: "", end_date: "" });
  const [appliedFilters, setAppliedFilters] = useState({ start_date: "", end_date: "" });
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(() => readStoredPerPage());
  const reportQs = useMemo(() => {
    const extra = {};
    if (appliedFilters.start_date) extra.start_date = appliedFilters.start_date;
    if (appliedFilters.end_date) extra.end_date = appliedFilters.end_date;
    return buildReportListQuery(page, perPage, extra);
  }, [appliedFilters, page, perPage]);
  const { data: reportData, error: reportError, mutate: loadReport, isValidating } = useSWR(
    !authLoading && currentUser && canViewReports(currentUser) ? `/api/reports/billing-summary${reportQs}` : null,
    fetcher,
    { keepPreviousData: true, dedupingInterval: 600000 }
  );
  const loading = !reportData && !reportError && !apiUnavailable && !authLoading && currentUser && canViewReports(currentUser);
  useEffect(() => {
    if (reportError) {
      if (reportError?.status === 404) {
        setApiUnavailable(true);
        setApiError("");
      } else {
        setApiError(flattenApiErrors(reportError));
      }
    } else if (authLoading === false && currentUser && !canViewReports(currentUser)) {
      setApiError("Access restricted. You don’t have permission to view this report.");
    }
  }, [reportError, authLoading, currentUser]);
  useEffect(() => {
    if (reportData) {
      setApiUnavailable(false);
      setReport(reportData);
      setTableMeta(normalizeReportRows(reportData, "rows").meta);
    }
  }, [reportData]);
  const onApplyFilters = (event) => {
    event.preventDefault();
    if (apiUnavailable) return;
    setApiError("");
    setAppliedFilters({ ...filters });
    setPage(1);
  };
  const onExport = async () => {
    if (apiUnavailable) return;
    setApiError("");
    setExporting(true);
    try {
      await exportReportCsv({
        endpoint: "/api/reports/billing-summary/export",
        filters: appliedFilters,
        filenamePrefix: "billing-summary-report",
      });
    } catch (error) {
      showToast(flattenApiErrors(error), "error");
    } finally {
      setExporting(false);
    }
  };
  if (isUnauthorized) return null;
  const rows = normalizeReportRows(report, "rows").rows;
  return (
    <StandardPage
      title="Billing Summary"
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
      loading={authLoading || loading}
      skeleton={<SkeletonListPage rows={10} />}
      breadcrumbs={
        <Breadcrumbs
          items={[
            { label: "Reports", href: "/admin/reports" },
            { label: "Billing Summary" },
          ]}
        />
      }
      actions={
        <ReportHeaderActions
          user={currentUser}
          onExport={onExport}
          exporting={exporting}
          exportDisabled={exporting || apiUnavailable}
        />
      }
    >
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard 
           label="Billing Records" 
           value={report.summary?.billing_count ?? 0}
           icon={Activity}
           isSyncing={isValidating}
           className="hs-glass-effect"
        />
        <KpiCard 
           label="Total Billed" 
           value={report.summary?.billed_total}
           icon={Receipt}
           isSyncing={isValidating}
           currency={true}
           className="hs-glass-effect"
        />
        <KpiCard 
           label="Total Collected" 
           value={report.summary?.collected_total}
           icon={DollarSign}
           isSyncing={isValidating}
           currency={true}
           className="hs-glass-effect"
        />
        <KpiCard 
           label="Outstanding Balance" 
           value={report.summary?.outstanding_total}
           isDanger={report.summary?.outstanding_total > 0}
           icon={Landmark}
           isSyncing={isValidating}
           currency={true}
           className="hs-glass-effect"
        />
      </div>
      <ReportFilterCard onRefresh={() => loadReport()} className="hs-glass-effect">
            <form
            className="grid gap-6 sm:grid-cols-4"
            onSubmit={onApplyFilters}
            >
            <Field label="Billing From" icon={Calendar}>
                <Input
                type="date"
                value={filters.start_date}
                disabled={apiUnavailable}
                onChange={(event) =>
                    setFilters((prev) => ({ ...prev, start_date: event.target.value }))
                }
                className="!h-11"
                />
            </Field>
            <Field label="Billing To" icon={Calendar}>
                <Input
                type="date"
                value={filters.end_date}
                disabled={apiUnavailable}
                onChange={(event) =>
                    setFilters((prev) => ({ ...prev, end_date: event.target.value }))
                }
                className="!h-11"
                />
            </Field>
            <div className="flex items-end">
                <Button
                type="submit"
                variant="secondary"
                disabled={apiUnavailable}
                className="w-full !h-11 shadow-sm"
                >
                Apply filters
                </Button>
            </div>
            </form>
            <div className="mt-6">
                <FilterChips
                items={[
                    {
                    key: "start_date",
                    label: "Start",
                    value: appliedFilters.start_date,
                    onClear: () => {
                      setFilters((prev) => ({ ...prev, start_date: "" }));
                      setAppliedFilters((prev) => ({ ...prev, start_date: "" }));
                      setPage(1);
                    },
                    },
                    {
                    key: "end_date",
                    label: "End",
                    value: appliedFilters.end_date,
                    onClear: () => {
                      setFilters((prev) => ({ ...prev, end_date: "" }));
                      setAppliedFilters((prev) => ({ ...prev, end_date: "" }));
                      setPage(1);
                    },
                    },
                ]}
                onClearAll={() => {
                  setFilters({ start_date: "", end_date: "" });
                  setAppliedFilters({ start_date: "", end_date: "" });
                  setPage(1);
                }}
                />
            </div>
            {apiUnavailable ? (
            <Alert variant="info" className="mt-6" title="Report unavailable">
                The billing summary endpoint did not respond. Check API configuration and try again.
            </Alert>
            ) : null}
            {apiError ? (
            <Alert variant="error" className="mt-6" title="Error">
                {apiError}
            </Alert>
            ) : null}
      </ReportFilterCard>
      <ResourceView
        isLoading={loading}
        isSyncing={isValidating}
        error={reportError}
        isEmpty={rows.length === 0}
        onRetry={() => loadReport()}
        skeleton={<SkeletonListPage rows={10} />}
        emptyProps={{
          title: "No billing records found",
          message: "Adjust your date filters or clear the range to check for billing records."
        }}
      >
        <Card className="mt-8 overflow-hidden border-stone-200 !p-0 shadow-sm rounded-2xl hs-glass-effect">
          <Table
              embedded={true}
              caption="Billing Summary"
              ariaLabel="Billing records"
              columns={[
                { key: "id", label: "Billing ID" },
                { key: "tenant", label: "Tenant" },
                { key: "room", label: "Room", className: "text-center" },
                { key: "period", label: "Period", className: "text-center", headerClassName: "whitespace-nowrap" },
                { key: "due", label: "Billed", className: "text-right" },
                { key: "paid", label: "Paid", className: "text-right" },
                { key: "balance", label: "Balance", className: "text-right" },
                { key: "status", label: "Status", className: "text-center" },
              ]}
              rows={rows.map((row) => (
              <tr key={row.billing_id} className="border-t border-stone-100 hover:bg-stone-50 transition-colors duration-100">
                  <td className="px-6 py-4"><ResourceIdCell id={row.billing_id} prefix="BILL" /></td>
                  <td className="px-6 py-4 text-xs font-bold text-stone-900">{row.tenant_name}</td>
                  <td className="px-6 py-4 text-center">
                    <div className="font-mono text-[10px] font-black uppercase tracking-tighter text-stone-500 leading-tight">{row.room_code}</div>
                    <ResourceIdCell id={row.room_id} prefix="ROOM" />
                  </td>
                  <td className="px-6 py-4 text-center text-[10px] font-medium text-stone-400">{formatDateString(row.billing_period_from)} – {formatDateString(row.billing_period_to)}</td>
                  <td className="px-6 py-4 text-right">
                    <CurrencyDisplay amount={row.amount_due} className="text-xs font-bold text-stone-900" />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <CurrencyDisplay amount={row.amount_paid} className="text-xs font-bold text-teal-700" />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <CurrencyDisplay amount={row.outstanding_balance} className="text-xs font-bold text-rose-800" />
                  </td>
                  <td className="px-6 py-4 text-center"><StatusBadge>{row.status}</StatusBadge></td>
              </tr>
              ))}
              emptyTitle="No billing records found"
              emptyDescription="Adjust your date filters or clear the range to check for billing records."
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
