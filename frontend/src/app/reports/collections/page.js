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
import { Field, Input, Select } from "../../_components/ui/Fields";
import PageHeader from "../../_components/ui/PageHeader";
import Spinner from "../../_components/ui/Spinner";
import UserRoleBadge from "../../_components/ui/UserRoleBadge";
import { Table } from "../../_components/ui/Table";

function buildQuery(params) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  const queryString = query.toString();
  return queryString ? `?${queryString}` : "";
}

export default function CollectionsPerformanceReportPage() {
  const { user: currentUser, authLoading } = useAuthGuard();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [apiError, setApiError] = useState("");
  const [report, setReport] = useState({ summary: null, rows: [] });
  const [filters, setFilters] = useState({ start_date: "", end_date: "", payment_method: "" });

  const loadReport = useCallback(async (nextFilters = {}) => {
    const query = buildQuery(nextFilters);
    const data = await apiRequest(`/api/reports/collections-performance${query}`, { method: "GET" });
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
        await loadReport({ start_date: "", end_date: "", payment_method: "" });
      } catch (error) {
        setApiError(flattenApiErrors(error));
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [authLoading, currentUser, loadReport]);

  const onApplyFilters = async (event) => {
    event.preventDefault();
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
    setApiError("");
    setExporting(true);
    try {
      const query = buildQuery(filters);
      const stamp = new Date().toISOString().slice(0, 10);
      await downloadCsvWithAuth(`/api/reports/collections-performance/export${query}`, `collections-report-${stamp}.csv`);
    } catch (error) {
      setApiError(flattenApiErrors(error));
    } finally {
      setExporting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <AppMain>
        <Spinner label="Loading collections performance report..." />
      </AppMain>
    );
  }

  return (
    <AppMain>
      <PageHeader
        title="Collections Performance Report"
        subtitle="Analyze payment collections, methods, and processing efficiency."
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: "Reports", href: "/reports" },
              { label: "Collections Performance" },
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
              disabled={exporting}
            >
              {exporting ? "Downloading..." : "Export CSV"}
            </Button>
          </div>
        }
      />

      <p className="mt-2 text-xs italic text-[var(--color-text-secondary)] print:block">
        Generated {formatReportTimestamp()}
      </p>

      {/* Summary Metrics */}
      <Card className="mt-8 border-none bg-stone-100/50 shadow-inner">
        <div className="grid gap-4 sm:grid-cols-2">
          <Metric label="Total Payments" value={report.summary?.payment_count} />
          <Metric
            label="Amount Collected"
            value={formatPHP(report.summary?.total_collected)}
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
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, start_date: event.target.value }))
              }
            />
          </Field>
          <Field label="End Date">
            <Input
              type="date"
              value={filters.end_date}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, end_date: event.target.value }))
              }
            />
          </Field>
          <Field label="Payment Method">
            <Select
              value={filters.payment_method}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, payment_method: event.target.value }))
              }
            >
              <option value="">All Methods</option>
              <option value="cash">Cash</option>
              <option value="gcash">GCash</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="other">Other</option>
            </Select>
          </Field>
          <div className="flex items-end">
            <Button
              type="submit"
              variant="secondary"
              loading={submitting}
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
            {
              key: "payment_method",
              label: "Method",
              value: filters.payment_method,
              onClear: () => setFilters((prev) => ({ ...prev, payment_method: "" })),
            },
          ]}
          onClearAll={() => setFilters({ start_date: "", end_date: "", payment_method: "" })}
        />

        {apiError ? (
          <Alert variant="error" className="mt-4" title="Report error">
            {apiError}
          </Alert>
        ) : null}
      </Card>

      <div className="mt-8">
        <Table
          caption="Collections report table"
        ariaLabel="Collections performance results"
        columns={[
          { key: "id", label: "#" },
          { key: "date", label: "Date" },
          { key: "amount", label: "Amount" },
          { key: "method", label: "Method" },
          { key: "reference", label: "Reference" },
          { key: "tenant", label: "Tenant" },
          { key: "room", label: "Room" },
          { key: "bill", label: "Bill #" },
        ]}
        rows={report.rows.map((row) => (
          <tr key={row.payment_id} className="border-t border-[var(--color-border)] hover:bg-[var(--surface-muted)] transition-colors duration-100">
            <td className="px-4 py-3.5 font-mono text-xs text-[var(--color-text-secondary)]">{row.payment_id}</td>
            <td className="px-4 py-3.5 text-[var(--color-text)]">{formatDateString(row.payment_date)}</td>
            <td className="px-4 py-3.5 text-right font-mono tabular-nums font-semibold text-emerald-700">{formatPHP(row.amount_paid)}</td>
            <td className="px-4 py-3.5 capitalize text-[var(--color-text)]">{row.payment_method.replace('_', ' ')}</td>
            <td className="px-4 py-3.5 text-xs text-[var(--color-text-secondary)]">{row.reference_number || "—"}</td>
            <td className="px-4 py-3.5 font-medium text-[var(--color-text)]">{row.tenant_name}</td>
            <td className="px-4 py-3.5 text-[var(--color-text)]">{row.room_code}</td>
            <td className="px-4 py-3.5 font-mono text-xs hover:underline cursor-pointer text-[var(--color-primary)]">#{row.billing_id}</td>
          </tr>
        ))}
        emptyTitle="No payments found"
        emptyDescription="Try a different date range or filter."
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
