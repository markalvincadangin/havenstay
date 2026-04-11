"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { downloadCsvWithAuth } from "../../../lib/downloads";
import { flattenApiErrors } from "../../../lib/errors";
import { formatDateString, formatReportTimestamp } from "../../../lib/formatters";

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
  const [submitting, setSubmitting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [apiError, setApiError] = useState("");
  const [reportRows, setReportRows] = useState([]);

  const [filters, setFilters] = useState({
    from: "",
    to: "",
    status: "all",
  });

  const fetchReport = useCallback(async (activeFilters) => {
    const query = buildQuery({
      from: activeFilters.from,
      to: activeFilters.to,
      status: activeFilters.status,
    });
    const data = await apiRequest(`/api/reports/tenant-history${query}`, { method: "GET" });
    const rows = Array.isArray(data?.rows) ? data.rows : [];
    setReportRows(rows);
  }, []);

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
          setApiError("Unauthorized: you do not have permission to view reports.");
          return;
        }

        await fetchReport({ from: "", to: "", status: "all" });
      } catch (err) {
        setApiError(flattenApiErrors(err));
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, [fetchReport, router]);

  const onApplyFilters = async (event) => {
    event.preventDefault();
    setApiError("");
    setSubmitting(true);

    try {
      await fetchReport(filters);
    } catch (error) {
      setApiError(flattenApiErrors(error));
    } finally {
      setSubmitting(false);
    }
  };

  const onExport = async () => {
    setApiError("");
    setExporting(true);

    try {
      const query = buildQuery(filters);
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
        <Spinner label="Loading tenant history report..." />
      </AppMain>
    );
  }

  return (
    <AppMain>
      <Card>
        <Breadcrumbs items={[{ label: "Reports", href: "/reports" }, { label: "Tenant History" }]} />
        <div className="mt-3">
          <PageHeader
            title="Tenant History Report"
            subtitle="Contract timelines and room assignments from the tenant contract history view—filters apply to move-in date."
            actions={(
              <div className="flex flex-wrap items-center justify-end gap-2">
                <UserRoleBadge username={currentUser?.username} roleName={currentUser?.role?.role_name} />
                <Button type="button" onClick={onExport} loading={exporting} disabled={exporting}>
                  {exporting ? "Downloading..." : "Export CSV"}
                </Button>
              </div>
            )}
          />
        </div>

        <p className="mt-2 text-xs italic text-[var(--color-text-secondary)] print:block">
          Generated {formatReportTimestamp()}
        </p>

        <form className="mt-4 grid gap-3 sm:grid-cols-3" onSubmit={onApplyFilters}>
          <Field label="Date from">
            <Input type="date" value={filters.from} onChange={(e) => setFilters((prev) => ({ ...prev, from: e.target.value }))} />
          </Field>
          <Field label="Date to">
            <Input type="date" value={filters.to} onChange={(e) => setFilters((prev) => ({ ...prev, to: e.target.value }))} />
          </Field>
          <Field label="Status">
            <Select value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}>
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="moved_out">Moved Out</option>
              <option value="completed">Completed</option>
              <option value="terminated">Terminated</option>
            </Select>
          </Field>

          <div className="flex items-end sm:col-span-3">
            <Button type="submit" variant="secondary" loading={submitting} disabled={submitting} className="w-full sm:w-auto">
              {submitting ? "Applying..." : "Apply Filters"}
            </Button>
          </div>
        </form>

        <FilterChips
          items={[
            { key: "from", label: "From", value: filters.from, onClear: () => setFilters((prev) => ({ ...prev, from: "" })) },
            { key: "to", label: "To", value: filters.to, onClear: () => setFilters((prev) => ({ ...prev, to: "" })) },
            { key: "status", label: "Status", value: filters.status !== "all" ? filters.status : "", onClear: () => setFilters((prev) => ({ ...prev, status: "all" })) },
          ]}
          onClearAll={async () => {
            const cleared = { from: "", to: "", status: "all" };
            setFilters(cleared);
            setApiError("");
            try {
              await fetchReport(cleared);
            } catch (err) {
              setApiError(flattenApiErrors(err));
            }
          }}
        />

        {apiError ? <Alert variant="error" className="mt-4" title="Report error">{apiError}</Alert> : null}

        <div className="mt-4">
          <Table
            caption="Tenant history report results"
            ariaLabel="Tenant history report table"
            columns={[
              { key: "tenant", label: "Tenant" },
              { key: "email", label: "Email" },
              { key: "move_in", label: "Contract Start" },
              { key: "move_out", label: "Contract End" },
              { key: "room", label: "Room / Bed" },
              { key: "status", label: "Status" },
            ]}
            rows={reportRows.map((row) => {
              const tenantName = row?.tenant_name || "-";
              const email = row?.email ? String(row.email) : "—";
              const moveIn = row?.move_in_date || "-";
              const moveOut = row?.move_out_date || "-";
              const room = row?.room_label || "-";
              const status = row?.status || "-";

              return (
                <tr
                  key={row?.contract_id ?? `${tenantName}-${moveIn}`}
                  className="border-t border-[var(--color-border)] hover:bg-[var(--surface-muted)] transition-colors duration-100"
                >
                  <td className="px-4 py-3.5 font-medium text-[var(--color-text)]">{tenantName}</td>
                  <td className="px-4 py-3.5 font-mono text-sm text-[var(--color-text)]">{email}</td>
                  <td className="px-4 py-3.5 text-[var(--color-text)]">{formatDateString(moveIn)}</td>
                  <td className="px-4 py-3.5 text-[var(--color-text)]">{formatDateString(moveOut)}</td>
                  <td className="px-4 py-3.5 text-[var(--color-text)]">{room}</td>
                  <td className="px-4 py-3.5">
                    <StatusBadge>{status}</StatusBadge>
                  </td>
                </tr>
              );
            })}
            emptyTitle="No tenant history records found"
            emptyDescription="Adjust your date range and status filters."
          />
        </div>
      </Card>
    </AppMain>
  );
}
