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
import { Field, Select } from "../../_components/ui/Fields";
import PageHeader from "../../_components/ui/PageHeader";
import Spinner from "../../_components/ui/Spinner";
import UserRoleBadge from "../../_components/ui/UserRoleBadge";
import { Table } from "../../_components/ui/Table";

export default function TenantLedgerReportPage() {
  const { user: currentUser, authLoading } = useAuthGuard();
  const [loading, setLoading] = useState(true);
  const [fetchingLedger, setFetchingLedger] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [apiError, setApiError] = useState("");
  const [tenants, setTenants] = useState([]);
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [report, setReport] = useState({ tenant: null, summary: null, entries: [] });

  const loadTenants = useCallback(async () => {
    try {
      const data = await apiRequest("/api/tenants", { method: "GET" });
      const rows = Array.isArray(data) ? data : data?.tenants || [];
      setTenants(rows.filter(t => t.status !== 'archived').sort((a, b) => a.last_name.localeCompare(b.last_name)));
    } catch (_error) {
      setApiError("Failed to load tenants list.");
    }
  }, []);

  const loadLedger = useCallback(async (tenantId) => {
    if (!tenantId) return;
    setFetchingLedger(true);
    setApiError("");
    try {
      const data = await apiRequest(`/api/reports/tenant-ledger?tenant_id=${tenantId}`, { method: "GET" });
      setReport(data);
    } catch (error) {
      setApiError(flattenApiErrors(error));
    } finally {
      setFetchingLedger(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading || !currentUser) return;

    if (!canViewReports(currentUser)) {
      setApiError("Unauthorized: you do not have permission to view reports.");
      setLoading(false);
      return;
    }

    loadTenants().finally(() => setLoading(false));
  }, [authLoading, currentUser, loadTenants]);

  const handleTenantChange = (id) => {
    setSelectedTenantId(id);
    if (id) {
      loadLedger(id);
    } else {
      setReport({ tenant: null, summary: null, entries: [] });
    }
  };

  const onExport = async () => {
    if (!selectedTenantId) return;
    setApiError("");
    setExporting(true);
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      const tenantName = report.tenant?.name ? report.tenant.name.toLowerCase().replace(/ /g, '_') : 'tenant';
      await downloadCsvWithAuth(`/api/reports/tenant-ledger/export?tenant_id=${selectedTenantId}`, `ledger-${tenantName}-${stamp}.csv`);
    } catch (error) {
      setApiError(flattenApiErrors(error));
    } finally {
      setExporting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <AppMain>
        <Spinner label="Loading tenant data..." />
      </AppMain>
    );
  }

  return (
    <AppMain>
      <PageHeader
        title="Detailed Tenant Ledger"
        subtitle="Chronological statement of billings, payments, and running balance."
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: "Reports", href: "/reports" },
              { label: "Tenant Ledger" },
            ]}
          />
        }
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <UserRoleBadge
              username={currentUser?.username}
              roleName={currentUser?.role?.role_name}
            />
            {selectedTenantId && (
              <Button
                type="button"
                onClick={onExport}
                loading={exporting}
                disabled={exporting}
              >
                {exporting ? "Downloading..." : "Export Statement"}
              </Button>
            )}
          </div>
        }
      />

      <p className="mt-2 text-xs italic text-[var(--color-text-secondary)] print:block">
        Generated {formatReportTimestamp()}
      </p>

      <Card className="mt-8">
        <div className="max-w-md">
          <Field label="Select Tenant to view Ledger">
            <Select
              value={selectedTenantId}
              onChange={(e) => handleTenantChange(e.target.value)}
              disabled={fetchingLedger}
            >
              <option value="">Choose a tenant...</option>
              {tenants.map(t => (
                <option key={t.tenant_id} value={t.tenant_id}>
                  {t.last_name}, {t.first_name} ({t.status})
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {apiError ? <Alert variant="error" className="mt-4" title="Problem">{apiError}</Alert> : null}
      </Card>

      {selectedTenantId && report.summary && (
        <>
          {/* Summary Metrics */}
          <Card className="mt-6 border-none bg-stone-100/50 shadow-inner">
            <div className="grid gap-4 sm:grid-cols-3">
              <Metric label="Total Billed" value={formatPHP(report.summary.total_billed)} />
              <Metric label="Total Paid" value={formatPHP(report.summary.total_paid)} />
              <Metric 
                label="Outstanding Balance" 
                value={formatPHP(report.summary.current_balance)} 
                isDanger={report.summary.current_balance > 0}
                isSuccess={report.summary.current_balance <= 0}
              />
            </div>
          </Card>

          <div className="mt-8">
            {fetchingLedger ? (
              <Spinner label="Recalculating ledger..." />
            ) : (
              <Table
                caption={`Ledger for ${report.tenant?.name}`}
                ariaLabel="Tenant ledger entries"
                columns={[
                  { key: "date", label: "Date" },
                  { key: "desc", label: "Description" },
                  { key: "debit", label: "Debit (Charge)", align: "right" },
                  { key: "credit", label: "Credit (Pay)", align: "right" },
                  { key: "balance", label: "Balance", align: "right" },
                ]}
                rows={report.entries.map((entry, idx) => (
                  <tr key={`${entry.link_type}-${entry.link_id}-${idx}`} className="border-t border-[var(--color-border)] hover:bg-[var(--surface-muted)] transition-colors duration-100">
                    <td className="px-4 py-3.5 text-xs text-[var(--color-text-secondary)]">{formatDateString(entry.date)}</td>
                    <td className="px-4 py-3.5 text-sm text-[var(--color-text)]">{entry.description}</td>
                    <td className="px-4 py-3.5 text-right font-mono tabular-nums text-red-700">
                      {entry.type === 'debit' ? formatPHP(entry.amount) : "—"}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono tabular-nums text-emerald-700">
                      {entry.type === 'credit' ? formatPHP(entry.amount) : "—"}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono tabular-nums font-semibold text-[var(--color-text)]">
                      {formatPHP(entry.running_balance)}
                    </td>
                  </tr>
                ))}
                emptyTitle="No financial records found"
                emptyDescription="This tenant has no billing cycles or payments recorded yet."
              />
            )}
          </div>
        </>
      )}

      {!selectedTenantId && !loading && (
        <div className="mt-12 flex flex-col items-center justify-center text-center py-12 border-2 border-dashed border-[var(--color-border)] rounded-2xl bg-stone-50/30">
          <div className="text-stone-300 mb-4">
             <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M12 18v-6"/><path d="M8 15h8"/></svg>
          </div>
          <h3 className="text-lg font-medium text-stone-600">No Tenant Selected</h3>
          <p className="text-sm text-stone-400 mt-1 max-w-xs">Select a tenant from the dropdown above to view their itemized financial ledger.</p>
        </div>
      )}
    </AppMain>
  );
}

function Metric({ label, value, isDanger, isSuccess }) {
  let colorClass = "text-[var(--color-text)]";
  if (isDanger) colorClass = "text-[#991B1B]";
  if (isSuccess) colorClass = "text-emerald-700";

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-5 shadow-sm" aria-label={`${label}: ${value ?? 0}`}>
      <div className="text-xs font-medium uppercase tracking-[0.06em] text-[var(--color-text-secondary)]">{label}</div>
      <div className={`mt-2 font-sans text-xl font-semibold leading-none tracking-[-0.025em] ${colorClass}`}>{value ?? 0}</div>
    </div>
  );
}
