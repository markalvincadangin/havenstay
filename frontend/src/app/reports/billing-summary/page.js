"use client";

import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../../../lib/api";
import { canViewReports } from "../../../lib/auth";
import { useAuthGuard } from "../../../hooks/useAuthGuard";
import { downloadCsvWithAuth } from "../../../lib/downloads";
import { flattenApiErrors } from "../../../lib/errors";
import { formatDateString, formatPHP, formatReportTimestamp } from "../../../lib/formatters";
import Alert from "../../_components/ui/Alert";
import { AppMain } from "../../_components/ui/AppShell";
import Breadcrumbs from "../../_components/ui/Breadcrumbs";
import Button from "../../_components/ui/Button";
import { Card } from "../../_components/ui/Card";
import FilterChips from "../../_components/ui/FilterChips";
import { Field, Input } from "../../_components/ui/Fields";
import PageHeader from "../../_components/ui/PageHeader";
import Spinner from "../../_components/ui/Spinner";
import UserRoleBadge from "../../_components/ui/UserRoleBadge";
import { KpiCard } from "../../_components/ui/KpiCard";
import { Table } from "../../_components/ui/Table";
import { StatusBadge } from "../../_components/ui/StatusBadge";
import { Receipt, Search, Calendar, Landmark, DollarSign, Activity } from "lucide-react";
import TablePagination from "../../_components/ui/TablePagination";
import {
  buildReportListQuery,
  normalizeReportRows,
  readStoredPerPage,
} from "../../../lib/pagination";

function buildQuery(params) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  const queryString = query.toString();
  return queryString ? `?${queryString}` : "";
}

export default function BillingSummaryReportPage() {
  const { user: currentUser, authLoading } = useAuthGuard();
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [apiError, setApiError] = useState("");
  const [apiUnavailable, setApiUnavailable] = useState(false);
  const [report, setReport] = useState({ summary: null, rows: [] });
  const [tableMeta, setTableMeta] = useState(null);
  const [filters, setFilters] = useState({ start_date: "", end_date: "" });
  const [appliedFilters, setAppliedFilters] = useState({ start_date: "", end_date: "" });
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(() => readStoredPerPage());

  const loadReport = useCallback(async () => {
    const extra = {};
    if (appliedFilters.start_date) extra.start_date = appliedFilters.start_date;
    if (appliedFilters.end_date) extra.end_date = appliedFilters.end_date;
    const qs = buildReportListQuery(page, perPage, extra);
    const data = await apiRequest(`/api/reports/billing-summary${qs}`, { method: "GET" });
    setReport(data);
    setTableMeta(normalizeReportRows(data, "rows").meta);
  }, [appliedFilters, page, perPage]);

  useEffect(() => {
    if (authLoading || !currentUser) return;

    if (!canViewReports(currentUser)) {
      setApiError("Unauthorized: you do not have permission to view reports.");
      setLoading(false);
      return;
    }

    const fetchReport = async () => {
      try {
        setApiUnavailable(false);
        await loadReport();
      } catch (error) {
        if (error?.status === 404) {
          setApiUnavailable(true);
          setApiError("");
          setReport({ summary: null, rows: [] });
          setTableMeta(null);
        } else {
          setApiError(flattenApiErrors(error));
        }
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [authLoading, currentUser, loadReport]);

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
      const query = buildQuery(appliedFilters);
      const stamp = new Date().toISOString().slice(0, 10);
      await downloadCsvWithAuth(`/api/reports/billing-summary/export${query}`, `billing-summary-report-${stamp}.csv`);
    } catch (error) {
      setApiError(flattenApiErrors(error));
    } finally {
      setExporting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <AppMain>
        <Spinner label="Assembling billing data..." />
      </AppMain>
    );
  }

  const rows = Array.isArray(report.rows) ? report.rows : [];
  const totalRecords = tableMeta?.total ?? rows.length;
  const timestampLabel = `Generated ${formatReportTimestamp()} • ${totalRecords} records`;

  return (
    <AppMain>
      <PageHeader
        title="Billing Summary"
        subtitle={timestampLabel}
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: "Reports", href: "/reports" },
              { label: "Billing Summary" },
            ]}
          />
        }
        actions={
          <div className="flex flex-wrap items-center justify-end gap-3">
            <UserRoleBadge
              username={currentUser?.username}
              roleName={currentUser?.role?.role_name}
            />
            <Button
              type="button"
              variant="primary"
              onClick={onExport}
              loading={exporting}
              disabled={exporting || apiUnavailable}
              className="!h-11 rounded-xl px-8 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-teal-900/10"
            >
              Export CSV
            </Button>
          </div>
        }
      />

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard 
           label="Total Bills" 
           value={report.summary?.billing_count ?? 0}
           icon={Activity}
        />
        <KpiCard 
           label="Billed Amount" 
           value={formatPHP(report.summary?.billed_total)}
           icon={Receipt}
        />
        <KpiCard 
           label="Collected Amount" 
           value={formatPHP(report.summary?.collected_total)}
           icon={DollarSign}
        />
        <KpiCard 
           label="Outstanding Amount" 
           value={formatPHP(report.summary?.outstanding_total)}
           isDanger={report.summary?.outstanding_total > 0}
           icon={Landmark}
        />
      </div>

      <Card className="mt-8 overflow-hidden border-stone-200 !p-0 shadow-sm rounded-2xl">
        <div className="border-b border-stone-100 bg-stone-50/50 px-8 py-5 flex items-center justify-between">
           <div className="flex items-center gap-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50 text-teal-600 shadow-sm border border-teal-100/50">
                 <Search size={14} />
              </div>
              <h3 className="hs-strip-title uppercase tracking-widest text-xs font-black text-stone-900">Filters</h3>
           </div>
           <Button type="button" variant="ghost" onClick={() => loadReport()} className="!h-8 px-3 text-[10px] font-bold uppercase tracking-widest text-stone-400 hover:text-teal-600">
              Refresh
           </Button>
        </div>

        <div className="p-8">
            <form
            className="grid gap-6 sm:grid-cols-4"
            onSubmit={onApplyFilters}
            >
            <Field label="Start Date" icon={Calendar}>
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
            <Field label="End Date" icon={Calendar}>
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
        </div>
      </Card>

      <Card className="mt-8 overflow-hidden border-stone-200 !p-0 shadow-sm rounded-2xl">
        <Table
            embedded={true}
            caption="Billing Summary"
            ariaLabel="Billing records"
            columns={[
            { key: "id", label: "Billing ID" },
            { key: "tenant", label: "Tenant" },
            { key: "room", label: "Room" },
            { key: "period", label: "Billing period" },
            { key: "due", label: "Amount due", className: "text-right" },
            { key: "paid", label: "Amount paid", className: "text-right" },
            { key: "balance", label: "Balance", className: "text-right" },
            { key: "status", label: "Status" },
            ]}
            rows={rows.map((row) => (
            <tr key={row.billing_id} className="border-t border-stone-100 hover:bg-stone-50 transition-colors duration-100">
                <td className="px-6 py-4 font-mono text-[10px] font-bold uppercase tracking-tighter text-stone-400 tabular-nums">#BILL-{row.billing_id}</td>
                <td className="px-6 py-4 text-xs font-bold text-stone-900">{row.tenant_name}</td>
                <td className="px-6 py-4 font-mono text-[10px] font-black uppercase tracking-tighter text-stone-500">{row.room_code}</td>
                <td className="px-6 py-4 text-[10px] font-medium text-stone-400">{formatDateString(row.billing_period_from)} – {formatDateString(row.billing_period_to)}</td>
                <td className="px-6 py-4 text-right font-mono text-xs tabular-nums text-stone-900 font-bold">{formatPHP(row.amount_due)}</td>
                <td className="px-6 py-4 text-right font-mono text-xs tabular-nums text-teal-700 font-bold">{formatPHP(row.amount_paid)}</td>
                <td className="px-6 py-4 text-right font-mono text-xs tabular-nums font-black text-rose-800">{formatPHP(row.outstanding_balance)}</td>
                <td className="px-6 py-4"><StatusBadge>{row.status}</StatusBadge></td>
            </tr>
            ))}
            emptyTitle="No billing records found"
            emptyDescription="Adjust your date filters or clear the range to view all records."
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
          disabled={false}
        />
      </Card>
    </AppMain>
  );
}
