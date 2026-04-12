"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiRequest, hasAuthToken } from "../../../lib/api";
import { canViewReports, fetchCurrentUser } from "../../../lib/auth";
import Alert from "../../_components/ui/Alert";
import { AppMain } from "../../_components/ui/AppShell";
import Breadcrumbs from "../../_components/ui/Breadcrumbs";
import { Card } from "../../_components/ui/Card";
import PageHeader from "../../_components/ui/PageHeader";
import Spinner from "../../_components/ui/Spinner";
import UserRoleBadge from "../../_components/ui/UserRoleBadge";
import Button from "../../_components/ui/Button";
import FilterChips from "../../_components/ui/FilterChips";
import { Field, Input, Select } from "../../_components/ui/Fields";
import { Table } from "../../_components/ui/Table";
import { StatusBadge } from "../../_components/ui/StatusBadge";
import { downloadCsvWithAuth } from "../../../lib/downloads";
import { TENANT_HISTORY_STATUS_FILTER_LABELS } from "../../../lib/constants";
import { flattenApiErrors } from "../../../lib/errors";
import { formatDateString, formatReportTimestamp } from "../../../lib/formatters";
import { Search, Calendar, Activity, ChevronRight } from "lucide-react";
import TablePagination from "../../_components/ui/TablePagination";
import {
  buildReportListQuery,
  normalizeReportRows,
  readStoredPerPage,
} from "../../../lib/pagination";

function buildQuery(params) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value && value !== "all") query.set(key, value);
  });
  const value = query.toString();
  return value ? `?${value}` : "";
}

export default function TenantHistoryReportPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tableRefreshing, setTableRefreshing] = useState(false);
  const firstReportLoaded = useRef(false);
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

  const loadReport = useCallback(async () => {
    const extra = {};
    if (appliedFilters.from) extra.from = appliedFilters.from;
    if (appliedFilters.to) extra.to = appliedFilters.to;
    if (appliedFilters.status && appliedFilters.status !== "all") {
      extra.status = appliedFilters.status;
    }
    const qs = buildReportListQuery(page, perPage, extra);
    const data = await apiRequest(`/api/reports/tenant-history${qs}`, { method: "GET" });
    setReport(data);
    setTableMeta(normalizeReportRows(data, "rows").meta);
  }, [appliedFilters, page, perPage]);

  useEffect(() => {
    const bootstrap = async () => {
      if (!hasAuthToken()) {
        router.replace("/login");
        return;
      }

      try {
        const user = await fetchCurrentUser();
        setCurrentUser(user);

        if (!canViewReports(user)) {
          setApiError("Unauthorized: you do not have permission to view history reports.");
          setLoading(false);
        }
      } catch (err) {
        setApiError(flattenApiErrors(err));
        setLoading(false);
      }
    };

    bootstrap();
  }, [router]);

  useEffect(() => {
    if (!currentUser || !canViewReports(currentUser)) return;

    const run = async () => {
      if (firstReportLoaded.current) {
        setTableRefreshing(true);
      } else {
        setLoading(true);
      }
      try {
        await loadReport();
      } catch (err) {
        setApiError(flattenApiErrors(err));
      } finally {
        if (firstReportLoaded.current) {
          setTableRefreshing(false);
        } else {
          setLoading(false);
          firstReportLoaded.current = true;
        }
      }
    };

    run();
  }, [currentUser, loadReport]);

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
      await downloadCsvWithAuth(
        `/api/reports/tenant-history/export${query}`,
        `tenant-history-report-${stamp}.csv`,
      );
    } catch (error) {
      setApiError(flattenApiErrors(error));
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <AppMain>
        <Spinner label="Loading history records..." />
      </AppMain>
    );
  }

  const { rows: reportRows } = normalizeReportRows(report, "rows");
  const totalRecords = tableMeta?.total ?? reportRows.length;
  const timestampLabel = `Generated ${formatReportTimestamp()} • ${totalRecords} historical records`;

  return (
    <AppMain>
      <PageHeader
        title="Tenant History"
        subtitle={timestampLabel}
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: "Reports", href: "/reports" },
              { label: "Tenant History" },
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

      <Card className="mt-8 overflow-hidden border-stone-200 !p-0 shadow-sm rounded-2xl bg-white">
        <div className="border-b border-stone-100 bg-stone-50/50 px-8 py-5 flex items-center justify-between">
           <div className="flex items-center gap-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50 text-teal-600 shadow-sm border border-teal-100/50">
                 <Search size={14} />
              </div>
              <h3 className="hs-strip-title uppercase tracking-widest text-xs font-black text-stone-900">Filters</h3>
           </div>
           <Button
              type="button"
              variant="ghost"
              onClick={() => loadReport()}
              disabled={tableRefreshing}
              className="!h-8 px-3 text-[10px] font-bold uppercase tracking-widest text-stone-400 hover:text-teal-600"
            >
              Refresh
            </Button>
        </div>

        <div className="p-8">
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
            <p id="tenant-history-status-hint" className="mt-3 text-[11px] text-stone-500">
              Filters apply to <span className="font-semibold text-stone-600">contract</span> status and move-in dates (reporting view), not the tenant profile alone.
            </p>

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
        </div>
      </Card>

      <Card className="relative mt-8 overflow-hidden border-stone-200 !p-0 shadow-sm rounded-2xl">
        {tableRefreshing ? (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/70 backdrop-blur-[1px]"
            aria-busy="true"
            aria-live="polite"
          >
            <div className="flex flex-col items-center gap-3">
              <div
                className="h-9 w-9 animate-spin rounded-full border-2 border-teal-600/20 border-t-teal-600"
                aria-hidden
              />
              <span className="text-[10px] font-black uppercase tracking-widest text-teal-800">
                Updating results…
              </span>
            </div>
          </div>
        ) : null}
        <Table
            embedded={true}
            caption="Historical lease records"
            ariaLabel="Tenant history ledger"
            columns={[
              { key: "tenant", label: "Tenant" },
              { key: "email", label: "Email" },
              { key: "move_in", label: "Move-in" },
              { key: "move_out", label: "Move-out" },
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
                  <td className="px-6 py-4 text-[10px] font-medium text-stone-500">{formatDateString(row?.move_in_date)}</td>
                  <td className="px-6 py-4 text-[10px] font-medium text-stone-500">{formatDateString(row?.move_out_date)}</td>
                  <td className="px-6 py-4 font-mono text-[10px] font-black uppercase tracking-tighter text-teal-600">{row?.room_label || "—"}</td>
                  <td className="px-6 py-4">
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
            emptyDescription="Broaden your date range or clear filters to view historical lease data."
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
          disabled={tableRefreshing}
        />
      </Card>
    </AppMain>
  );
}
