"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { fetcher } from "../../../lib/api";
import useSWR from "swr";
import { canViewReports } from "../../../lib/auth";
import { useAuthGuard } from "../../../hooks/useAuthGuard";
import { flattenApiErrors } from "../../../lib/errors";
import { daysPastDue, isPastDueReceivable } from "../../../lib/billingReceivables";
import { exportReportCsv } from "../../../lib/reports";
import TablePagination from "../../_components/ui/TablePagination";
import ResourceView from "../../_components/ui/ResourceView";
import {
  buildReportListQuery,
  normalizePaginatedList,
  normalizeReportRows,
  readStoredPerPage,
} from "../../../lib/pagination";
import { formatDateString, formatPHP, formatReportTimestamp } from "../../../lib/formatters";
import Alert from "../../_components/ui/Alert";
import Breadcrumbs from "../../_components/ui/Breadcrumbs";
import Button from "../../_components/ui/Button";
import { Card } from "../../_components/ui/Card";
import FilterChips from "../../_components/ui/FilterChips";
import { Field, Input, Select } from "../../_components/ui/Fields";
import { SkeletonListPage } from "../../_components/ui/Skeleton";
import Spinner from "../../_components/ui/Spinner";
import { KpiCard } from "../../_components/ui/KpiCard";
import { Table } from "../../_components/ui/Table";
import { StatusBadge } from "../../_components/ui/StatusBadge";
import StandardPage from "../../_components/ui/StandardPage";
import ReportHeaderActions from "../../_components/ui/ReportHeaderActions";
import ReportFilterCard from "../../_components/ui/ReportFilterCard";
import ResourceIdCell from "../../_components/ui/ResourceIdCell";
import { AlertCircle, Users, Calendar, Clock, AlertTriangle } from "lucide-react";

export default function OutstandingBalancesReportPage() {
  const { user: currentUser, authLoading, isUnauthorized } = useAuthGuard();
  const [exporting, setExporting] = useState(false);
  const [apiError, setApiError] = useState("");
  const [apiUnavailable, setApiUnavailable] = useState(false);
  const [report, setReport] = useState({ summary: null, rows: [] });
  const [tableMeta, setTableMeta] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [filters, setFilters] = useState({ tenant_id: "", due_from: "", due_to: "" });
  const [appliedFilters, setAppliedFilters] = useState({ tenant_id: "", due_from: "", due_to: "" });
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(() => readStoredPerPage());

  const { data: tenantsData } = useSWR(
    !authLoading && currentUser && canViewReports(currentUser) ? "/api/tenants?per_page=100" : null,
    fetcher
  );

  useEffect(() => {
    if (tenantsData) {
      const rows = normalizePaginatedList(tenantsData).rows;
      setTenants(rows.sort((a, b) => String(a.last_name).localeCompare(String(b.last_name))));
    }
  }, [tenantsData]);

  const reportQs = useMemo(() => {
    const extra = {};
    if (appliedFilters.tenant_id) extra.tenant_id = appliedFilters.tenant_id;
    if (appliedFilters.due_from) extra.due_from = appliedFilters.due_from;
    if (appliedFilters.due_to) extra.due_to = appliedFilters.due_to;
    return buildReportListQuery(page, perPage, extra);
  }, [appliedFilters, page, perPage]);

  const { data: reportData, error: reportError, mutate: loadReport, isValidating } = useSWR(
    !authLoading && currentUser && canViewReports(currentUser) ? `/api/reports/outstanding-balances${reportQs}` : null,
    fetcher,
    { keepPreviousData: true }
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
      setApiError("Unauthorized: you do not have permission to view reports.");
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
        endpoint: "/api/reports/outstanding-balances/export",
        filters: appliedFilters,
        filenamePrefix: "outstanding-balances-report",
      });
    } catch (error) {
      setApiError(flattenApiErrors(error));
    } finally {
      setExporting(false);
    }
  };

  const rows = normalizeReportRows(report, "rows").rows;
  const totalRecords = tableMeta?.total ?? rows.length;
  const pastDueAmount = Number(report.summary?.past_due_amount ?? 0);
  const pastDueCount = Number(report.summary?.past_due_count ?? 0);
  const oldestPastDueDays = Number(report.summary?.oldest_past_due_days ?? 0);

  const selectedTenantLabel = appliedFilters.tenant_id
    ? tenants.find((t) => String(t.tenant_id) === String(appliedFilters.tenant_id))
    : null;

  if (isUnauthorized) return null;

  const timestampLabel = `Generated ${formatReportTimestamp()} • ${totalRecords} records`;

  return (
    <StandardPage
      title="Outstanding Balances"
      subtitle={timestampLabel}
      loading={authLoading || loading}
      skeleton={<Spinner label="Auditing balances..." />}
      breadcrumbs={
        <Breadcrumbs
          items={[
            { label: "Reports", href: "/reports" },
            { label: "Outstanding Balances" },
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
           label="Total Outstanding" 
           value={formatPHP(report.summary?.total_outstanding)}
           icon={AlertCircle}
           isSyncing={isValidating}
        />
        <KpiCard 
           label="Past-Due Balance" 
           value={formatPHP(pastDueAmount)}
           isDanger={pastDueAmount > 0}
           icon={AlertTriangle}
           sub="Immediate action required"
           isSyncing={isValidating}
        />
        <KpiCard 
           label="Past-Due Accounts" 
           value={pastDueCount}
           isDanger={pastDueCount > 0}
           icon={Users}
           isSyncing={isValidating}
        />
        <KpiCard 
           label="Oldest Past Due" 
           value={oldestPastDueDays > 0 ? `${oldestPastDueDays} days` : "—"}
           isDanger={oldestPastDueDays > 30}
           icon={Clock}
           isSyncing={isValidating}
        />
      </div>

      <ReportFilterCard onRefresh={() => loadReport()}>
            <form
            className="grid gap-6 sm:grid-cols-4"
            onSubmit={onApplyFilters}
            >
            <Field label="Tenant" icon={Users}>
                <Select
                className="!h-11 border-stone-200"
                value={filters.tenant_id}
                disabled={apiUnavailable}
                onChange={(event) =>
                    setFilters((prev) => ({ ...prev, tenant_id: event.target.value }))
                }
                >
                <option value="">All Tenants</option>
                {tenants.map((t) => (
                    <option key={t.tenant_id} value={String(t.tenant_id)}>
                    {t.last_name}, {t.first_name} ({t.tenant_id})
                    </option>
                ))}
                </Select>
            </Field>
            <Field label="Due From" icon={Calendar}>
                <Input
                type="date"
                value={filters.due_from}
                disabled={apiUnavailable}
                onChange={(event) =>
                    setFilters((prev) => ({ ...prev, due_from: event.target.value }))
                }
                className="!h-11"
                />
            </Field>
            <Field label="Due To" icon={Calendar}>
                <Input
                type="date"
                value={filters.due_to}
                disabled={apiUnavailable}
                onChange={(event) =>
                    setFilters((prev) => ({ ...prev, due_to: event.target.value }))
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
                    key: "tenant_id",
                    label: "Tenant",
                    value: appliedFilters.tenant_id
                        ? selectedTenantLabel
                        ? `${selectedTenantLabel.last_name}, ${selectedTenantLabel.first_name}`
                        : `#${appliedFilters.tenant_id}`
                        : "",
                    onClear: () => {
                      setFilters((prev) => ({ ...prev, tenant_id: "" }));
                      setAppliedFilters((prev) => ({ ...prev, tenant_id: "" }));
                      setPage(1);
                    },
                    },
                    {
                    key: "due_from",
                    label: "From",
                    value: appliedFilters.due_from,
                    onClear: () => {
                      setFilters((prev) => ({ ...prev, due_from: "" }));
                      setAppliedFilters((prev) => ({ ...prev, due_from: "" }));
                      setPage(1);
                    },
                    },
                    {
                    key: "due_to",
                    label: "To",
                    value: appliedFilters.due_to,
                    onClear: () => {
                      setFilters((prev) => ({ ...prev, due_to: "" }));
                      setAppliedFilters((prev) => ({ ...prev, due_to: "" }));
                      setPage(1);
                    },
                    },
                ]}
                onClearAll={() => {
                  const cleared = { tenant_id: "", due_from: "", due_to: "" };
                  setFilters(cleared);
                  setAppliedFilters(cleared);
                  setPage(1);
                }}
                />
            </div>

            {apiUnavailable ? (
            <Alert
                variant="info"
                className="mt-6"
                title="Report unavailable"
            >
                The outstanding balances endpoint did not respond. Check API configuration and try again.
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
          title: "No outstanding balances found",
          message: "Adjust your filters or clear date fields to view all records."
        }}
      >
      <Card className="mt-8 overflow-hidden border-stone-200 !p-0 shadow-sm rounded-2xl">
        <Table
            embedded={true}
            caption="Outstanding Balances"
            ariaLabel="Outstanding balance records"
            columns={[
            { key: "billing_id", label: "Billing ID", className: "w-32" },
            { key: "tenant", label: "Tenant" },
            { key: "room", label: "Room" },
            { key: "period", label: "Billing period" },
            { key: "dueDate", label: "Due" },
            { key: "daysOverdue", label: "Aging (days)" },
            { key: "balance", label: "Balance", className: "text-right" },
            { key: "status", label: "Status" },
            { key: "actions", label: "", className: "text-right w-16" },
            ]}
            rows={rows.map((row) => {
                const daysOverdue = daysPastDue(row.due_date);
                const isPastDue = isPastDueReceivable(row);
                return (
                    <tr key={row.billing_id} className="border-t border-stone-100 hover:bg-stone-50 transition-colors duration-100">
                        <td className="px-6 py-4 font-mono text-[10px] font-bold uppercase tracking-tighter text-stone-400 tabular-nums">
                          <ResourceIdCell id={row.billing_id} prefix="BILL" />
                        </td>
                        <td className="px-6 py-4 text-xs font-bold text-stone-900">{row.tenant_name}</td>
                        <td className="px-6 py-4 font-mono text-[10px] font-black uppercase tracking-tighter text-stone-500">{row.room_code}</td>
                        <td className="px-6 py-4 text-[10px] font-medium text-stone-400">
                            {row.billing_period_from && row.billing_period_to
                            ? `${formatDateString(row.billing_period_from)} – ${formatDateString(row.billing_period_to)}`
                            : "—"}
                        </td>
                        <td className="px-6 py-4 text-xs font-medium text-stone-600">{formatDateString(row.due_date)}</td>
                        <td className="px-6 py-4">
                            {isPastDue ? (
                            <span className="text-[10px] font-black uppercase tracking-widest text-rose-600 bg-rose-50 px-2 py-1 rounded-md border border-rose-100">
                                {daysOverdue} {daysOverdue === 1 ? "day" : "days"} late
                            </span>
                            ) : (
                            <span className="text-[10px] font-bold text-stone-300 uppercase tracking-widest">On Track</span>
                            )}
                        </td>
                        <td className="px-6 py-4 text-right">
                            {row.outstanding_balance < 0 ? (
                            <span className="font-mono text-xs tabular-nums font-bold text-emerald-700">
                                {formatPHP(Math.abs(row.outstanding_balance))} CR
                            </span>
                            ) : (
                            <span className={[
                                "font-mono text-xs tabular-nums font-black",
                                row.outstanding_balance > 0 ? "text-rose-800" : "text-stone-400"
                            ].join(" ")}>
                                {formatPHP(row.outstanding_balance)}
                            </span>
                            )}
                        </td>
                        <td className="px-6 py-4"><StatusBadge>{row.status}</StatusBadge></td>
                        <td className="px-6 py-4 text-right">
                            {row.billing_id ? (
                            <Link
                                href={`/billing/${row.billing_id}`}
                                className="text-[10px] font-black uppercase tracking-widest text-teal-600 hover:text-teal-900 px-3 py-1.5 rounded-lg border border-teal-100 hover:bg-teal-50 transition-colors"
                            >
                                View Billing
                            </Link>
                            ) : null}
                        </td>
                    </tr>
                );
            })}
            emptyTitle="No outstanding balances found"
            emptyDescription="Adjust your filters or clear date fields to view all records."
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
          <p className="mt-4 px-1 text-[11px] leading-relaxed text-stone-500">
            <strong className="text-stone-600">Aging</strong> uses calendar past-due plus a positive balance. The{" "}
            <strong className="text-stone-600">status</strong> column follows billing rules where <em>Past Due</em> means the due
            date has passed and a balance still remains; this can include both unpaid and partially paid bills.
          </p>
        </Card>
      </ResourceView>
    </StandardPage>
  );
}
