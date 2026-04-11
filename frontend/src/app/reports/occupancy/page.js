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
import { Table } from "../../_components/ui/Table";
import { StatusBadge } from "../../../components/ui/StatusBadge";

export default function OccupancyReportPage() {
  const { user: currentUser, authLoading } = useAuthGuard();
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [apiError, setApiError] = useState("");
  const [apiUnavailable, setApiUnavailable] = useState(false);
  const [report, setReport] = useState({ summary: null, rows: [] });
  const [roomTypeFilter, setRoomTypeFilter] = useState("all");

  const loadReport = useCallback(async () => {
    const data = await apiRequest("/api/reports/occupancy", { method: "GET" });
    setReport(data);
  }, []);

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
        } else {
          setApiUnavailable(false);
          setApiError(flattenApiErrors(error));
        }
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [authLoading, currentUser, loadReport]);

  const rows = report.rows.filter((row) => {
    if (roomTypeFilter === "all") return true;
    return row.room_type === roomTypeFilter;
  });

  const onExport = async () => {
    if (apiUnavailable) return;
    setApiError("");
    setExporting(true);
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      await downloadCsvWithAuth("/api/reports/occupancy/export", `occupancy-report-${stamp}.csv`);
    } catch (error) {
      setApiError(flattenApiErrors(error));
    } finally {
      setExporting(false);
    }
  };

  if (authLoading || loading) {
    return <SkeletonListPage rows={8} />;
  }

  return (
    <AppMain>
      <div className="report-page">
      <PageHeader
        title="Occupancy Report"
        subtitle="Review room utilization and vacancy distribution."
        breadcrumbs={<Breadcrumbs items={[{ label: "Reports", href: "/reports" }, { label: "Occupancy" }]} />}
        actions={(
          <div className="flex flex-wrap items-center justify-end gap-2">
            <UserRoleBadge username={currentUser?.username} roleName={currentUser?.role?.role_name} />
            <Button type="button" onClick={onExport} loading={exporting} disabled={exporting || apiUnavailable}>
              {exporting ? "Downloading..." : "Export CSV"}
            </Button>
          </div>
        )}
      />

      <p className="mt-2 text-xs italic text-[var(--color-text-secondary)] print:block">
        Generated {formatReportTimestamp()}
      </p>

      {/* Summary Tiles - Moved outside card per layout standard */}
      <Card className="mt-8 border-none bg-stone-100/50 shadow-inner">
        <div className="grid gap-4 sm:grid-cols-4">
          <SummaryTile label="Total Rooms" value={report.summary?.total_rooms} />
          <SummaryTile label="Total Beds" value={report.summary?.total_beds} />
          <SummaryTile label="Occupied Beds" value={report.summary?.occupied_beds} />
          <SummaryTile label="Vacant Beds" value={report.summary?.vacant_beds} />
        </div>
      </Card>

      <Card className="mt-8">
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Room Type Filter">
            <Select value={roomTypeFilter} onChange={(event) => setRoomTypeFilter(event.target.value)} disabled={apiUnavailable}>
              <option value="all">All Types</option>
              <option value="solo">Solo</option>
              <option value="shared">Shared</option>
            </Select>
          </Field>
          <div className="flex items-end">
            <Button type="button" variant="secondary" onClick={loadReport} disabled={apiUnavailable}>
              Refresh
            </Button>
          </div>
        </div>
        <FilterChips
          items={[
            {
              key: "room_type",
              label: "Room Type",
              value: roomTypeFilter !== "all" ? roomTypeFilter : "",
              onClear: () => setRoomTypeFilter("all"),
            },
          ]}
          onClearAll={() => setRoomTypeFilter("all")}
        />

        {apiUnavailable ? (
          <Alert variant="info" className="mt-4" title="Backend report endpoint unavailable">
            Occupancy report data is not yet available from the API.
          </Alert>
        ) : null}
        {apiError ? <Alert variant="error" className="mt-4" title="Report error">{apiError}</Alert> : null}
      </Card>

      <div className="mt-8">
        <Table
          caption="Occupancy report table"
        ariaLabel="Occupancy report results"
        columns={[
          { key: "room", label: "Room" },
          { key: "type", label: "Type" },
          { key: "beds", label: "Total Beds" },
          { key: "occupied", label: "Occupied" },
          { key: "vacant", label: "Vacant" },
          { key: "rate", label: "Occupancy %" },
        ]}
        rows={rows.map((row) => (
          <tr key={row.room_id} className="border-t border-[var(--color-border)] hover:bg-[var(--surface-muted)] transition-colors duration-100">
            <td className="px-4 py-3.5 font-medium text-[var(--color-text)]">{row.room_code}</td>
            <td className="px-4 py-3.5"><StatusBadge>{row.room_type}</StatusBadge></td>
            <td className="px-4 py-3.5 text-[var(--color-text)]">{row.total_beds}</td>
            <td className="px-4 py-3.5 text-emerald-700">{row.occupied_beds}</td>
            <td className="px-4 py-3.5 text-rose-700">{row.vacant_beds}</td>
            <td className="px-4 py-3.5">
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-16 rounded-full bg-[var(--color-primary)]/10 overflow-hidden">
                  <div className="h-full bg-[var(--color-primary)]" style={{ width: `${row.occupancy_rate}%` }} />
                </div>
                <span className="font-mono text-sm tabular-nums">{row.occupancy_rate}%</span>
              </div>
            </td>
          </tr>
        ))}
        emptyTitle="No occupancy records found"
        emptyDescription="Try changing the room type filter or refresh the report."
      />
      </div>
      </div>
    </AppMain>
  );
}

function SummaryTile({ label, value }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-5 shadow-sm" aria-label={`${label}: ${value ?? 0}`}>
      <div className="text-xs font-medium uppercase tracking-[0.06em] text-[var(--color-text-secondary)]">{label}</div>
      <div className="mt-2 font-mono text-[1.875rem] font-semibold leading-none tracking-[-0.025em] text-[var(--color-text)] tabular-nums">{value ?? 0}</div>
    </div>
  );
}
