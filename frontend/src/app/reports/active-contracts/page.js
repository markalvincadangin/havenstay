"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { fetcher } from "../../../lib/api";
import useSWR from "swr";
import { canViewReports } from "../../../lib/auth";
import { useAuthGuard } from "../../../hooks/useAuthGuard";
import { flattenApiErrors } from "../../../lib/errors";
import { formatDateString, formatPHP, formatReportTimestamp } from "../../../lib/formatters";
import { exportReportCsv } from "../../../lib/reports";
import Alert from "../../_components/ui/Alert";
import Breadcrumbs from "../../_components/ui/Breadcrumbs";
import Button from "../../_components/ui/Button";
import { Card } from "../../_components/ui/Card";
import FilterChips from "../../_components/ui/FilterChips";
import { Field, Select } from "../../_components/ui/Fields";
import { KpiCard } from "../../_components/ui/KpiCard";
import { Table } from "../../_components/ui/Table";
import { StatusBadge } from "../../_components/ui/StatusBadge";
import { FileText } from "lucide-react";
import TablePagination from "../../_components/ui/TablePagination";
import ResourceView from "../../_components/ui/ResourceView";
import { SkeletonListPage } from "../../_components/ui/Skeleton";
import StandardPage from "../../_components/ui/StandardPage";
import {
  buildReportListQuery,
  normalizePaginatedList,
  normalizeReportRows,
  readStoredPerPage,
} from "../../../lib/pagination";
import ReportHeaderActions from "../../_components/ui/ReportHeaderActions";
import ReportFilterCard from "../../_components/ui/ReportFilterCard";
import ResourceIdCell from "../../_components/ui/ResourceIdCell";

export default function ActiveContractsReportPage() {
  const { user: currentUser, authLoading, isUnauthorized } = useAuthGuard();
  const [exporting, setExporting] = useState(false);
  const [apiError, setApiError] = useState("");
  const [report, setReport] = useState({ summary: null, rows: [] });
  const [tableMeta, setTableMeta] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [filters, setFilters] = useState({ room_id: "" });
  const [appliedFilters, setAppliedFilters] = useState({ room_id: "" });
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
    return buildReportListQuery(page, perPage, extra);
  }, [appliedFilters, page, perPage]);

  const { data: reportData, error: reportError, mutate: loadReport, isValidating } = useSWR(
    !authLoading && currentUser && canViewReports(currentUser) ? `/api/reports/active-contracts${reportQs}` : null,
    fetcher,
    { keepPreviousData: true, dedupingInterval: 600000 }
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
        endpoint: "/api/reports/active-contracts/export",
        filters: appliedFilters,
        filenamePrefix: "active-contracts",
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
  const timestampLabel = `Generated ${formatReportTimestamp()} • ${totalRecords} contracts`;

  const selectedRoom = appliedFilters.room_id
    ? rooms.find((r) => String(r.room_id) === String(appliedFilters.room_id))
    : null;

  return (
    <StandardPage
      title="Active contracts"
      subtitle={timestampLabel}
      loading={authLoading || (loading && !reportData)}
      skeleton={<SkeletonListPage rows={10} />}
      breadcrumbs={
        <Breadcrumbs items={[{ label: "Reports", href: "/reports" }, { label: "Active contracts" }]} />
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

      <p className="mt-2 max-w-3xl text-[11px] leading-relaxed text-stone-500">
        Live snapshot of <strong className="font-medium text-stone-600">active</strong> leases with room, bed, and rate.
        Complements the room occupancy summary and the per-bed status report.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard 
          label="Active leases" 
          value={report.summary?.contract_count ?? "—"} 
          icon={FileText} 
          isSyncing={isValidating}
        />
      </div>

      <ReportFilterCard onRefresh={() => loadReport()} refreshDisabled={isValidating}>
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
      </ReportFilterCard>

      <ResourceView
        isLoading={loading}
        isSyncing={isValidating}
        error={reportError}
        isEmpty={rows.length === 0}
        onRetry={() => loadReport()}
        skeleton={<SkeletonListPage rows={10} />}
        emptyProps={{
          title: "No active contracts",
          message: "No rows match the filter, or there are no active leases in the system."
        }}
      >
        <Card className="mt-8 overflow-hidden border-stone-200 !p-0 shadow-sm rounded-2xl">
          <Table
            embedded={true}
            caption="Active contract rows"
            ariaLabel="Active contracts report"
            columns={[
              { key: "tenant", label: "Tenant" },
              { key: "room", label: "Room" },
              { key: "bed", label: "Bed label", className: "text-center" },
              { key: "move_in", label: "Move-in", className: "text-center" },
              { key: "rate", label: "Monthly rate", className: "text-right" },
              { key: "deposit", label: "Deposit", className: "text-right" },
              { key: "clearance", label: "Gate Pass", className: "text-center" },
              { key: "bed_st", label: "Bed status", className: "text-center" },
              { key: "contract", label: "Contract ID", className: "text-right" },
            ]}
            rows={rows.map((row) => (
              <tr key={row.contract_id} className="border-t border-stone-100 hover:bg-stone-50 transition-colors duration-100">
                <td className="px-6 py-4 text-xs font-bold text-stone-900">{row.tenant_name}</td>
                <td className="px-6 py-4">
                  <div className="font-mono text-[10px] font-black uppercase tracking-tighter text-stone-900 leading-tight">{row.room_code}</div>
                  <ResourceIdCell id={row.room_id} prefix="ROOM" />
                </td>
                <td className="px-6 py-4 text-center text-xs font-bold text-stone-700">{row.bed_label}</td>
                <td className="px-6 py-4 text-center text-[10px] font-medium text-stone-500">{formatDateString(row.move_in_date)}</td>
                <td className="px-6 py-4 text-right font-mono text-xs tabular-nums text-stone-900">{formatPHP(row.monthly_rate)}</td>
                <td className="px-6 py-4 text-right font-mono text-xs tabular-nums text-stone-500">{formatPHP(row.deposit_amount)}</td>
                <td className="px-6 py-4 text-center">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${row.is_cleared ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {row.is_cleared ? 'Cleared' : 'Pending'}
                  </span>
                </td>
                <td className="px-6 py-4 text-center">
                  <StatusBadge>{row.bed_status}</StatusBadge>
                </td>
                <td className="px-6 py-4 text-right">
                  <Link
                    href={`/contracts/${row.contract_id}`}
                    className="font-mono text-[10px] font-black text-teal-600 hover:text-teal-900"
                  >
                    <ResourceIdCell id={row.contract_id} prefix="CONTRACT" />
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
            disabled={isValidating}
          />
        </Card>
      </ResourceView>
    </StandardPage>
  );
}
