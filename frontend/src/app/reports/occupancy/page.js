"use client";

import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../../../lib/api";
import { canViewReports } from "../../../lib/auth";
import { useAuthGuard } from "../../../hooks/useAuthGuard";
import { downloadCsvWithAuth } from "../../../lib/downloads";
import { flattenApiErrors } from "../../../lib/errors";
import { formatReportTimestamp } from "../../../lib/formatters";
import Alert from "../../_components/ui/Alert";
import { AppMain } from "../../_components/ui/AppShell";
import Breadcrumbs from "../../_components/ui/Breadcrumbs";
import Button from "../../_components/ui/Button";
import { Card } from "../../_components/ui/Card";
import FilterChips from "../../_components/ui/FilterChips";
import { Field, Select } from "../../_components/ui/Fields";
import PageHeader from "../../_components/ui/PageHeader";
import { SkeletonListPage } from "../../_components/ui/Skeleton";
import UserRoleBadge from "../../_components/ui/UserRoleBadge";
import { KpiCard } from "../../_components/ui/KpiCard";
import { Table } from "../../_components/ui/Table";
import { StatusBadge } from "../../_components/ui/StatusBadge";
import TablePagination from "../../_components/ui/TablePagination";
import { ROOM_TYPE_LABELS } from "../../../lib/constants";
import {
  buildReportListQuery,
  normalizeReportRows,
  readStoredPerPage,
} from "../../../lib/pagination";
import { BarChart3, Home, Users, CheckCircle, Search } from "lucide-react";

export default function OccupancyReportPage() {
  const { user: currentUser, authLoading } = useAuthGuard();
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [apiError, setApiError] = useState("");
  const [apiUnavailable, setApiUnavailable] = useState(false);
  const [report, setReport] = useState({ summary: null, rows: [] });
  const [tableMeta, setTableMeta] = useState(null);
  const [roomTypeFilter, setRoomTypeFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(() => readStoredPerPage());

  const loadReport = useCallback(async () => {
    const extra = {};
    if (roomTypeFilter !== "all") {
      extra.room_type = roomTypeFilter;
    }
    const qs = buildReportListQuery(page, perPage, extra);
    const data = await apiRequest(`/api/reports/occupancy${qs}`, { method: "GET" });
    setReport(data);
    setTableMeta(normalizeReportRows(data, "rows").meta);
  }, [page, perPage, roomTypeFilter]);

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

  const { rows } = normalizeReportRows(report, "rows");

  const onExport = async () => {
    if (apiUnavailable) return;
    setApiError("");
    setExporting(true);
    try {
      const p = new URLSearchParams();
      if (roomTypeFilter !== "all") {
        p.set("room_type", roomTypeFilter);
      }
      const exportQs = p.toString() ? `?${p.toString()}` : "";
      const stamp = new Date().toISOString().slice(0, 10);
      await downloadCsvWithAuth(`/api/reports/occupancy/export${exportQs}`, `occupancy-report-${stamp}.csv`);
    } catch (error) {
      setApiError(flattenApiErrors(error));
    } finally {
      setExporting(false);
    }
  };

  if (authLoading || loading) {
    return <SkeletonListPage rows={8} />;
  }

  const totalRecords = tableMeta?.total ?? rows.length;
  const timestampLabel = `Generated ${formatReportTimestamp()} • ${totalRecords} records`;

  return (
    <AppMain>
      <PageHeader
        title="Occupancy Report"
        subtitle={timestampLabel}
        breadcrumbs={<Breadcrumbs items={[{ label: "Reports", href: "/reports" }, { label: "Occupancy" }]} />}
        actions={(
          <div className="flex flex-wrap items-center justify-end gap-3">
            <UserRoleBadge username={currentUser?.username} roleName={currentUser?.role?.role_name} />
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
        )}
      />

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total Rooms" value={report.summary?.total_rooms ?? "—"} icon={Home} />
        <KpiCard label="Total Beds" value={report.summary?.total_beds ?? "—"} icon={BarChart3} />
        <KpiCard label="Occupied Beds" value={report.summary?.occupied_beds ?? "—"} icon={Users} />
        <KpiCard
          label="Occupancy Rate"
          value={report.summary?.total_beds ? `${Math.round((report.summary.occupied_beds / report.summary.total_beds) * 100)}%` : "0%"}
          progress={report.summary?.total_beds ? (report.summary.occupied_beds / report.summary.total_beds) * 100 : 0}
          icon={CheckCircle}
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
          <Button
            type="button"
            variant="ghost"
            onClick={() => loadReport()}
            disabled={apiUnavailable}
            className="!h-8 px-3 text-[10px] font-bold uppercase tracking-widest text-stone-400 hover:text-teal-600"
          >
            Refresh
          </Button>
        </div>

        <div className="p-8">
          <div className="grid gap-6 sm:grid-cols-4">
            <Field label="Filter by Room Type">
              <Select
                value={roomTypeFilter}
                onChange={(event) => {
                  setRoomTypeFilter(event.target.value);
                  setPage(1);
                }}
                disabled={apiUnavailable}
                className="!h-11"
              >
                <option value="all">All Room Types</option>
                {Object.entries(ROOM_TYPE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          {roomTypeFilter !== "all" && (
            <div className="mt-6">
              <FilterChips
                items={[
                  {
                    key: "room_type",
                    label: "Room type",
                    value: roomTypeFilter !== "all" ? roomTypeFilter : "",
                    onClear: () => {
                      setRoomTypeFilter("all");
                      setPage(1);
                    },
                  },
                ]}
                onClearAll={() => {
                  setRoomTypeFilter("all");
                  setPage(1);
                }}
              />
            </div>
          )}

          {apiUnavailable ? (
            <Alert variant="info" className="mt-6" title="Report unavailable">
              The occupancy report endpoint did not respond. Check API configuration and try again.
            </Alert>
          ) : null}
          {apiError ? <Alert variant="error" className="mt-6" title="Sync Issue">{apiError}</Alert> : null}
        </div>
      </Card>

      <Card className="mt-8 overflow-hidden border-stone-200 !p-0 shadow-sm rounded-2xl">
        <Table
          embedded={true}
          caption="Occupancy records"
          ariaLabel="Bed utilization records"
          columns={[
            { key: "room", label: "Room" },
            { key: "type", label: "Room type" },
            { key: "beds", label: "Beds (total)", className: "text-right" },
            { key: "occupied", label: "Occupied", className: "text-right" },
            { key: "vacant", label: "Vacant", className: "text-right" },
            { key: "rate", label: "Occupancy %", className: "text-right" },
          ]}
          rows={rows.map((row) => (
            <tr key={row.room_id} className="border-t border-stone-100 hover:bg-stone-50 transition-colors duration-100">
              <td className="px-6 py-4">
                <div className="font-mono text-sm font-black uppercase leading-none tracking-tight text-stone-900">
                  {row.room_code}
                </div>
                {row.room_id != null ? (
                  <div className="mt-0.5 font-mono text-[10px] font-bold uppercase tracking-tighter text-stone-400 tabular-nums">
                    #ROOM-{row.room_id}
                  </div>
                ) : null}
              </td>
              <td className="px-6 py-4">
                <StatusBadge>{row.room_type}</StatusBadge>
              </td>
              <td className="px-6 py-4 text-right font-mono text-xs tabular-nums text-stone-500">{row.total_beds}</td>
              <td className="px-6 py-4 text-right font-mono text-xs tabular-nums text-teal-700 font-bold">{row.occupied_beds}</td>
              <td className="px-6 py-4 text-right font-mono text-xs tabular-nums text-rose-700 font-bold">{row.vacant_beds}</td>
              <td className="px-6 py-4">
                <div className="flex items-center justify-end gap-3">
                  <div className="h-1.5 w-16 rounded-full bg-stone-100 overflow-hidden">
                    <div className="h-full bg-teal-500" style={{ width: `${row.occupancy_rate}%` }} />
                  </div>
                  <span className="font-mono text-[11px] font-bold tabular-nums text-stone-900">{row.occupancy_rate}%</span>
                </div>
              </td>
            </tr>
          ))}
          emptyTitle="No occupancy records found"
          emptyDescription="Try adjusting your filters or search keywords to refine the results."
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
