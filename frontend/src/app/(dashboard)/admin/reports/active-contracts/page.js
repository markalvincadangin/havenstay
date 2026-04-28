"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { fetcher } from "@/lib/api";
import useSWR from "swr";
import { canViewReports } from "@/lib/auth";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { flattenApiErrors } from "@/lib/errors";
import { formatDateString } from "@/lib/formatters";
import { useToasts } from "@/context/ToastContext";
import CurrencyDisplay from "@/components/ui/CurrencyDisplay";
import { exportReportCsv } from "@/lib/downloads";
import Alert from "@/components/ui/Alert";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import FilterChips from "@/components/ui/FilterChips";
import { Field, Select } from "@/components/ui/Fields";
import { KpiCard } from "@/components/ui/KpiCard";
import { Table } from "@/components/ui/Table";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { FileText } from "lucide-react";
import TablePagination from "@/components/ui/TablePagination";
import ResourceView from "@/components/ui/ResourceView";
import { SkeletonListPage } from "@/components/ui/Skeleton";
import StandardPage from "@/components/ui/StandardPage";
import {
  buildReportListQuery,
  normalizePaginatedList,
  normalizeReportRows,
  readStoredPerPage,
} from "@/lib/pagination";
import ReportHeaderActions from "@/components/ui/ReportHeaderActions";
import ReportFilterCard from "@/components/ui/ReportFilterCard";
import ResourceIdCell from "@/components/ui/ResourceIdCell";

export default function ActiveContractsReportPage() {
  const { user: currentUser, authLoading, isUnauthorized } = useAuthGuard();
  const { showToast } = useToasts();
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
        endpoint: "/api/reports/active-contracts/export",
        filters: appliedFilters,
        filenamePrefix: "active-contracts",
      });
    } catch (error) {
      showToast(flattenApiErrors(error), "error");
    } finally {
      setExporting(false);
    }
  };

  if (isUnauthorized) return null;

  const rows = normalizeReportRows(report, "rows").rows;

  const selectedRoom = appliedFilters.room_id
    ? rooms.find((r) => String(r.room_id) === String(appliedFilters.room_id))
    : null;

  return (
    <StandardPage
      title="Active Contracts"
      subtitle={
        <div className="flex flex-col gap-2">
          <p>Filter and export system data.</p>
          <div className="flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-[0.15em] text-stone-400/70">
            <span>Generated {new Date().toLocaleDateString()} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            <span className="text-stone-200">|</span>
            <span>{report.meta?.total ?? 0} Records</span>
          </div>
        </div>
      }
      loading={authLoading || (loading && !reportData)}
      skeleton={<SkeletonListPage rows={10} />}
      breadcrumbs={
        <Breadcrumbs items={[{ label: "Reports", href: "/admin/reports" }, { label: "Active Contracts" }]} />
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

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          label="Active Leases"
          value={report.summary?.contract_count ?? "—"}
          icon={FileText}
          isSyncing={isValidating}
          className="hs-glass-effect"
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
        <Card className="mt-8 overflow-hidden border-stone-200 !p-0 shadow-sm rounded-2xl hs-glass-effect">
          <Table
            embedded={true}
            caption="Active contract rows"
            ariaLabel="Active contracts report"
            columns={[
              { key: "tenant", label: "Tenant" },
              { key: "room", label: "Room" },
              { key: "bed", label: "Bed", className: "text-center" },
              { key: "move_in", label: "Move-in", className: "text-center", headerClassName: "whitespace-nowrap" },
              { key: "rate", label: "Monthly Rent", className: "text-right" },
              { key: "deposit", label: "Deposit", className: "text-right" },
              { key: "clearance", label: "Clearance", className: "text-center" },
              { key: "bed_st", label: "Status", className: "text-center" },
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
                <td className="px-6 py-4 text-right">
                  <CurrencyDisplay amount={row.monthly_rate} className="text-xs font-bold text-stone-900" />
                </td>
                <td className="px-6 py-4 text-right">
                  <CurrencyDisplay amount={row.deposit_amount} className="text-xs font-bold text-stone-500" />
                </td>
                <td className="px-6 py-4 text-center">
                  <StatusBadge variant={row.is_cleared ? 'success' : 'warning'}>
                    {row.is_cleared ? 'Cleared' : 'Pending'}
                  </StatusBadge>
                </td>
                <td className="px-6 py-4 text-center">
                  <StatusBadge>{row.contract_status}</StatusBadge>
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
            className="hs-glass-effect"
          />
        </Card>
      </ResourceView>
    </StandardPage>
  );
}
