"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { fetcher } from "../../../lib/api";
import useSWR from "swr";
import { canViewReports } from "../../../lib/auth";
import { useAuthGuard } from "../../../hooks/useAuthGuard";
import { flattenApiErrors } from "../../../lib/errors";
import { formatReportTimestamp } from "../../../lib/formatters";
import { exportReportCsv } from "../../../lib/reports";
import Alert from "../../_components/ui/Alert";
import Breadcrumbs from "../../_components/ui/Breadcrumbs";
import Button from "../../_components/ui/Button";
import { Card } from "../../_components/ui/Card";
import FilterChips from "../../_components/ui/FilterChips";
import { Field, Select } from "../../_components/ui/Fields";
import { SkeletonListPage } from "../../_components/ui/Skeleton";
import { KpiCard } from "../../_components/ui/KpiCard";
import { Table } from "../../_components/ui/Table";
import { StatusBadge } from "../../_components/ui/StatusBadge";
import StandardPage from "../../_components/ui/StandardPage";
import ReportHeaderActions from "../../_components/ui/ReportHeaderActions";
import ReportFilterCard from "../../_components/ui/ReportFilterCard";
import ResourceIdCell from "../../_components/ui/ResourceIdCell";
import { BED_STATUS_LABELS } from "../../../lib/constants";
import { BedDouble, Home, Search, Wrench } from "lucide-react";
import TablePagination from "../../_components/ui/TablePagination";
import ResourceView from "../../_components/ui/ResourceView";
import {
  buildReportListQuery,
  normalizePaginatedList,
  normalizeReportRows,
  readStoredPerPage,
} from "../../../lib/pagination";

export default function OccupancyStatusReportPage() {
  const { user: currentUser, authLoading, isUnauthorized } = useAuthGuard();
  const [exporting, setExporting] = useState(false);
  const [apiError, setApiError] = useState("");
  const [report, setReport] = useState({ summary: null, rows: [] });
  const [tableMeta, setTableMeta] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [filters, setFilters] = useState({ room_id: "", bed_status: "" });
  const [appliedFilters, setAppliedFilters] = useState({ room_id: "", bed_status: "" });
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(() => readStoredPerPage());

  const { data: roomsData } = useSWR(
    !authLoading && currentUser && canViewReports(currentUser) ? "/api/rooms?per_page=100" : null,
    fetcher
  );

  useEffect(() => {
    if (roomsData) {
      const rows = normalizePaginatedList(roomsData).rows;
      setRooms(rows.sort((a, b) => String(a.room_code).localeCompare(String(b.room_code))));
    }
  }, [roomsData]);

  const reportQs = useMemo(() => {
    const extra = {};
    if (appliedFilters.room_id) extra.room_id = appliedFilters.room_id;
    if (appliedFilters.bed_status) extra.bed_status = appliedFilters.bed_status;
    return buildReportListQuery(page, perPage, extra);
  }, [appliedFilters, page, perPage]);

  const { data: reportData, error: reportError, mutate: loadReport, isValidating } = useSWR(
    !authLoading && currentUser && canViewReports(currentUser) ? `/api/reports/occupancy-status${reportQs}` : null,
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
        endpoint: "/api/reports/occupancy-status/export",
        filters: appliedFilters,
        filenamePrefix: "occupancy-status",
      });
    } catch (error) {
      setApiError(flattenApiErrors(error));
    } finally {
      setExporting(false);
    }
  };

  if (isUnauthorized) return null;

  const rows = normalizeReportRows(report, "rows").rows;
  const s = report.summary || {};
  const totalRecords = tableMeta?.total ?? rows.length;
  const timestampLabel = `Generated ${formatReportTimestamp()} • ${totalRecords} beds`;

  const selectedRoom = appliedFilters.room_id
    ? rooms.find((r) => String(r.room_id) === String(appliedFilters.room_id))
    : null;

  return (
    <StandardPage
      title="Bed occupancy"
      subtitle={timestampLabel}
      loading={authLoading || (loading && !reportData)}
      skeleton={<SkeletonListPage rows={10} />}
      breadcrumbs={<Breadcrumbs items={[{ label: "Reports", href: "/reports" }, { label: "Bed occupancy" }]} />}
      actions={
        <ReportHeaderActions
          user={currentUser}
          onExport={onExport}
          exporting={exporting}
          exportDisabled={exporting}
        />
      }
    >

      <p className="mt-2 max-w-3xl text-[11px] leading-relaxed text-stone-500">
        Per-bed availability, tenant name, and active contract—aligned with how beds are managed in Rooms.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard 
          label="Total beds" 
          value={s.bed_count ?? "—"} 
          icon={BedDouble} 
          isSyncing={isValidating}
        />
        <KpiCard 
          label="Occupied" 
          value={s.occupied_beds ?? "—"} 
          icon={Home} 
          isSyncing={isValidating}
        />
        <KpiCard 
          label="Vacant" 
          value={s.vacant_beds ?? "—"} 
          icon={Search} 
          isSyncing={isValidating}
        />
        <KpiCard 
          label="Maintenance" 
          value={s.maintenance_beds ?? "—"} 
          icon={Wrench} 
          isSyncing={isValidating}
        />
      </div>

      <ReportFilterCard onRefresh={() => loadReport()} refreshDisabled={isValidating}>
          <form className="grid gap-6 sm:grid-cols-4" onSubmit={onApplyFilters}>
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
            <Field label="Bed status">
              <Select
                className="!h-11 border-stone-200"
                value={filters.bed_status}
                onChange={(e) => setFilters((prev) => ({ ...prev, bed_status: e.target.value }))}
              >
                <option value="">All statuses</option>
                {Object.entries(BED_STATUS_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex items-end sm:col-span-2">
              <Button type="submit" variant="secondary" className="w-full !h-11 shadow-sm sm:max-w-xs">
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
              {
                key: "bed_status",
                label: "Bed",
                value: appliedFilters.bed_status
                  ? BED_STATUS_LABELS[appliedFilters.bed_status] || appliedFilters.bed_status
                  : "",
                onClear: () => {
                  setFilters((prev) => ({ ...prev, bed_status: "" }));
                  setAppliedFilters((prev) => ({ ...prev, bed_status: "" }));
                  setPage(1);
                },
              },
            ]}
            onClearAll={() => {
              const cleared = { room_id: "", bed_status: "" };
              setFilters(cleared);
              setAppliedFilters(cleared);
              setPage(1);
            }}
          />
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
          title: "No bed records",
          message: "Adjust filters or confirm rooms and bed spaces exist in inventory."
        }}
      >
        <Card className="mt-8 overflow-hidden border-stone-200 !p-0 shadow-sm rounded-2xl">
          <Table
            embedded={true}
            caption="Per-bed occupancy"
            ariaLabel="Bed-level occupancy records"
            columns={[
              { key: "room", label: "Room" },
              { key: "bed", label: "Bed label" },
              { key: "status", label: "Bed status" },
              { key: "tenant", label: "Tenant" },
              { key: "contract", label: "Contract ID", className: "text-right" },
            ]}
            rows={rows.map((row) => (
              <tr key={row.bed_space_id} className="border-t border-stone-100 hover:bg-stone-50 transition-colors duration-100">
                <td className="px-6 py-4 font-mono text-[10px] font-black uppercase tracking-tighter text-stone-900">
                  {row.room_code}
                </td>
                <td className="px-6 py-4 text-xs font-bold text-stone-800">{row.bed_label}</td>
                <td className="px-6 py-4">
                  <StatusBadge>{row.bed_status}</StatusBadge>
                </td>
                <td className="px-6 py-4 text-xs text-stone-700">{row.tenant_name || "—"}</td>
                <td className="px-6 py-4 text-right">
                  {row.contract_id ? (
                    <Link
                      href={`/contracts/${row.contract_id}`}
                      className="font-mono text-[10px] font-black text-teal-600 hover:text-teal-900"
                    >
                      <ResourceIdCell id={row.contract_id} prefix="CONTRACT" />
                    </Link>
                  ) : (
                    <span className="text-stone-300">—</span>
                  )}
                </td>
              </tr>
            ))}
            emptyTitle="No bed records"
            emptyDescription="Adjust filters or confirm rooms and bed spaces exist in inventory."
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
