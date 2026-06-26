'use client';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { fetcher } from '@/lib/api';
import useSWR from 'swr';
import { canViewReports } from '@/lib/auth';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { flattenApiErrors } from '@/lib/errors';
import { daysPastDue, isPastDueReceivable } from '@/lib/billingReceivables';
import { exportReportCsv } from '@/lib/downloads';
import TablePagination from '@/components/ui/TablePagination';
import ResourceView from '@/components/ui/ResourceView';
import {
  buildReportListQuery,
  normalizePaginatedList,
  normalizeReportRows,
  readStoredPerPage,
} from '@/lib/pagination';
import { formatDateString } from '@/lib/formatters';
import { useToasts } from '@/context/ToastContext';
import CurrencyDisplay from '@/components/ui/CurrencyDisplay';
import Alert from '@/components/ui/Alert';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
import Button from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import FilterChips from '@/components/ui/FilterChips';
import FilterPanelCard from '@/components/ui/FilterPanelCard';
import { Field, Input, Select } from '@/components/ui/Fields';
import { SkeletonListPage } from '@/components/ui/Skeleton';
import { KpiCard } from '@/components/ui/KpiCard';
import { Table } from '@/components/ui/Table';
import { StatusBadge } from '@/components/ui/StatusBadge';
import StandardPage from '@/components/ui/StandardPage';
import ReportHeaderActions from '@/components/ui/ReportHeaderActions';
import { usePaginatedFilters } from '@/hooks/usePaginatedFilters';
import { useReportExport } from '@/hooks/useReportExport';
import ResourceIdCell from '@/components/ui/ResourceIdCell';
import {
  AlertCircle,
  Users,
  Calendar,
  Clock,
  AlertTriangle,
} from 'lucide-react';
export default function OutstandingBalancesReportPage() {
  const { user: currentUser, authLoading, isUnauthorized } = useAuthGuard();
  const { showToast } = useToasts();
  const { exporting, performExport } = useReportExport();
  const [apiError, setApiError] = useState('');
  const [apiUnavailable, setApiUnavailable] = useState(false);
  const [report, setReport] = useState({ summary: null, rows: [] });
  const [tableMeta, setTableMeta] = useState(null);
  const [tenants, setTenants] = useState([]);

  const {
    filters,
    updateFilter,
    resetFilters,
    page,
    setPage,
    perPage,
    setPerPage,
    queryString,
  } = usePaginatedFilters({
    initialFilters: { tenant_id: '', due_from: '', due_to: '' },
    buildExtraParams: ({ filters: current }) => {
      const extra = {};
      if (current.tenant_id) extra.tenant_id = current.tenant_id;
      if (current.due_from) extra.due_from = current.due_from;
      if (current.due_to) extra.due_to = current.due_to;
      return extra;
    },
  });

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
        rows.sort((a, b) =>
          String(a.last_name).localeCompare(String(b.last_name))
        )
      );
    }
  }, [tenantsData]);
  const {
    data: reportData,
    error: reportError,
    mutate: loadReport,
    isValidating,
  } = useSWR(
    !authLoading && currentUser && canViewReports(currentUser)
      ? `/api/reports/outstanding-balances${queryString}`
      : null,
    fetcher,
    { keepPreviousData: true }
  );
  const loading =
    !reportData &&
    !reportError &&
    !apiUnavailable &&
    !authLoading &&
    currentUser &&
    canViewReports(currentUser);
  useEffect(() => {
    if (reportError) {
      if (reportError?.status === 404) {
        setApiUnavailable(true);
        setApiError('');
      } else {
        setApiError(flattenApiErrors(reportError));
      }
    } else if (
      authLoading === false &&
      currentUser &&
      !canViewReports(currentUser)
    ) {
      setApiError(
        'Access restricted. You don’t have permission to view this report.'
      );
    }
  }, [reportError, authLoading, currentUser]);
  useEffect(() => {
    if (reportData) {
      setApiUnavailable(false);
      setReport(reportData);
      setTableMeta(normalizeReportRows(reportData, 'rows').meta);
    }
  }, [reportData]);

  const hasActiveFilters =
    Boolean(filters.tenant_id) ||
    Boolean(filters.due_from) ||
    Boolean(filters.due_to);

  const onExport = async () => {
    if (apiUnavailable) return;
    setApiError('');
    await performExport({
      endpoint: '/api/reports/outstanding-balances/export',
      filters,
      filenamePrefix: 'outstanding-balances-report',
      label: 'Outstanding Balances Report',
    });
  };
  const rows = normalizeReportRows(report, 'rows').rows;
  const pastDueAmount = Number(report.summary?.past_due_amount ?? 0);
  const pastDueCount = Number(report.summary?.past_due_count ?? 0);
  const oldestPastDueDays = Number(report.summary?.oldest_past_due_days ?? 0);
  const selectedTenantLabel = filters.tenant_id
    ? tenants.find((t) => String(t.tenant_id) === String(filters.tenant_id))
    : null;
  if (isUnauthorized) return null;
  return (
    <StandardPage
      title="Outstanding Balances"
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
      skeleton={<SkeletonListPage rows={10} />}
      breadcrumbs={
        <Breadcrumbs
          items={[
            { label: 'Reports', href: '/admin/reports' },
            { label: 'Outstanding Balances' },
          ]}
        />
      }
      actions={
        <ReportHeaderActions
          user={currentUser}
          onExport={onExport}
          exporting={exporting}
          exportDisabled={exporting || apiUnavailable}
        />
      }
    >
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total Outstanding"
          value={report.summary?.total_outstanding}
          icon={AlertCircle}
          isSyncing={isValidating}
          currency={true}
          className="hs-glass-effect"
        />
        <KpiCard
          label="Past-Due Balance"
          value={pastDueAmount}
          isDanger={pastDueAmount > 0}
          icon={AlertTriangle}
          sub="Immediate action required"
          isSyncing={isValidating}
          currency={true}
          className="hs-glass-effect"
        />
        <KpiCard
          label="Past-Due Accounts"
          value={pastDueCount}
          isDanger={pastDueCount > 0}
          icon={Users}
          isSyncing={isValidating}
          className="hs-glass-effect"
        />
        <KpiCard
          label="Oldest Past Due"
          value={oldestPastDueDays > 0 ? `${oldestPastDueDays} days` : '—'}
          isDanger={oldestPastDueDays > 30}
          icon={Clock}
          isSyncing={isValidating}
          className="hs-glass-effect"
        />
      </div>
      <FilterPanelCard icon={Users}>
        <div className="grid gap-6 sm:grid-cols-4">
          <Field label="Tenant" icon={Users}>
            <Select
              className="!h-11 border-stone-200"
              value={filters.tenant_id}
              disabled={apiUnavailable}
              onChange={(event) =>
                updateFilter('tenant_id', event.target.value)
              }
            >
              <option value="">All Tenants</option>
              {tenants.map((t) => (
                <option key={t.tenant_id} value={String(t.tenant_id)}>
                  {t.last_name}, {t.first_name} ({t.tenant_id})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Due From" icon={Calendar}>
            <Input
              type="date"
              value={filters.due_from}
              disabled={apiUnavailable}
              onChange={(event) => updateFilter('due_from', event.target.value)}
              className="!h-11"
            />
          </Field>
          <Field label="Due To" icon={Calendar}>
            <Input
              type="date"
              value={filters.due_to}
              disabled={apiUnavailable}
              onChange={(event) => updateFilter('due_to', event.target.value)}
              className="!h-11"
            />
          </Field>
        </div>
        <div className="mt-6">
          <FilterChips
            items={[
              {
                key: 'tenant_id',
                label: 'Tenant',
                value: filters.tenant_id
                  ? selectedTenantLabel
                    ? `${selectedTenantLabel.last_name}, ${selectedTenantLabel.first_name}`
                    : `#${filters.tenant_id}`
                  : '',
                onClear: () => updateFilter('tenant_id', ''),
              },
              {
                key: 'due_from',
                label: 'From',
                value: filters.due_from,
                onClear: () => updateFilter('due_from', ''),
              },
              {
                key: 'due_to',
                label: 'To',
                value: filters.due_to,
                onClear: () => updateFilter('due_to', ''),
              },
            ]}
            onClearAll={resetFilters}
          />
        </div>
        {apiUnavailable ? (
          <Alert variant="info" className="mt-6" title="Report unavailable">
            The outstanding balances endpoint did not respond. Check API
            configuration and try again.
          </Alert>
        ) : null}
        {apiError ? (
          <Alert variant="error" className="mt-6" title="Error">
            {apiError}
          </Alert>
        ) : null}
      </FilterPanelCard>
      <ResourceView
        isLoading={loading}
        isSyncing={isValidating}
        error={reportError}
        isEmpty={rows.length === 0}
        onRetry={() => loadReport()}
        skeleton={<SkeletonListPage rows={10} />}
        emptyProps={{
          title: 'No outstanding balances',
          description:
            'No pending receivables matched your filters. Adjust your search or date range.',
          action: hasActiveFilters ? (
            <Button
              variant="secondary"
              className="!h-12 rounded-xl px-10 text-[10px] font-bold uppercase tracking-widest"
              onClick={resetFilters}
            >
              Clear filters
            </Button>
          ) : null,
        }}
      >
        <Card className="mt-8 overflow-hidden border-stone-200 !p-0 shadow-sm rounded-2xl hs-glass-effect">
          <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/50 px-8 py-4">
            <h2 className="hs-strip-title uppercase tracking-[0.2em] text-[10px] font-black text-stone-400">
              OUTSTANDING BALANCES DIRECTORY
            </h2>
            <div className="text-[10px] font-mono font-bold text-stone-400 uppercase tracking-widest leading-none">
              {tableMeta?.total ?? rows.length} RECORDS MATCHING
            </div>
          </div>
          <Table
            embedded={true}
            caption="Outstanding Balances"
            ariaLabel="Outstanding balance records"
            columns={[
              { key: 'billing_id', label: 'Billing ID', className: 'w-32' },
              { key: 'tenant', label: 'Tenant' },
              { key: 'room', label: 'Room', className: 'text-center' },
              { key: 'period', label: 'Period', className: 'text-center' },
              {
                key: 'dueDate',
                label: 'Due Date',
                className: 'text-center',
                headerClassName: 'whitespace-nowrap',
              },
              { key: 'daysOverdue', label: 'Aging', className: 'text-center' },
              { key: 'balance', label: 'Balance', className: 'text-right' },
              { key: 'status', label: 'Status', className: 'text-center' },
              { key: 'actions', label: '', className: 'text-right w-16' },
            ]}
            rows={rows.map((row) => {
              const daysOverdue = daysPastDue(row.due_date);
              const isPastDue = isPastDueReceivable(row);
              return (
                <tr
                  key={row.billing_id}
                  className="border-t border-stone-100 hover:bg-stone-50 transition-colors duration-100"
                >
                  <td className="px-6 py-3 font-mono text-[10px] font-bold uppercase tracking-tighter text-stone-400 tabular-nums">
                    <ResourceIdCell id={row.billing_id} prefix="BILL" />
                  </td>
                  <td className="px-6 py-3 text-xs font-bold text-stone-900">
                    {row.tenant_name}
                  </td>
                  <td className="px-6 py-3 text-center">
                    <div className="font-mono text-[10px] font-black uppercase tracking-tighter text-stone-500 leading-tight">
                      {row.room_code}
                    </div>
                    <ResourceIdCell id={row.room_id} prefix="ROOM" />
                  </td>
                  <td className="px-6 py-3 text-center text-[10px] font-medium text-stone-400">
                    {row.billing_period_from && row.billing_period_to
                      ? `${formatDateString(row.billing_period_from)} – ${formatDateString(row.billing_period_to)}`
                      : '—'}
                  </td>
                  <td className="px-6 py-3 text-center text-xs font-medium text-stone-600">
                    {formatDateString(row.due_date)}
                  </td>
                  <td className="px-6 py-3 text-center">
                    {isPastDue ? (
                      <span className="text-[10px] font-black uppercase tracking-widest text-rose-600 bg-rose-50 px-2 py-1 rounded-md border border-rose-100">
                        {daysOverdue} {daysOverdue === 1 ? 'day' : 'days'} late
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-stone-300 uppercase tracking-widest">
                        On Track
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-right">
                    {row.outstanding_balance < 0 ? (
                      <div className="flex justify-end items-baseline gap-1">
                        <CurrencyDisplay
                          amount={Math.abs(row.outstanding_balance)}
                          className="text-xs font-bold text-emerald-700"
                        />
                        <span className="text-[9px] font-black text-emerald-600 uppercase tracking-tighter">
                          CR
                        </span>
                      </div>
                    ) : (
                      <CurrencyDisplay
                        amount={row.outstanding_balance}
                        className={`text-xs font-bold ${row.outstanding_balance > 0 ? 'text-rose-800' : 'text-stone-400'}`}
                      />
                    )}
                  </td>
                  <td className="px-6 py-3 text-center">
                    <StatusBadge>{row.status}</StatusBadge>
                  </td>
                  <td className="px-6 py-3 text-right">
                    {row.billing_id ? (
                      <Link
                        href={`/billing/${row.billing_id}`}
                        className="text-[10px] font-black uppercase tracking-widest text-teal-600 hover:text-teal-900 px-3 py-1.5 rounded-lg border border-teal-100 hover:bg-teal-50 transition-colors"
                      >
                        View Billing
                      </Link>
                    ) : null}
                  </td>
                </tr>
              );
            })}
            emptyTitle="No outstanding balances found"
            emptyDescription="Adjust your filters or clear date fields to check for records in inventory."
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
          <p className="mt-4 px-1 text-[11px] leading-relaxed text-stone-500">
            <strong className="text-stone-600">Aging</strong> uses calendar
            past-due plus a positive balance. The{' '}
            <strong className="text-stone-600">status</strong> column follows
            billing rules where <em>Past Due</em> means the due date has passed
            and a balance still remains; this can include both unpaid and
            partially paid bills.
          </p>
        </Card>
      </ResourceView>
    </StandardPage>
  );
}
