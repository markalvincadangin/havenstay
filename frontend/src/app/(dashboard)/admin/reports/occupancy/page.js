'use client';

import { useEffect, useState, useMemo } from 'react';
import { fetcher } from '@/lib/api';
import useSWR from 'swr';
import { canViewReports } from '@/lib/auth';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { flattenApiErrors } from '@/lib/errors';
import { exportReportCsv } from '@/lib/downloads';
import { useToasts } from '@/context/ToastContext';
import Alert from '@/components/ui/Alert';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
import { Card } from '@/components/ui/Card';
import FilterChips from '@/components/ui/FilterChips';
import FilterPanelCard from '@/components/ui/FilterPanelCard';
import Button from '@/components/ui/Button';
import { Field, Select } from '@/components/ui/Fields';
import { SkeletonListPage } from '@/components/ui/Skeleton';
import { KpiCard } from '@/components/ui/KpiCard';
import { Table } from '@/components/ui/Table';
import { StatusBadge } from '@/components/ui/StatusBadge';
import ResourceView from '@/components/ui/ResourceView';
import TablePagination from '@/components/ui/TablePagination';
import StandardPage from '@/components/ui/StandardPage';
import ReportHeaderActions from '@/components/ui/ReportHeaderActions';
import ResourceIdCell from '@/components/ui/ResourceIdCell';
import OccupancyBar from '@/components/ui/OccupancyBar';
import { ROOM_TYPE_LABELS } from '@/lib/constants';
import { normalizeReportRows } from '@/lib/pagination';
import { usePaginatedFilters } from '@/hooks/usePaginatedFilters';
import { useReportExport } from '@/hooks/useReportExport';
import { BarChart3, Home, Users, CheckCircle, Search } from 'lucide-react';

export default function OccupancyReportPage() {
  const { user: currentUser, authLoading, isUnauthorized } = useAuthGuard();
  const { showToast } = useToasts();
  const { exporting, performExport } = useReportExport();
  const [apiError, setApiError] = useState('');
  const [apiUnavailable, setApiUnavailable] = useState(false);
  const [report, setReport] = useState({ summary: null, rows: [] });
  const [tableMeta, setTableMeta] = useState(null);

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
    initialFilters: { room_type: 'all' },
    buildExtraParams: ({ filters: current }) => {
      const extra = {};
      if (current.room_type !== 'all') {
        extra.room_type = current.room_type;
      }
      return extra;
    },
  });

  const {
    data: reportData,
    error: reportError,
    mutate: loadReport,
    isValidating,
  } = useSWR(
    !authLoading && currentUser && canViewReports(currentUser)
      ? `/api/reports/occupancy${queryString}`
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

  const hasActiveFilters = filters.room_type !== 'all';

  const { rows } = normalizeReportRows(report, 'rows');

  const onExport = async () => {
    if (apiUnavailable) return;
    setApiError('');
    await performExport({
      endpoint: '/api/reports/occupancy/export',
      filters:
        filters.room_type !== 'all' ? { room_type: filters.room_type } : {},
      filenamePrefix: 'occupancy-report',
      label: 'Occupancy Report',
    });
  };

  if (isUnauthorized) return null;

  return (
    <StandardPage
      title="Occupancy Report"
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
            <span>{report.meta?.total ?? 0} Records</span>
          </div>
        </div>
      }
      loading={authLoading || loading}
      skeleton={<SkeletonListPage rows={8} />}
      breadcrumbs={
        <Breadcrumbs
          items={[
            { label: 'Reports', href: '/admin/reports' },
            { label: 'Occupancy' },
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
          label="Total Rooms"
          value={report.summary?.total_rooms ?? '—'}
          icon={Home}
          isSyncing={isValidating}
          className="hs-glass-effect"
        />
        <KpiCard
          label="Total Beds"
          value={report.summary?.total_beds ?? '—'}
          icon={BarChart3}
          isSyncing={isValidating}
          className="hs-glass-effect"
        />
        <KpiCard
          label="Occupied Beds"
          value={report.summary?.occupied_beds ?? '—'}
          icon={Users}
          isSyncing={isValidating}
          className="hs-glass-effect"
        />
        <KpiCard
          label="Occupancy Rate"
          value={
            report.summary?.total_beds
              ? `${Math.round((report.summary.occupied_beds / report.summary.total_beds) * 100)}%`
              : '0%'
          }
          progress={
            report.summary?.total_beds
              ? (report.summary.occupied_beds / report.summary.total_beds) * 100
              : 0
          }
          icon={CheckCircle}
          isSyncing={isValidating}
          className="hs-glass-effect"
        />
      </div>

      <FilterPanelCard icon={Search}>
        <div className="grid gap-6 sm:grid-cols-4">
          <Field label="Filter by Room Type">
            <Select
              value={filters.room_type}
              onChange={(event) =>
                updateFilter('room_type', event.target.value)
              }
              disabled={apiUnavailable}
              className="!h-11"
            >
              <option value="all">All Room Types</option>
              {Object.entries(ROOM_TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="mt-6">
          <FilterChips
            items={[
              {
                key: 'room_type',
                label: 'Room type',
                value:
                  filters.room_type !== 'all'
                    ? ROOM_TYPE_LABELS[filters.room_type] || filters.room_type
                    : '',
                onClear: () => updateFilter('room_type', 'all'),
              },
            ]}
            onClearAll={resetFilters}
          />
        </div>

        {apiUnavailable ? (
          <Alert variant="info" className="mt-6" title="Report unavailable">
            The occupancy report endpoint did not respond. Check API
            configuration and try again.
          </Alert>
        ) : null}
        {apiError ? (
          <Alert variant="error" className="mt-6" title="Sync Issue">
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
          title: 'No rooms matched filters',
          description:
            'No rooms currently match your filtering criteria. Adjust room type or reset filters.',
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
        <Card className="mt-8 overflow-hidden border-stone-200 !p-0 shadow-md rounded-2xl hs-glass-effect">
          <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/50 px-8 py-4">
            <h2 className="hs-strip-title uppercase tracking-[0.2em] text-[10px] font-black text-stone-400">
              ROOM OCCUPANCY DIRECTORY
            </h2>
            <div className="text-[10px] font-mono font-bold text-stone-400 uppercase tracking-widest leading-none">
              {tableMeta?.total ?? rows.length} RECORDS MATCHING
            </div>
          </div>
          <Table
            embedded={true}
            caption="Bed Utilization Directory"
            ariaLabel="Bed utilization records"
            columns={[
              { key: 'room', label: 'Room' },
              { key: 'type', label: 'Type', className: 'text-center' },
              {
                key: 'utilization',
                label: 'Bed Utilization',
                className: 'text-right pr-12',
              },
            ]}
            rows={rows.map((row) => (
              <tr
                key={row.room_id}
                className="border-t border-stone-100 hover:bg-stone-50 transition-colors duration-100"
              >
                <td className="px-6 py-3">
                  <div className="font-mono text-[10px] font-black uppercase tracking-tighter text-stone-900 leading-tight">
                    {row.room_code}
                  </div>
                  {row.room_id != null ? (
                    <div className="mt-1">
                      <ResourceIdCell id={row.room_id} prefix="ROOM" />
                    </div>
                  ) : null}
                </td>
                <td className="px-6 py-3 text-center">
                  <StatusBadge>{row.room_type}</StatusBadge>
                </td>
                <td colSpan={4} className="px-6 py-3 pr-12 w-[350px]">
                  <OccupancyBar
                    capacity={row.total_beds}
                    roomStatus="active"
                    bedSpaces={[
                      ...Array(row.occupied_beds).fill({ status: 'occupied' }),
                      ...Array(row.vacant_beds).fill({ status: 'vacant' }),
                    ]}
                  />
                </td>
              </tr>
            ))}
            emptyTitle="No occupancy records found"
            emptyDescription="Try adjusting your filters or search keywords to refine the results."
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
