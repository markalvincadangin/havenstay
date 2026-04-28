"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { fetcher } from "@/lib/api";
import useSWR from "swr";
import { canViewReports } from "@/lib/auth";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { flattenApiErrors } from "@/lib/errors";
import { exportReportCsv } from "@/lib/downloads";
import { formatDateString } from "@/lib/formatters";
import CurrencyDisplay from "@/components/ui/CurrencyDisplay";
import { useToasts } from "@/context/ToastContext";
import Alert from "@/components/ui/Alert";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import FilterChips from "@/components/ui/FilterChips";
import { Field, Input, Select } from "@/components/ui/Fields";
import { SkeletonListPage } from "@/components/ui/Skeleton";
import { KpiCard } from "@/components/ui/KpiCard";
import { Table } from "@/components/ui/Table";
import { METHOD_LABELS } from "@/lib/constants";
import { TrendingUp, Calendar, Landmark, DollarSign } from "lucide-react";
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
import CurrencyCell from "@/components/ui/CurrencyCell";

export default function CollectionsPerformanceReportPage() {
  const { user: currentUser, authLoading, isUnauthorized } = useAuthGuard();
  const { showToast } = useToasts();
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
      setApiError("Access restricted. You don’t have permission to view this report.");
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
      showToast(flattenApiErrors(error), "error");
    } finally {
      setExporting(false);
    }
  };

  if (isUnauthorized) return null;

  const rows = normalizeReportRows(report, "rows").rows;
  const totalRecords = tableMeta?.total ?? rows.length;

  return (
    <StandardPage
      title="Collections Performance"
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
          className="hs-glass-effect"
        />
        <KpiCard
          label="Total Collected"
          value={report.summary?.total_collected}
          icon={DollarSign}
          sub="Payments received in range"
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
          message: "Adjust filters or clear date fields to check for records in inventory."
        }}
      >
        <Card className="mt-8 overflow-hidden border-stone-200 !p-0 shadow-sm rounded-2xl hs-glass-effect">
          <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/50 px-8 py-4">
            <h2 className="hs-strip-title uppercase tracking-[0.2em] text-[10px] font-black text-stone-400">Collections History</h2>
            <div className="text-[10px] font-mono font-bold text-stone-400 uppercase tracking-widest leading-none">
              {totalRecords} records matching
            </div>
          </div>
          <Table
            embedded={true}
            columns={[
              { key: "id", label: "Payment ID", className: "pl-8 w-32" },
              { key: "date", label: "Date", className: "text-center", headerClassName: "whitespace-nowrap" },
              { key: "amount", label: "Amount", className: "text-right" },
              { key: "method", label: "Method", className: "text-center" },
              { key: "reference", label: "Reference", className: "text-center" },
              { key: "tenant", label: "Tenant" },
              { key: "room", label: "Room", className: "text-center" },
              { key: "bill", label: "Billing ID", className: "text-center pr-8" },
            ]}
            rows={rows.map((row) => (
              <tr key={row.payment_id} className="border-t border-stone-100 hover:bg-stone-50 transition-colors duration-100">
                <td className="pl-8 py-5">
                  <ResourceIdCell id={row.payment_id} prefix="PAY" />
                </td>
                <td className="py-5 text-center text-xs font-bold text-stone-600">
                  {formatDateString(row.payment_date)}
                </td>
                <td className="py-5 text-right">
                  <CurrencyCell amount={Math.abs(row.amount_paid)} className="!text-teal-700" />
                </td>
                <td className="py-5 text-center">
                  <span className="text-[10px] font-black uppercase tracking-widest text-stone-500">
                    {METHOD_LABELS[String(row.payment_method || "").toLowerCase()] || row.payment_method}
                  </span>
                </td>
                <td className="py-5 text-center font-mono text-[10px] text-stone-400 uppercase tracking-tighter">
                  {row.reference_number || "—"}
                </td>
                <td className="py-5 text-xs font-bold text-stone-900 leading-tight">
                  {row.tenant_name}
                </td>
                <td className="py-5 text-center">
                  <div className="font-mono text-[10px] font-black uppercase tracking-tighter text-stone-500 leading-tight">{row.room_code}</div>
                  <ResourceIdCell id={row.room_id} prefix="ROOM" />
                </td>
                <td className="pr-8 py-5 text-center">
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
            emptyDescription="Adjust filters or clear date fields to check for records in inventory."
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
