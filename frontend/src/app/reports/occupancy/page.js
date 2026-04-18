"use client";

import { useEffect, useState, useMemo } from "react";
import { fetcher } from "../../../lib/api";
import useSWR from "swr";
import { canViewReports } from "../../../lib/auth";
import { useAuthGuard } from "../../../hooks/useAuthGuard";
import { flattenApiErrors } from "../../../lib/errors";
import { formatReportTimestamp } from "../../../lib/formatters";
import { exportReportCsv } from "../../../lib/reports";
import Alert from "../../_components/ui/Alert";
import Breadcrumbs from "../../_components/ui/Breadcrumbs";
import { Card } from "../../_components/ui/Card";
import FilterChips from "../../_components/ui/FilterChips";
import { Field, Select } from "../../_components/ui/Fields";
import { SkeletonListPage } from "../../_components/ui/Skeleton";
import { KpiCard } from "../../_components/ui/KpiCard";
import { Table } from "../../_components/ui/Table";
import { StatusBadge } from "../../_components/ui/StatusBadge";
import ResourceView from "../../_components/ui/ResourceView";
import TablePagination from "../../_components/ui/TablePagination";
import StandardPage from "../../_components/ui/StandardPage";
import ReportHeaderActions from "../../_components/ui/ReportHeaderActions";
import ReportFilterCard from "../../_components/ui/ReportFilterCard";
import ResourceIdCell from "../../_components/ui/ResourceIdCell";
import { ROOM_TYPE_LABELS } from "../../../lib/constants";
import {
  buildReportListQuery,
  normalizeReportRows,
  readStoredPerPage,
} from "../../../lib/pagination";
import { BarChart3, Home, Users, CheckCircle } from "lucide-react";

export default function OccupancyReportPage() {
  const { user: currentUser, authLoading, isUnauthorized } = useAuthGuard();
  const [exporting, setExporting] = useState(false);
  const [apiError, setApiError] = useState("");
  const [apiUnavailable, setApiUnavailable] = useState(false);
  const [report, setReport] = useState({ summary: null, rows: [] });
  const [tableMeta, setTableMeta] = useState(null);
  const [roomTypeFilter, setRoomTypeFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(() => readStoredPerPage());

  const reportQs = useMemo(() => {
    const extra = {};
    if (roomTypeFilter !== "all") {
      extra.room_type = roomTypeFilter;
    }
    return buildReportListQuery(page, perPage, extra);
  }, [page, perPage, roomTypeFilter]);

  const { data: reportData, error: reportError, mutate: loadReport, isValidating } = useSWR(
    !authLoading && currentUser && canViewReports(currentUser) ? `/api/reports/occupancy${reportQs}` : null,
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

  const { rows } = normalizeReportRows(report, "rows");

  const onExport = async () => {
    if (apiUnavailable) return;
    setApiError("");
    setExporting(true);
    try {
      await exportReportCsv({
        endpoint: "/api/reports/occupancy/export",
        filters: roomTypeFilter !== "all" ? { room_type: roomTypeFilter } : {},
        filenamePrefix: "occupancy-report",
      });
    } catch (error) {
      setApiError(flattenApiErrors(error));
    } finally {
      setExporting(false);
    }
  };

  if (isUnauthorized) return null;

  const totalRecords = tableMeta?.total ?? rows.length;
  const timestampLabel = `Generated ${formatReportTimestamp()} • ${totalRecords} records`;

  return (
    <StandardPage
      title="Occupancy Report"
      subtitle={timestampLabel}
      loading={authLoading || loading}
      skeleton={<SkeletonListPage rows={8} />}
      breadcrumbs={<Breadcrumbs items={[{ label: "Reports", href: "/reports" }, { label: "Occupancy" }]} />}
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
          label="Total Rooms"
          value={report.summary?.total_rooms ?? "—"}
          icon={Home}
          isSyncing={isValidating}
        />
        <KpiCard
          label="Total Beds"
          value={report.summary?.total_beds ?? "—"}
          icon={BarChart3}
          isSyncing={isValidating}
        />
        <KpiCard
          label="Occupied Beds"
          value={report.summary?.occupied_beds ?? "—"}
          icon={Users}
          isSyncing={isValidating}
        />
        <KpiCard
          label="Occupancy Rate"
          value={report.summary?.total_beds ? `${Math.round((report.summary.occupied_beds / report.summary.total_beds) * 100)}%` : "0%"}
          progress={report.summary?.total_beds ? (report.summary.occupied_beds / report.summary.total_beds) * 100 : 0}
          icon={CheckCircle}
          isSyncing={isValidating}
        />
      </div>

      <ReportFilterCard onRefresh={() => loadReport()} refreshDisabled={apiUnavailable}>
        <div className="grid gap-6 sm:grid-cols-4">
          <Field label="Filter by Unit Type">
            <Select
              value={roomTypeFilter}
              onChange={(event) => {
                setRoomTypeFilter(event.target.value);
                setPage(1);
              }}
              disabled={apiUnavailable}
              className="!h-11"
            >
              <option value="all">All Unit Types</option>
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
      </ReportFilterCard>

      <ResourceView
        isLoading={loading}
        isSyncing={isValidating}
        error={reportError}
        isEmpty={rows.length === 0}
        onRetry={() => loadReport()}
        skeleton={<SkeletonListPage rows={10} />}
        emptyProps={{
          title: "No occupancy records found",
          message: "Adjust filters or check for archive entries."
        }}
      >
        <Card className="mt-8 overflow-hidden border-stone-200 !p-0 shadow-sm rounded-2xl">
          <Table
            embedded={true}
            caption="Bed Utilization Directory"
            ariaLabel="Bed utilization records"
            columns={[
              { key: "room", label: "UNIT CODE" },
              { key: "type", label: "UNIT TYPE", className: "text-center" },
              { key: "beds", label: "TOTAL BEDS", className: "text-right" },
              { key: "occupied", label: "OCCUPIED", className: "text-right" },
              { key: "vacant", label: "VACANCIES", className: "text-right" },
              { key: "rate", label: "UTILIZATION", className: "text-right" },
            ]}
            rows={rows.map((row) => (
              <tr key={row.room_id} className="border-t border-stone-100 hover:bg-stone-50 transition-colors duration-100">
                <td className="px-6 py-3">
                  <div className="font-mono text-[10px] font-black uppercase tracking-tighter text-stone-900 leading-tight">
                    {row.room_code}
                  </div>
                  {row.room_id != null ? (
                    <div className="mt-1">
                      <ResourceIdCell id={row.room_id} prefix="ROOM" />
                    </div>
                  ) : null}
                </td>
                <td className="px-6 py-3 text-center">
                  <StatusBadge>{row.room_type}</StatusBadge>
                </td>
                <td className="px-6 py-3 text-right font-mono text-xs tabular-nums text-stone-500">{row.total_beds}</td>
                <td className="px-6 py-3 text-right font-mono text-xs tabular-nums text-teal-700 font-bold">{row.occupied_beds}</td>
                <td className="px-6 py-3 text-right font-mono text-xs tabular-nums text-rose-700 font-bold">{row.vacant_beds}</td>
                <td className="px-6 py-3">
                  <div className="flex items-center justify-end gap-3">
                    <div className="h-1 w-16 rounded-full bg-stone-100 overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: `${row.occupancy_rate}%` }} />
                    </div>
                    <span className="font-mono text-[10px] font-black tabular-nums text-stone-900">{row.occupancy_rate}%</span>
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
            disabled={isValidating}
          />
        </Card>
      </ResourceView>
    </StandardPage>
  );
}
