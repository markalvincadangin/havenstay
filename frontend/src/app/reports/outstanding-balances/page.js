"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiRequest } from "../../../lib/api";
import { canViewReports } from "../../../lib/auth";
import { useAuthGuard } from "../../../hooks/useAuthGuard";
import { downloadCsvWithAuth } from "../../../lib/downloads";
import { flattenApiErrors } from "../../../lib/errors";
import { daysPastDue, isPastDueReceivable } from "../../../lib/billingReceivables";
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
import { StatusBadge } from "../../../components/ui/StatusBadge";

function buildQuery(params) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  const value = query.toString();
  return value ? `?${value}` : "";
}

export default function OutstandingBalancesReportPage() {
  const { user: currentUser, authLoading } = useAuthGuard();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [apiError, setApiError] = useState("");
  const [apiUnavailable, setApiUnavailable] = useState(false);
  const [report, setReport] = useState({ summary: null, rows: [] });
  const [tenants, setTenants] = useState([]);
  const [filters, setFilters] = useState({ tenant_id: "", due_from: "", due_to: "" });

  const loadTenants = useCallback(async () => {
    try {
      const data = await apiRequest("/api/tenants", { method: "GET" });
      const rows = Array.isArray(data) ? data : data?.tenants || [];
      setTenants(rows.sort((a, b) => String(a.last_name).localeCompare(String(b.last_name))));
    } catch {
      setTenants([]);
    }
  }, []);

  const loadReport = useCallback(async (nextFilters = {}) => {
    const query = buildQuery(nextFilters);
    const data = await apiRequest(`/api/reports/outstanding-balances${query}`, { method: "GET" });
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
        await Promise.all([
          loadTenants(),
          loadReport({ tenant_id: "", due_from: "", due_to: "" }),
        ]);
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
  }, [authLoading, currentUser, loadReport, loadTenants]);

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
      await downloadCsvWithAuth(`/api/reports/outstanding-balances/export${query}`, `outstanding-balances-report-${stamp}.csv`);
    } catch (error) {
      setApiError(flattenApiErrors(error));
    } finally {
      setExporting(false);
    }
  };

  // Past-due KPIs (calendar): any outstanding balance whose due date has passed — includes `partial`
  const pastDueRows = report.rows.filter(isPastDueReceivable);
  const pastDueAmount = pastDueRows.reduce((sum, r) => sum + (Number(r.outstanding_balance) || 0), 0);
  const pastDueCount = pastDueRows.length;
  const oldestPastDueDays = pastDueRows.reduce((max, r) => {
    const days = calculateDaysOverdue(r.due_date);
    return days > max ? days : max;
  }, 0);

  const selectedTenantLabel = filters.tenant_id
    ? tenants.find((t) => String(t.tenant_id) === String(filters.tenant_id))
    : null;

  if (authLoading || loading) {
    return (
      <AppMain>
        <Spinner label="Loading outstanding balances report..." />
      </AppMain>
    );
  }

  return (
    <AppMain>
      <PageHeader
        title="Outstanding Balances"
        subtitle="Monitor receivables and overdue balances by tenant and due date."
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: "Reports", href: "/reports" },
              { label: "Outstanding Balances" },
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

      {/* 4 KPI cards per spec - Moved outside card for better visibility per plan */}
      {/* 4 KPI cards per spec - Moved outside card for better visibility per plan */}
      <Card className="mt-8 border-none bg-stone-100/50 shadow-inner">
        <p className="mb-4 px-1 text-xs text-[var(--color-text-secondary)]">
          Past due = due date has passed and a balance remains (includes{" "}
          <span className="font-semibold">partial</span> payments; billing status may still show &quot;partial&quot;).
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            label="Total Outstanding"
            value={formatPHP(report.summary?.total_outstanding)}
          />
          <Metric
            label="Past Due Amount"
            value={formatPHP(pastDueAmount)}
            variant="danger"
          />
          <Metric label="Past Due Count" value={pastDueCount} variant="danger" />
          <Metric
            label="Oldest Past Due"
            value={oldestPastDueDays > 0 ? `${oldestPastDueDays}d` : "—"}
            variant={oldestPastDueDays > 0 ? "danger" : undefined}
          />
        </div>
      </Card>

      <Card className="mt-8">
        <form
          className="grid gap-3 sm:grid-cols-4"
          onSubmit={onApplyFilters}
        >
          <Field label="Tenant">
            <Select
              className="!h-11 border-stone-200"
              value={filters.tenant_id}
              disabled={apiUnavailable}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, tenant_id: event.target.value }))
              }
            >
              <option value="">All tenants</option>
              {tenants.map((t) => (
                <option key={t.tenant_id} value={String(t.tenant_id)}>
                  {t.last_name}, {t.first_name} (#{t.tenant_id})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Due From">
            <Input
              type="date"
              value={filters.due_from}
              disabled={apiUnavailable}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, due_from: event.target.value }))
              }
            />
          </Field>
          <Field label="Due To">
            <Input
              type="date"
              value={filters.due_to}
              disabled={apiUnavailable}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, due_to: event.target.value }))
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
              key: "tenant_id",
              label: "Tenant",
              value: filters.tenant_id
                ? selectedTenantLabel
                  ? `${selectedTenantLabel.last_name}, ${selectedTenantLabel.first_name}`
                  : `#${filters.tenant_id}`
                : "",
              onClear: () => setFilters((prev) => ({ ...prev, tenant_id: "" })),
            },
            {
              key: "due_from",
              label: "Due From",
              value: filters.due_from,
              onClear: () => setFilters((prev) => ({ ...prev, due_from: "" })),
            },
            {
              key: "due_to",
              label: "Due To",
              value: filters.due_to,
              onClear: () => setFilters((prev) => ({ ...prev, due_to: "" })),
            },
          ]}
          onClearAll={() => setFilters({ tenant_id: "", due_from: "", due_to: "" })}
        />

        {apiUnavailable ? (
          <Alert
            variant="info"
            className="mt-4"
            title="Backend report endpoint unavailable"
          >
            Outstanding balances report data is not yet available from the API.
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
        caption="Outstanding balances report table"
        ariaLabel="Outstanding balances report results"
        columns={[
          { key: "tenant", label: "Tenant" },
          { key: "room", label: "Room" },
          { key: "period", label: "Period" },
          { key: "dueDate", label: "Due Date" },
          { key: "daysOverdue", label: "Days Overdue" },
          { key: "balance", label: "Balance" },
          { key: "status", label: "Status" },
          { key: "actions", label: "Actions" },
        ]}
        rows={report.rows.map((row) => {
          const daysOverdue = daysPastDue(row.due_date);
          const isPastDue = isPastDueReceivable(row);
          return (
            <tr key={row.billing_id} className="border-t border-[var(--color-border)] hover:bg-[var(--surface-muted)] transition-colors duration-100">
              <td className="px-4 py-3.5 font-medium text-[var(--color-text)]">{row.tenant_name}</td>
              <td className="px-4 py-3.5 text-[var(--color-text)]">{row.room_code}</td>
              <td className="px-4 py-3.5 text-[var(--color-text-secondary)]">
                {row.billing_period_from && row.billing_period_to
                  ? `${formatDateString(row.billing_period_from)} – ${formatDateString(row.billing_period_to)}`
                  : "—"}
              </td>
              <td className="px-4 py-3.5 text-[var(--color-text)]">{formatDateString(row.due_date)}</td>
              <td className="px-4 py-3.5">
                {isPastDue ? (
                  <span className="font-semibold text-[#991B1B]">
                    {daysOverdue} {daysOverdue === 1 ? "day" : "days"}
                  </span>
                ) : (
                  <span className="text-[var(--color-text-secondary)]">—</span>
                )}
              </td>
              <td className="px-4 py-3.5 text-right font-mono tabular-nums font-semibold">
                {row.outstanding_balance < 0 ? (
                  <span className="text-[#065F46]">
                    {formatPHP(Math.abs(row.outstanding_balance))} <span className="text-xs font-medium">Credit</span>
                  </span>
                ) : (
                  <span className={row.outstanding_balance > 0 ? "text-[#991B1B]" : "text-[var(--color-text-secondary)]"}>
                    {formatPHP(row.outstanding_balance)}
                  </span>
                )}
              </td>
              <td className="px-4 py-3.5"><StatusBadge>{row.status}</StatusBadge></td>
              <td className="px-4 py-3.5 text-right">
                {row.billing_id ? (
                  <Link
                    href={`/billing/${row.billing_id}`}
                    className="text-sm font-medium text-[var(--color-primary)] hover:underline cursor-pointer"
                  >
                    Pay
                  </Link>
                ) : null}
              </td>
            </tr>
          );
        })}
        emptyTitle="No outstanding balances found"
        emptyDescription="Adjust filters or clear date fields to broaden results."
      />

      {/* Report footer */}
      <div className="mt-6 flex flex-col gap-2 border-t border-[var(--color-border)] pt-4 text-xs text-[var(--color-text-secondary)] sm:flex-row sm:justify-between">
        <span>Generated {formatReportTimestamp()}</span>
        <span>{report.rows.length} records</span>
      </div>
      </div>
    </AppMain>
  );
}

function Metric({ label, value, variant }) {
  const valueClass =
    variant === "danger"
      ? "text-[#991B1B]"
      : "text-[var(--color-text)]";
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-5 shadow-sm" aria-label={`${label}: ${value ?? "—"}`}>
      <div className="text-xs font-medium uppercase tracking-[0.06em] text-[var(--color-text-secondary)]">{label}</div>
      <div className={`mt-2 font-sans text-[1.875rem] font-semibold leading-none tracking-[-0.025em] ${valueClass}`}>{value ?? "—"}</div>
    </div>
  );
}
