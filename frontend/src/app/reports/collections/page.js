"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { fetcher } from "../../../lib/api";
import useSWR from "swr";
import { canViewReports } from "../../../lib/auth";
import { useAuthGuard } from "../../../hooks/useAuthGuard";
import { flattenApiErrors } from "../../../lib/errors";
import { exportReportCsv } from "../../../lib/reports";
import { formatDateString, formatPHP, formatReportTimestamp } from "../../../lib/formatters";
import Alert from "../../_components/ui/Alert";
import Breadcrumbs from "../../_components/ui/Breadcrumbs";
import Button from "../../_components/ui/Button";
import { Card } from "../../_components/ui/Card";
import FilterChips from "../../_components/ui/FilterChips";
import { Field, Input, Select } from "../../_components/ui/Fields";
import { SkeletonListPage } from "../../_components/ui/Skeleton";
import { KpiCard } from "../../_components/ui/KpiCard";
import { Table } from "../../_components/ui/Table";
import { METHOD_LABELS } from "../../../lib/constants";
import { TrendingUp, Calendar, Landmark, DollarSign } from "lucide-react";
import ResourceView from "../../_components/ui/ResourceView";
import TablePagination from "../../_components/ui/TablePagination";
import StandardPage from "../../_components/ui/StandardPage";
import {
  buildReportListQuery,
  normalizeReportRows,
  readStoredPerPage,
} from "../../../lib/pagination";
import ReportHeaderActions from "../../_components/ui/ReportHeaderActions";
import ReportFilterCard from "../../_components/ui/ReportFilterCard";
import ResourceIdCell from "../../_components/ui/ResourceIdCell";

export default function CollectionsPerformanceReportPage() {
  const { user: currentUser, authLoading, isUnauthorized } = useAuthGuard();
  const [exporting, setExporting] = useState(false);
  const [apiError, setApiError] = useState("");
  const [report, setReport] = useState({ summary: null, rows: [] });
  const [tableMeta, setTableMeta] = useState(null);
  const [filters, setFilters] = useState({ start_date: "", end_date: "", payment_method: "" });
  const [appliedFilters, setAppliedFilters] = useState({
    start_date: "",
    end_date: "",
    payment_method: "",
  });
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(() => readStoredPerPage());

  const reportQs = useMemo(() => {
    const extra = {};
    if (appliedFilters.start_date) extra.start_date = appliedFilters.start_date;
    if (appliedFilters.end_date) extra.end_date = appliedFilters.end_date;
    if (appliedFilters.payment_method) extra.payment_method = appliedFilters.payment_method;
    return buildReportListQuery(page, perPage, extra);
  }, [appliedFilters, page, perPage]);

  const { data: reportData, error: reportError, mutate: loadReport, isValidating } = useSWR(
    !authLoading && currentUser && canViewReports(currentUser) ? `/api/reports/collections-performance${reportQs}` : null,
    fetcher,
    { keepPreviousData: true }
  );

  const loading = !reportData && !reportError && !authLoading && currentUser && canViewReports(currentUser);

  useEffect(() => {
    if (reportError) {
      setApiError(flattenApiErrors(reportError));
    } else if (authLoading === false && currentUser && !canViewReports(currentUser)) {
      setApiError("Unauthorized: you do not have permission to view reports.");
    }
  }, [reportError, authLoading, currentUser]);

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
      await exportReportCsv({
        endpoint: "/api/reports/collections-performance/export",
        filters: appliedFilters,
        filenamePrefix: "collections-performance-report",
      });
    } catch (error) {
      setApiError(flattenApiErrors(error));
    } finally {
      setExporting(false);
    }
  };

  if (isUnauthorized) return null;

  const rows = normalizeReportRows(report, "rows").rows;
  const totalRecords = tableMeta?.total ?? rows.length;
  const timestampLabel = `Generated ${formatReportTimestamp()} • ${totalRecords} records`;

  return (
    <StandardPage
      title="Collections Performance"
      subtitle={timestampLabel}
      loading={authLoading || loading}
      skeleton={<SkeletonListPage rows={10} />}
      breadcrumbs={
        <Breadcrumbs
          items={[
            { label: "Reports", href: "/reports" },
            { label: "Collections Performance" },
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

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <KpiCard 
          label="Payments Recorded" 
          value={report.summary?.payment_count ?? 0}
          icon={TrendingUp}
          sub="Payment records in range"
          isSyncing={isValidating}
        />
        <KpiCard 
          label="Total Collected" 
          value={formatPHP(report.summary?.total_collected)}
          icon={DollarSign}
          sub="Payments received in range"
          isSyncing={isValidating}
        />
      </div>

      <ReportFilterCard onRefresh={() => loadReport()}>
            <form
            className="grid gap-6 sm:grid-cols-4"
            onSubmit={onApplyFilters}
            >
            <Field label="Payment From" icon={Calendar}>
                <Input
                type="date"
                value={filters.start_date}
                onChange={(event) =>
                    setFilters((prev) => ({ ...prev, start_date: event.target.value }))
                }
                className="!h-11 border-stone-200"
                />
            </Field>
            <Field label="Payment To" icon={Calendar}>
                <Input
                type="date"
                value={filters.end_date}
                onChange={(event) =>
                    setFilters((prev) => ({ ...prev, end_date: event.target.value }))
                }
                className="!h-11 border-stone-200"
                />
            </Field>
            <Field label="Payment method" icon={Landmark}>
                <Select
                value={filters.payment_method}
                onChange={(event) =>
                    setFilters((prev) => ({ ...prev, payment_method: event.target.value }))
                }
                className="!h-11 border-stone-200"
                >
                <option value="">All Methods</option>
                {Object.entries(METHOD_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                ))}
                </Select>
            </Field>
            <div className="flex items-end">
                <Button
                type="submit"
                variant="secondary"
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
                    label: "From",
                    value: appliedFilters.start_date,
                    onClear: () => {
                      setFilters((prev) => ({ ...prev, start_date: "" }));
                      setAppliedFilters((prev) => ({ ...prev, start_date: "" }));
                      setPage(1);
                    },
                    },
                    {
                    key: "end_date",
                    label: "To",
                    value: appliedFilters.end_date,
                    onClear: () => {
                      setFilters((prev) => ({ ...prev, end_date: "" }));
                      setAppliedFilters((prev) => ({ ...prev, end_date: "" }));
                      setPage(1);
                    },
                    },
                    {
                    key: "payment_method",
                    label: "Method",
                    value: appliedFilters.payment_method,
                    onClear: () => {
                      setFilters((prev) => ({ ...prev, payment_method: "" }));
                      setAppliedFilters((prev) => ({ ...prev, payment_method: "" }));
                      setPage(1);
                    },
                    },
                ]}
                onClearAll={() => {
                  const cleared = { start_date: "", end_date: "", payment_method: "" };
                  setFilters(cleared);
                  setAppliedFilters(cleared);
                  setPage(1);
                }}
                />
            </div>

            {apiError ? (
            <Alert variant="error" className="mt-6" title="Could not load report">
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
          title: "No collection records found",
          message: "Broaden your search or check your method filters to see more results."
        }}
      >
        <Card className="mt-8 overflow-hidden border-stone-200 !p-0 shadow-sm rounded-2xl">
          <Table
              embedded={true}
              caption="Collections performance records"
              ariaLabel="Collection performance records"
              columns={[
              { key: "id", label: "Payment ID" },
              { key: "date", label: "Payment date" },
              { key: "amount", label: "Amount paid", className: "text-right" },
              { key: "method", label: "Payment method" },
              { key: "reference", label: "Reference number" },
              { key: "tenant", label: "Tenant" },
              { key: "room", label: "Room" },
              { key: "bill", label: "Billing ID" },
              ]}
              rows={rows.map((row) => (
              <tr key={row.payment_id} className="border-t border-stone-100 hover:bg-stone-50 transition-colors duration-100">
                  <td className="px-6 py-4 font-mono text-[10px] font-bold uppercase tracking-tighter text-stone-400 tabular-nums">
                    <ResourceIdCell id={row.payment_id} prefix="PAY" />
                  </td>
                  <td className="px-6 py-4 text-xs font-medium text-stone-600">{formatDateString(row.payment_date)}</td>
                  <td className="px-6 py-4 text-right font-mono text-xs tabular-nums font-bold text-teal-700">{formatPHP(row.amount_paid)}</td>
                  <td className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-stone-500">
                  {METHOD_LABELS[String(row.payment_method || "").toLowerCase()] || row.payment_method}
                  </td>
                  <td className="px-6 py-4 font-mono text-[10px] text-stone-400 uppercase">{row.reference_number || "—"}</td>
                  <td className="px-6 py-4 text-xs font-bold text-stone-900">{row.tenant_name}</td>
                  <td className="px-6 py-4 font-mono text-[10px] font-black uppercase tracking-tighter text-stone-500">{row.room_code}</td>
                  <td className="px-6 py-4">
                    <Link
                      href={`/billing/${row.billing_id}`}
                      className="font-mono text-[10px] font-bold uppercase tracking-tighter text-teal-600 hover:text-teal-900"
                    >
                      <ResourceIdCell id={row.billing_id} prefix="BILL" />
                    </Link>
                  </td>
              </tr>
              ))}
              emptyTitle="No collection records found"
              emptyDescription="Broaden your search or check your method filters to see more results."
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
          />
        </Card>
      </ResourceView>
    </StandardPage>
  );
}
