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
import { Field, Select } from "../../_components/ui/Fields";
import PageHeader from "../../_components/ui/PageHeader";
import Spinner from "../../_components/ui/Spinner";
import UserRoleBadge from "../../_components/ui/UserRoleBadge";
import { KpiCard } from "../../_components/ui/KpiCard";
import { Table } from "../../_components/ui/Table";
import { StatusBadge } from "../../_components/ui/StatusBadge";
import { FileText, Search } from "lucide-react";
import TablePagination from "../../_components/ui/TablePagination";
import {
  buildReportListQuery,
  normalizePaginatedList,
  normalizeReportRows,
  readStoredPerPage,
} from "../../../lib/pagination";

function buildQuery(params) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== "" && value !== null && value !== undefined) query.set(key, String(value));
  });
  const value = query.toString();
  return value ? `?${value}` : "";
}

export default function ActiveContractsReportPage() {
  const { user: currentUser, authLoading } = useAuthGuard();
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [apiError, setApiError] = useState("");
  const [report, setReport] = useState({ summary: null, rows: [] });
  const [tableMeta, setTableMeta] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [filters, setFilters] = useState({ room_id: "" });
  const [appliedFilters, setAppliedFilters] = useState({ room_id: "" });
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(() => readStoredPerPage());

  const loadRooms = useCallback(async () => {
    try {
      const data = await apiRequest("/api/rooms?per_page=100", { method: "GET" });
      const rows = normalizePaginatedList(data).rows;
      setRooms(rows.sort((a, b) => String(a.room_code).localeCompare(String(b.room_code))));
    } catch {
      setRooms([]);
    }
  }, []);

  const loadReport = useCallback(async () => {
    const extra = {};
    if (appliedFilters.room_id) extra.room_id = appliedFilters.room_id;
    const qs = buildReportListQuery(page, perPage, extra);
    const data = await apiRequest(`/api/reports/active-contracts${qs}`, { method: "GET" });
    setReport(data);
    setTableMeta(normalizeReportRows(data, "rows").meta);
  }, [appliedFilters, page, perPage]);

  useEffect(() => {
    if (authLoading || !currentUser) return;
    if (!canViewReports(currentUser)) return;
    loadRooms();
  }, [authLoading, currentUser, loadRooms]);

  useEffect(() => {
    if (authLoading || !currentUser) return;

    if (!canViewReports(currentUser)) {
      setApiError("Unauthorized: you do not have permission to view reports.");
      setLoading(false);
      return;
    }

    const run = async () => {
      try {
        await loadReport();
      } catch (error) {
        setApiError(flattenApiErrors(error));
      } finally {
        setLoading(false);
      }
    };

    run();
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
      await downloadCsvWithAuth(`/api/reports/active-contracts/export${query}`, `active-contracts-${stamp}.csv`);
    } catch (error) {
      setApiError(flattenApiErrors(error));
    } finally {
      setExporting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <AppMain>
        <Spinner label="Loading active contracts…" />
      </AppMain>
    );
  }

  const rows = Array.isArray(report.rows) ? report.rows : [];
  const totalRecords = tableMeta?.total ?? rows.length;
  const timestampLabel = `Generated ${formatReportTimestamp()} • ${totalRecords} contracts`;

  const selectedRoom = appliedFilters.room_id
    ? rooms.find((r) => String(r.room_id) === String(appliedFilters.room_id))
    : null;

  return (
    <AppMain>
      <PageHeader
        title="Active contracts"
        subtitle={timestampLabel}
        breadcrumbs={
          <Breadcrumbs items={[{ label: "Reports", href: "/reports" }, { label: "Active contracts" }]} />
        }
        actions={
          <div className="flex flex-wrap items-center justify-end gap-3">
            <UserRoleBadge username={currentUser?.username} roleName={currentUser?.role?.role_name} />
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

      <p className="mt-2 max-w-3xl text-[11px] leading-relaxed text-stone-500">
        Live snapshot of <strong className="font-medium text-stone-600">active</strong> leases with room, bed, and rate.
        Complements the room occupancy summary and the per-bed status report.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard label="Active leases" value={report.summary?.contract_count ?? "—"} icon={FileText} />
      </div>

      <Card className="mt-8 overflow-hidden border-stone-200 !p-0 shadow-sm rounded-2xl">
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
            className="!h-8 px-3 text-[10px] font-bold uppercase tracking-widest text-stone-400 hover:text-teal-600"
          >
            Refresh
          </Button>
        </div>
        <div className="p-8">
          <form className="grid gap-6 sm:grid-cols-3" onSubmit={onApplyFilters}>
            <Field label="Room">
              <Select
                className="!h-11 border-stone-200"
                value={filters.room_id}
                onChange={(e) => setFilters((prev) => ({ ...prev, room_id: e.target.value }))}
              >
                <option value="">All rooms</option>
                {rooms.map((r) => (
                  <option key={r.room_id} value={String(r.room_id)}>
                    {r.room_code}
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
          <FilterChips
            className="mt-6"
            items={[
              {
                key: "room",
                label: "Room",
                value: appliedFilters.room_id
                  ? selectedRoom
                    ? selectedRoom.room_code
                    : `#${appliedFilters.room_id}`
                  : "",
                onClear: () => {
                  setFilters((prev) => ({ ...prev, room_id: "" }));
                  setAppliedFilters((prev) => ({ ...prev, room_id: "" }));
                  setPage(1);
                },
              },
            ]}
            onClearAll={() => {
              setFilters({ room_id: "" });
              setAppliedFilters({ room_id: "" });
              setPage(1);
            }}
          />
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
          caption="Active contract rows"
          ariaLabel="Active contracts report"
          columns={[
            { key: "tenant", label: "Tenant" },
            { key: "room", label: "Room" },
            { key: "bed", label: "Bed label" },
            { key: "move_in", label: "Move-in" },
            { key: "rate", label: "Monthly rate", className: "text-right" },
            { key: "bed_st", label: "Bed status" },
            { key: "contract", label: "Contract ID", className: "text-right" },
          ]}
          rows={rows.map((row) => (
            <tr key={row.contract_id} className="border-t border-stone-100 hover:bg-stone-50 transition-colors duration-100">
              <td className="px-6 py-4 text-xs font-bold text-stone-900">{row.tenant_name}</td>
              <td className="px-6 py-4 font-mono text-[10px] font-black uppercase tracking-tighter text-stone-500">
                {row.room_code}
              </td>
              <td className="px-6 py-4 text-xs text-stone-700">{row.bed_label}</td>
              <td className="px-6 py-4 text-[10px] font-medium text-stone-500">{formatDateString(row.move_in_date)}</td>
              <td className="px-6 py-4 text-right font-mono text-xs tabular-nums text-stone-900">{formatPHP(row.monthly_rate)}</td>
              <td className="px-6 py-4">
                <StatusBadge>{row.bed_status}</StatusBadge>
              </td>
              <td className="px-6 py-4 text-right">
                <Link
                  href={`/contracts/${row.contract_id}`}
                  className="font-mono text-[10px] font-black text-teal-600 hover:text-teal-900"
                >
                  #CONTRACT-{row.contract_id}
                </Link>
              </td>
            </tr>
          ))}
          emptyTitle="No active contracts"
          emptyDescription="No rows match the filter, or there are no active leases in the system."
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
