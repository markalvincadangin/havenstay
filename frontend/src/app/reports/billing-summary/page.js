"use client";

import { useCallback, useEffect, useState } from "react";
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
import { Field, Input } from "../../_components/ui/Fields";
import PageHeader from "../../_components/ui/PageHeader";
import Spinner from "../../_components/ui/Spinner";
import UserRoleBadge from "../../_components/ui/UserRoleBadge";
import { Table } from "../../_components/ui/Table";
import { StatusBadge } from "../../../components/ui/StatusBadge";

function buildQuery(params) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  const queryString = query.toString();
  return queryString ? `?${queryString}` : "";
}

export default function BillingSummaryReportPage() {
  const { user: currentUser, authLoading } = useAuthGuard();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [apiError, setApiError] = useState("");
  const [apiUnavailable, setApiUnavailable] = useState(false);
  const [report, setReport] = useState({ summary: null, rows: [] });
  const [filters, setFilters] = useState({ start_date: "", end_date: "" });

  const loadReport = useCallback(async (nextFilters = {}) => {
    const query = buildQuery(nextFilters);
    const data = await apiRequest(`/api/reports/billing-summary${query}`, { method: "GET" });
    setReport(data);
  }, []); // no filters dep — callers always pass filters explicitly

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
        await loadReport({ start_date: "", end_date: "" });
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

  const onApplyFilters = async (event) => {
    event.preventDefault();
    if (apiUnavailable) return;
    setApiError("");
    setSubmitting(true);
    try {
      await loadReport(filters);
    } catch (error) {
      setApiError(flattenApiErrors(error));
    } finally {
      setSubmitting(false);
    }
  };

  const onExport = async () => {
    if (apiUnavailable) return;
    setApiError("");
    setExporting(true);
    try {
      const query = buildQuery(filters);
      const stamp = new Date().toISOString().slice(0, 10);
      await downloadCsvWithAuth(`/api/reports/billing-summary/export${query}`, `billing-summary-report-${stamp}.csv`);
    } catch (error) {
      setApiError(flattenApiErrors(error));
    } finally {
      setExporting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <AppMain>
        <Spinner label="Loading billing summary report..." />
      </AppMain>
    );
  }

  return (
    <AppMain>
      <PageHeader
        title="Billing Summary Report"
        subtitle="Analyze billed, collected, and outstanding balances for selected periods."
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: "Reports", href: "/reports" },
              { label: "Billing Summary" },
            ]}
          />
        }
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <UserRoleBadge
              username={currentUser?.username}
              roleName={currentUser?.role?.role_name}
            />
            <Button
              type="button"
              onClick={onExport}
              loading={exporting}
              disabled={exporting || apiUnavailable}
            >
              {exporting ? "Downloading..." : "Export CSV"}
            </Button>
          </div>
        }
      />

      <p className="mt-2 text-xs italic text-[var(--color-text-secondary)] print:block">
        Generated {formatReportTimestamp()}
      </p>

      {/* Summary Metrics - Moved outside for visibility */}
      <Card className="mt-8 border-none bg-stone-100/50 shadow-inner">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Billing Entries" value={report.summary?.billing_count} />
          <Metric
            label="Billed Total"
            value={formatPHP(report.summary?.billed_total)}
          />
          <Metric
            label="Collected Total"
            value={formatPHP(report.summary?.collected_total)}
          />
          <Metric
            label="Outstanding"
            value={formatPHP(report.summary?.outstanding_total)}
          />
        </div>
      </Card>

      <Card className="mt-8">
        <form
          className="grid gap-3 sm:grid-cols-4"
          onSubmit={onApplyFilters}
        >
          <Field label="Start Date">
            <Input
              type="date"
              value={filters.start_date}
              disabled={apiUnavailable}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, start_date: event.target.value }))
              }
            />
          </Field>
          <Field label="End Date">
            <Input
              type="date"
              value={filters.end_date}
              disabled={apiUnavailable}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, end_date: event.target.value }))
              }
            />
          </Field>
          <div className="flex items-end">
            <Button
              type="submit"
              variant="secondary"
              loading={submitting}
              disabled={submitting || apiUnavailable}
              className="w-full"
            >
              {submitting ? "Applying..." : "Apply Filters"}
            </Button>
          </div>
        </form>
        <FilterChips
          items={[
            {
              key: "start_date",
              label: "Start Date",
              value: filters.start_date,
              onClear: () => setFilters((prev) => ({ ...prev, start_date: "" })),
            },
            {
              key: "end_date",
              label: "End Date",
              value: filters.end_date,
              onClear: () => setFilters((prev) => ({ ...prev, end_date: "" })),
            },
          ]}
          onClearAll={() => setFilters({ start_date: "", end_date: "" })}
        />

        {apiUnavailable ? (
          <Alert
            variant="info"
            className="mt-4"
            title="Backend report endpoint unavailable"
          >
            Billing Summary report data is not yet available from the API.
          </Alert>
        ) : null}
        {apiError ? (
          <Alert variant="error" className="mt-4" title="Report error">
            {apiError}
          </Alert>
        ) : null}
      </Card>

      <div className="mt-8">
        <Table
          caption="Billing summary report table"
        ariaLabel="Billing summary report results"
        columns={[
          { key: "id", label: "#" },
          { key: "tenant", label: "Tenant" },
          { key: "room", label: "Room" },
          { key: "period", label: "Period" },
          { key: "due", label: "Due" },
          { key: "paid", label: "Paid" },
          { key: "balance", label: "Outstanding" },
          { key: "status", label: "Status" },
        ]}
        rows={report.rows.map((row) => (
          <tr key={row.billing_id} className="border-t border-[var(--color-border)] hover:bg-[var(--surface-muted)] transition-colors duration-100">
            <td className="px-4 py-3.5 font-mono text-xs text-[var(--color-text-secondary)]">{row.billing_id}</td>
            <td className="px-4 py-3.5 font-medium text-[var(--color-text)]">{row.tenant_name}</td>
            <td className="px-4 py-3.5 text-[var(--color-text)]">{row.room_code}</td>
            <td className="px-4 py-3.5 text-[var(--color-text-secondary)]">{formatDateString(row.billing_period_from)} – {formatDateString(row.billing_period_to)}</td>
            <td className="px-4 py-3.5 text-right font-mono tabular-nums text-[var(--color-text)]">{formatPHP(row.amount_due)}</td>
            <td className="px-4 py-3.5 text-right font-mono tabular-nums text-emerald-700">{formatPHP(row.amount_paid)}</td>
            <td className="px-4 py-3.5 text-right font-mono tabular-nums font-semibold text-[#991B1B]">{formatPHP(row.outstanding_balance)}</td>
            <td className="px-4 py-3.5"><StatusBadge>{row.status}</StatusBadge></td>
          </tr>
        ))}
        emptyTitle="No billing rows found"
        emptyDescription="Try a different date range or clear filters."
      />
      </div>
    </AppMain>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-5 shadow-sm" aria-label={`${label}: ${value ?? 0}`}>
      <div className="text-xs font-medium uppercase tracking-[0.06em] text-[var(--color-text-secondary)]">{label}</div>
      <div className="mt-2 font-sans text-[1.875rem] font-semibold leading-none tracking-[-0.025em] text-[var(--color-text)]">{value ?? 0}</div>
    </div>
  );
}
