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
import { KpiCard } from "../../_components/ui/KpiCard";
import { Table } from "../../_components/ui/Table";
import { BookOpen, User, Landmark, DollarSign, Activity } from "lucide-react";
import {
  buildReportListQuery,
  normalizePaginatedList,
  normalizeReportRows,
  readStoredPerPage,
} from "../../../lib/pagination";
import TablePagination from "../../_components/ui/TablePagination";

export default function TenantLedgerReportPage() {
  const { user: currentUser, authLoading } = useAuthGuard();
  const [loading, setLoading] = useState(true);
  const [fetchingLedger, setFetchingLedger] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [apiError, setApiError] = useState("");
  const [tenants, setTenants] = useState([]);
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [report, setReport] = useState({ tenant: null, summary: null, entries: [] });
  const [tableMeta, setTableMeta] = useState(null);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(() => readStoredPerPage());

  const loadTenants = useCallback(async () => {
    try {
      const data = await apiRequest("/api/tenants?per_page=100", { method: "GET" });
      const rows = normalizePaginatedList(data).rows;
      setTenants(rows.filter(t => t.status !== 'archived').sort((a, b) => a.last_name.localeCompare(b.last_name)));
    } catch (_error) {
      setApiError("Failed to load tenants list.");
    }
  }, []);

  const loadLedger = useCallback(async () => {
    if (!selectedTenantId) return;
    setFetchingLedger(true);
    setApiError("");
    try {
      const qs = buildReportListQuery(page, perPage, { tenant_id: selectedTenantId });
      const data = await apiRequest(`/api/reports/tenant-ledger${qs}`, { method: "GET" });
      setReport(data);
      setTableMeta(normalizeReportRows(data, "entries").meta);
    } catch (error) {
      setApiError(flattenApiErrors(error));
    } finally {
      setFetchingLedger(false);
    }
  }, [selectedTenantId, page, perPage]);

  useEffect(() => {
    if (authLoading || !currentUser) return;

    if (!canViewReports(currentUser)) {
      setApiError("Unauthorized: you do not have permission to access financial records.");
      setLoading(false);
      return;
    }

    loadTenants().finally(() => setLoading(false));
  }, [authLoading, currentUser, loadTenants]);

  useEffect(() => {
    if (!selectedTenantId) return;
    loadLedger();
  }, [selectedTenantId, loadLedger]);

  const handleTenantChange = (id) => {
    setSelectedTenantId(id);
    setPage(1);
    if (!id) {
      setReport({ tenant: null, summary: null, entries: [] });
      setTableMeta(null);
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
        <Spinner label="Loading ledger history..." />
      </AppMain>
    );
  }

  const { rows: entries } = normalizeReportRows(report, "entries");
  const totalEntries = tableMeta?.total ?? entries.length;
  const timestampLabel = selectedTenantId
    ? `Statement Generated ${formatReportTimestamp()} • ${totalEntries} entries`
    : "Select a tenant to view their itemized financial statement.";

  return (
    <AppMain>
      <PageHeader
        title="Tenant Ledger"
        subtitle={timestampLabel}
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: "Reports", href: "/reports" },
              { label: "Tenant Ledger" },
            ]}
          />
        }
        actions={
          <div className="flex flex-wrap items-center justify-end gap-3">
            <UserRoleBadge
              username={currentUser?.username}
              roleName={currentUser?.role?.role_name}
            />
            {selectedTenantId && (
              <Button
                type="button"
                variant="primary"
                onClick={onExport}
                loading={exporting}
                disabled={exporting}
                className="!h-11 rounded-xl px-8 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-teal-900/10"
              >
                Export CSV
              </Button>
            )}
          </div>
        }
      />

      {selectedTenantId && report.summary && (
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <KpiCard 
                label="Total Billed" 
                value={formatPHP(report.summary.total_billed)} 
                icon={Activity}
            />
            <KpiCard 
                label="Total Paid" 
                value={formatPHP(report.summary.total_paid)} 
                icon={DollarSign}
            />
            <KpiCard 
                label="Current Balance" 
                value={formatPHP(report.summary.current_balance)} 
                isDanger={report.summary.current_balance > 0}
                icon={Landmark}
                sub={report.summary.current_balance > 0 ? "Amount Outstanding" : "Settled Balance"}
            />
        </div>
      )}

      <Card className="mt-8 overflow-hidden border-stone-200 !p-0 shadow-sm rounded-2xl bg-white">
        <div className="border-b border-stone-100 bg-stone-50/50 px-8 py-5 flex items-center justify-between">
           <div className="flex items-center gap-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50 text-teal-600 shadow-sm border border-teal-100/50">
                 <User size={14} />
              </div>
              <h3 className="hs-strip-title uppercase tracking-widest text-xs font-black text-stone-900">Filters</h3>
           </div>
           {selectedTenantId && (
             <Button type="button" variant="ghost" onClick={() => loadLedger()} className="!h-8 px-3 text-[10px] font-bold uppercase tracking-widest text-stone-400 hover:text-teal-600">
                Refresh Ledger
             </Button>
           )}
        </div>

        <div className="p-8">
            <div className="max-w-md">
                <Field label="Choose a tenant to view history">
                    <Select
                    className="!h-11 border-stone-200"
                    value={selectedTenantId}
                    onChange={(e) => handleTenantChange(e.target.value)}
                    disabled={fetchingLedger}
                    >
                    <option value="">Select a tenant...</option>
                    {tenants.map(t => (
                        <option key={t.tenant_id} value={t.tenant_id}>
                        {t.last_name}, {t.first_name} ({t.status})
                        </option>
                    ))}
                    </Select>
                </Field>
            </div>
            {apiError ? <Alert variant="error" className="mt-6" title="Sync Error">{apiError}</Alert> : null}
        </div>
      </Card>

      {selectedTenantId ? (
        <Card className="mt-8 overflow-hidden border-stone-200 !p-0 shadow-sm rounded-2xl">
            {fetchingLedger ? (
                <div className="py-20 flex flex-col items-center justify-center text-center">
                    <Spinner label="Updating ledger records..." />
                </div>
            ) : (
                <Table
                embedded={true}
                caption={`Financial statement for ${report.tenant?.name}`}
                ariaLabel="Tenant financial ledger"
                columns={[
                  { key: "date", label: "Date" },
                  { key: "desc", label: "Description" },
                  { key: "debit", label: "Debit", className: "text-right" },
                  { key: "credit", label: "Credit", className: "text-right" },
                  { key: "balance", label: "Balance", className: "text-right" },
                ]}
                rows={entries.map((entry, idx) => (
                  <tr key={`${entry.link_type}-${entry.link_id}-${idx}`} className="border-t border-stone-100 hover:bg-stone-50 transition-colors duration-100">
                    <td className="px-6 py-4 text-[10px] font-medium text-stone-400 uppercase font-mono">{formatDateString(entry.date)}</td>
                    <td className="px-6 py-4 text-xs font-bold text-stone-700">{entry.description}</td>
                    <td className="px-6 py-4 text-right">
                        {entry.type === 'debit' ? (
                            <span className="font-mono text-xs tabular-nums text-rose-800 font-black">{formatPHP(entry.amount)}</span>
                        ) : "—"}
                    </td>
                    <td className="px-6 py-4 text-right">
                        {entry.type === 'credit' ? (
                            <span className="font-mono text-xs tabular-nums text-teal-700 font-bold">{formatPHP(entry.amount)}</span>
                        ) : "—"}
                    </td>
                    <td className="px-6 py-4 text-right">
                        <span className={[
                            "font-mono text-xs tabular-nums font-black",
                            entry.running_balance > 0 ? "text-stone-900" : "text-emerald-800"
                        ].join(" ")}>
                            {formatPHP(entry.running_balance)}
                        </span>
                    </td>
                  </tr>
                ))}
                emptyTitle="No financial records found"
                emptyDescription="This tenant has no recorded transactions in the authoritative ledger."
              />
            )}
            {!fetchingLedger && selectedTenantId ? (
              <TablePagination
                meta={tableMeta}
                page={page}
                perPage={perPage}
                onPageChange={setPage}
                onPerPageChange={(n) => {
                  setPage(1);
                  setPerPage(n);
                }}
                disabled={fetchingLedger}
              />
            ) : null}
        </Card>
      ) : (
        <div className="mt-12 flex flex-col items-center justify-center text-center py-20 border-2 border-dashed border-stone-200 rounded-3xl bg-stone-50/20">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm border border-stone-100 mb-6 text-stone-300">
             <BookOpen size={32} strokeWidth={1.5} />
          </div>
          <h3 className="hs-strip-title uppercase tracking-widest text-sm font-black text-stone-500">Awaiting Tenant Selection</h3>
          <p className="text-[11px] font-medium text-stone-400 mt-2 max-w-xs leading-relaxed">Select a tenant from the selection panel above to view their itemized financial history and running balance.</p>
        </div>
      )}
    </AppMain>
  );
}
