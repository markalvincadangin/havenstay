'use client';

import { useEffect, useState, useMemo } from 'react';
import { fetcher } from '@/lib/api';
import useSWR from 'swr';
import { canViewReports } from '@/lib/auth';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { flattenApiErrors } from '@/lib/errors';
import { formatDateString } from '@/lib/formatters';
import CurrencyDisplay from '@/components/ui/CurrencyDisplay';
import CurrencyCell from '@/components/ui/CurrencyCell';
import { useToasts } from '@/context/ToastContext';
import { exportReportCsv } from '@/lib/downloads';
import Alert from '@/components/ui/Alert';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
import Button from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, Select } from '@/components/ui/Fields';
import { SkeletonListPage } from '@/components/ui/Skeleton';
import { KpiCard } from '@/components/ui/KpiCard';
import { Table } from '@/components/ui/Table';
import { BookOpen, User, Landmark, DollarSign, Activity } from 'lucide-react';
import StandardPage from '@/components/ui/StandardPage';
import ReportHeaderActions from '@/components/ui/ReportHeaderActions';
import { normalizePaginatedList, normalizeReportRows } from '@/lib/pagination';
import { usePaginatedFilters } from '@/hooks/usePaginatedFilters';
import { useReportExport } from '@/hooks/useReportExport';
import FilterPanelCard from '@/components/ui/FilterPanelCard';
import ResourceView from '@/components/ui/ResourceView';
import TablePagination from '@/components/ui/TablePagination';
import ResourceIdCell from '@/components/ui/ResourceIdCell';

export default function TenantLedgerReportPage() {
  const { user: currentUser, authLoading, isUnauthorized } = useAuthGuard();
  const { showToast } = useToasts();
  const { exporting, performExport } = useReportExport();
  const [apiError, setApiError] = useState('');
  const [tenants, setTenants] = useState([]);
  const [report, setReport] = useState({
    tenant: null,
    summary: null,
    entries: [],
  });
  const [tableMeta, setTableMeta] = useState(null);

  const {
    filters,
    updateFilter,
    page,
    setPage,
    perPage,
    setPerPage,
    queryString,
  } = usePaginatedFilters({
    initialFilters: { tenant_id: '' },
    buildExtraParams: ({ filters: current }) => {
      const extra = {};
      if (current.tenant_id) extra.tenant_id = current.tenant_id;
      return extra;
    },
  });

  const selectedTenantId = filters.tenant_id;

  const { data: tenantsData } = useSWR(
    !authLoading && currentUser && canViewReports(currentUser)
      ? '/api/tenants?per_page=100'
      : null,
    fetcher
  );

  useEffect(() => {
    if (tenantsData) {
      const rows = normalizePaginatedList(tenantsData).rows;
      setTenants(
        rows
          .filter((t) => t.status !== 'archived')
          .sort((a, b) => a.last_name.localeCompare(b.last_name))
      );
    }
  }, [tenantsData]);

  const {
    data: reportData,
    error: reportError,
    mutate: loadLedger,
    isValidating,
  } = useSWR(
    !authLoading &&
      currentUser &&
      canViewReports(currentUser) &&
      selectedTenantId
      ? `/api/reports/tenant-ledger${queryString}`
      : null,
    fetcher,
    { keepPreviousData: true }
  );

  const fetchingLedger = isValidating;
  const loading =
    !currentUser ||
    (!reportData &&
      !reportError &&
      selectedTenantId &&
      !authLoading &&
      currentUser &&
      canViewReports(currentUser));

  useEffect(() => {
    if (reportError) {
      setApiError(flattenApiErrors(reportError));
    } else if (
      authLoading === false &&
      currentUser &&
      !canViewReports(currentUser)
    ) {
      setApiError(
        'Access restricted. You don’t have permission to access financial records.'
      );
    }
  }, [reportError, authLoading, currentUser]);

  useEffect(() => {
    if (reportData && selectedTenantId) {
      setReport(reportData);
      setTableMeta(normalizeReportRows(reportData, 'entries').meta);
    }
  }, [reportData, selectedTenantId]);

  const hasActiveFilters = Boolean(selectedTenantId);

  const handleTenantChange = (id) => {
    updateFilter('tenant_id', id);
    if (!id) {
      setReport({ tenant: null, summary: null, entries: [] });
      setTableMeta(null);
    }
  };

  const onExport = async () => {
    if (!selectedTenantId) return;
    setApiError('');
    const tenantName = report.tenant?.name
      ? report.tenant.name.toLowerCase().replace(/ /g, '_')
      : 'tenant';
    await performExport({
      endpoint: '/api/reports/tenant-ledger/export',
      filters: { tenant_id: selectedTenantId },
      filenamePrefix: `ledger-${tenantName}`,
      label: 'Tenant Ledger Report',
    });
  };

  if (isUnauthorized) return null;

  const { rows: entries } = normalizeReportRows(report, 'entries');

  return (
    <StandardPage
      title="Tenant Ledger"
      subtitle={
        <div className="flex flex-col gap-2">
          <p>Filter and export system data.</p>
          <div className="flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-[0.15em] text-stone-400/70">
            <span>
              Generated {new Date().toLocaleDateString()}{' '}
              {new Date().toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
            <span className="text-stone-200">|</span>
            <span>{tableMeta?.total ?? 0} Records</span>
          </div>
        </div>
      }
      loading={authLoading || loading}
      skeleton={<SkeletonListPage rows={8} />}
      breadcrumbs={
        <Breadcrumbs
          items={[
            { label: 'Reports', href: '/admin/reports' },
            { label: 'Tenant Ledger' },
          ]}
        />
      }
      actions={
        <ReportHeaderActions
          user={currentUser}
          onExport={onExport}
          exporting={exporting}
          exportDisabled={exporting}
          showExport={Boolean(selectedTenantId)}
        />
      }
    >
      {selectedTenantId && report.summary && (
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <KpiCard
            label="Total Billed"
            value={report.summary.total_billed}
            icon={Activity}
            isSyncing={isValidating}
            currency={true}
            className="hs-glass-effect"
          />
          <KpiCard
            label="Total Paid"
            value={report.summary.total_paid}
            icon={DollarSign}
            isSyncing={isValidating}
            currency={true}
            className="hs-glass-effect"
          />
          <KpiCard
            label="Current Balance"
            value={report.summary.current_balance}
            isDanger={report.summary.current_balance > 0}
            icon={Landmark}
            sub={
              report.summary.current_balance > 0
                ? 'Amount Outstanding'
                : 'Settled Balance'
            }
            isSyncing={isValidating}
            currency={true}
            className="hs-glass-effect"
          />
        </div>
      )}

      <FilterPanelCard icon={User}>
        <div className="flex items-center justify-between mb-4">
          {selectedTenantId && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => loadLedger()}
              className="!h-8 px-3 text-[10px] font-bold uppercase tracking-widest text-stone-400 hover:text-teal-600 ml-auto"
            >
              Refresh Ledger
            </Button>
          )}
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Search Tenant">
            <Select
              className="!h-11 border-stone-200"
              value={selectedTenantId}
              onChange={(e) => handleTenantChange(e.target.value)}
              disabled={fetchingLedger}
            >
              <option value="">Select a tenant name...</option>
              {tenants.map((t) => (
                <option key={t.tenant_id} value={t.tenant_id}>
                  {t.last_name}, {t.first_name} ({t.status})
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {apiError ? (
          <Alert variant="error" className="mt-6" title="Sync Error">
            {apiError}
          </Alert>
        ) : null}
      </FilterPanelCard>

      {selectedTenantId ? (
        <ResourceView
          isLoading={loading}
          isSyncing={isValidating}
          error={reportError}
          isEmpty={entries.length === 0}
          onRetry={() => loadLedger()}
          skeleton={<SkeletonListPage rows={10} />}
          emptyProps={{
            title: selectedTenantId
              ? 'No transactions found'
              : 'No tenant selected',
            description: selectedTenantId
              ? 'This tenant has no financial entries on record.'
              : 'Select a tenant from the filters above to view their financial ledger.',
            action: hasActiveFilters ? (
              <Button
                variant="secondary"
                className="!h-12 rounded-xl px-10 text-[10px] font-bold uppercase tracking-widest"
                onClick={() => updateFilter('tenant_id', '')}
              >
                Clear filters
              </Button>
            ) : null,
          }}
        >
          <Card className="mt-8 overflow-hidden border-stone-200 !p-0 shadow-sm rounded-2xl hs-glass-effect">
            <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/50 px-8 py-4">
              <h2 className="hs-strip-title uppercase tracking-[0.2em] text-[10px] font-black text-stone-400">
                FINANCIAL STATEMENT DIRECTORY
              </h2>
              <div className="text-[10px] font-mono font-bold text-stone-400 uppercase tracking-widest leading-none">
                {tableMeta?.total ?? entries.length} ENTRIES
              </div>
            </div>
            <Table
              embedded={true}
              caption={`Financial statement for ${report.tenant?.name}`}
              ariaLabel="Tenant financial ledger"
              columns={[
                {
                  key: 'date',
                  label: 'Date',
                  className: 'text-center w-24',
                  headerClassName: 'whitespace-nowrap',
                },
                {
                  key: 'ref',
                  label: 'Entry ID',
                  className: 'w-28 text-center',
                },
                { key: 'desc', label: 'Description' },
                { key: 'debit', label: 'Charges', className: 'text-right' },
                { key: 'credit', label: 'Payments', className: 'text-right' },
                { key: 'balance', label: 'Balance', className: 'text-right' },
              ]}
              rows={entries.map((entry, idx) => (
                <tr
                  key={`${entry.link_type}-${entry.link_id}-${idx}`}
                  className="border-t border-stone-100 hover:bg-stone-50 transition-colors duration-100"
                >
                  <td className="px-6 py-4 text-[10px] text-center font-medium text-stone-400 uppercase font-mono">
                    {formatDateString(entry.date)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {entry.link_type === 'billing' ? (
                      <ResourceIdCell id={entry.link_id} prefix="BILL" />
                    ) : entry.link_type === 'payment' ? (
                      <ResourceIdCell id={entry.link_id} prefix="PAY" />
                    ) : (
                      <span className="text-stone-300">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-xs font-bold text-stone-700">
                    {entry.description}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {entry.type === 'debit' ? (
                      <CurrencyDisplay
                        amount={entry.amount}
                        className={
                          Number(entry.amount) === 0
                            ? 'text-stone-300 opacity-40 text-xs font-bold'
                            : 'text-rose-800 font-bold text-xs'
                        }
                      />
                    ) : (
                      <span className="text-stone-300">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {entry.type === 'credit' ? (
                      <CurrencyDisplay
                        amount={entry.amount}
                        className={
                          Number(entry.amount) === 0
                            ? 'text-stone-300 opacity-40 text-xs font-bold'
                            : 'text-teal-700 font-bold text-xs'
                        }
                      />
                    ) : (
                      <span className="text-stone-300">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <CurrencyDisplay
                      amount={entry.running_balance}
                      className={`text-xs font-bold ${entry.running_balance > 0 ? 'text-stone-900' : 'text-emerald-800'}`}
                    />
                  </td>
                </tr>
              ))}
              emptyTitle="No financial records found"
              emptyDescription="This tenant has no recorded transactions in the authoritative ledger."
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
      ) : (
        <div className="mt-12 flex flex-col items-center justify-center text-center py-20 border-2 border-dashed border-stone-200 rounded-3xl bg-stone-50/20">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm border border-stone-100 mb-6 text-stone-300">
            <BookOpen size={32} strokeWidth={1.5} />
          </div>
          <h3 className="hs-strip-title uppercase tracking-widest text-sm font-black text-stone-500">
            Awaiting Tenant Selection
          </h3>
          <p className="text-[11px] font-medium text-stone-400 mt-2 max-w-xs leading-relaxed">
            Select a tenant from the selection panel above to view their
            itemized financial history and running balance.
          </p>
        </div>
      )}
    </StandardPage>
  );
}
