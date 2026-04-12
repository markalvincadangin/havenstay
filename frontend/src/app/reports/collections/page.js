"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
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
import { Field, Input, Select } from "../../_components/ui/Fields";
import PageHeader from "../../_components/ui/PageHeader";
import Spinner from "../../_components/ui/Spinner";
import UserRoleBadge from "../../_components/ui/UserRoleBadge";
import { KpiCard } from "../../_components/ui/KpiCard";
import { Table } from "../../_components/ui/Table";
import { METHOD_LABELS } from "../../../lib/constants";
import { TrendingUp, Search, Calendar, Landmark, DollarSign } from "lucide-react";
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
  const value = query.toString();
  return value ? `?${value}` : "";
}

export default function CollectionsPerformanceReportPage() {
  const { user: currentUser, authLoading } = useAuthGuard();
  const [loading, setLoading] = useState(true);
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

  const loadReport = useCallback(async () => {
    const extra = {};
    if (appliedFilters.start_date) extra.start_date = appliedFilters.start_date;
    if (appliedFilters.end_date) extra.end_date = appliedFilters.end_date;
    if (appliedFilters.payment_method) extra.payment_method = appliedFilters.payment_method;
    const qs = buildReportListQuery(page, perPage, extra);
    const data = await apiRequest(`/api/reports/collections-performance${qs}`, { method: "GET" });
    setReport(data);
    setTableMeta(normalizeReportRows(data, "rows").meta);
  }, [appliedFilters, page, perPage]);

  useEffect(() => {
    if (authLoading || !currentUser) return;

    if (!canViewReports(currentUser)) {
      setApiError("Unauthorized: you do not have permission to view performance reports.");
      setLoading(false);
      return;
    }

    const fetchReport = async () => {
      try {
        await loadReport();
      } catch (error) {
        setApiError(flattenApiErrors(error));
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [authLoading, currentUser, loadReport]);

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
      const query = buildQuery(appliedFilters);
      const stamp = new Date().toISOString().slice(0, 10);
      await downloadCsvWithAuth(`/api/reports/collections-performance/export${query}`, `collections-performance-report-${stamp}.csv`);
    } catch (error) {
      setApiError(flattenApiErrors(error));
    } finally {
      setExporting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <AppMain>
        <Spinner label="Loading collection history..." />
      </AppMain>
    );
  }

  const rows = Array.isArray(report.rows) ? report.rows : [];
  const totalRecords = tableMeta?.total ?? rows.length;
  const timestampLabel = `Generated ${formatReportTimestamp()} • ${totalRecords} records`;

  return (
    <AppMain>
      <PageHeader
        title="Collections Performance"
        subtitle={timestampLabel}
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: "Reports", href: "/reports" },
              { label: "Collections" },
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
              disabled={exporting}
              className="!h-11 rounded-xl px-8 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-teal-900/10"
            >
              Export CSV
            </Button>
          </div>
        }
      />

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <KpiCard 
          label="Total Payments" 
          value={report.summary?.payment_count ?? 0}
          icon={TrendingUp}
          sub="Transactions processed"
        />
        <KpiCard 
          label="Total Collected" 
          value={formatPHP(report.summary?.total_collected)}
          icon={DollarSign}
          sub="Authoritative cash-flow"
        />
      </div>

      <Card className="mt-8 overflow-hidden border-stone-200 !p-0 shadow-sm rounded-2xl bg-white">
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
            <Field label="From Date" icon={Calendar}>
                <Input
                type="date"
                value={filters.start_date}
                onChange={(event) =>
                    setFilters((prev) => ({ ...prev, start_date: event.target.value }))
                }
                className="!h-11 border-stone-200"
                />
            </Field>
            <Field label="To Date" icon={Calendar}>
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
            <Alert variant="error" className="mt-6" title="Sync Issue">
                {apiError}
            </Alert>
            ) : null}
        </div>
      </Card>

      <Card className="mt-8 overflow-hidden border-stone-200 !p-0 shadow-sm rounded-2xl">
        <Table
            embedded={true}
            caption="Collection records"
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
                  PAY-{String(row.payment_id).padStart(6, "0")}
                </td>
                <td className="px-6 py-4 text-xs font-medium text-stone-600">{formatDateString(row.payment_date)}</td>
                <td className="px-6 py-4 text-right font-mono text-xs tabular-nums font-bold text-teal-700">{formatPHP(row.amount_paid)}</td>
                <td className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-stone-500">
                {METHOD_LABELS[row.payment_method.toLowerCase()] || row.payment_method}
                </td>
                <td className="px-6 py-4 font-mono text-[10px] text-stone-400 uppercase">{row.reference_number || "—"}</td>
                <td className="px-6 py-4 text-xs font-bold text-stone-900">{row.tenant_name}</td>
                <td className="px-6 py-4 font-mono text-[10px] font-black uppercase tracking-tighter text-stone-500">{row.room_code}</td>
                <td className="px-6 py-4">
                  <Link
                    href={`/billing/${row.billing_id}`}
                    className="font-mono text-[10px] font-bold uppercase tracking-tighter text-teal-600 hover:text-teal-900"
                  >
                    #BILL-{row.billing_id}
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
          disabled={false}
        />
      </Card>
    </AppMain>
  );
}
