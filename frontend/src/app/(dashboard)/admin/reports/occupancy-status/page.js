'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { fetcher } from '@/lib/api';
import useSWR from 'swr';
import { canViewReports } from '@/lib/auth';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { flattenApiErrors } from '@/lib/errors';
import CurrencyDisplay from '@/components/ui/CurrencyDisplay';
import { exportReportCsv } from '@/lib/downloads';
import { useToasts } from '@/context/ToastContext';
import Alert from '@/components/ui/Alert';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
import Button from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import FilterChips from '@/components/ui/FilterChips';
import { Field, Select } from '@/components/ui/Fields';
import { SkeletonListPage } from '@/components/ui/Skeleton';
import { KpiCard } from '@/components/ui/KpiCard';
import { Table } from '@/components/ui/Table';
import { StatusBadge } from '@/components/ui/StatusBadge';
import StandardPage from '@/components/ui/StandardPage';
import ReportHeaderActions from '@/components/ui/ReportHeaderActions';
import FilterPanelCard from '@/components/ui/FilterPanelCard';
import ResourceIdCell from '@/components/ui/ResourceIdCell';
import { BED_STATUS_LABELS } from '@/lib/constants';
import { BedDouble, Home, Search, Wrench } from 'lucide-react';
import TablePagination from '@/components/ui/TablePagination';
import ResourceView from '@/components/ui/ResourceView';
import { usePaginatedFilters } from '@/hooks/usePaginatedFilters';
import { useReportExport } from '@/hooks/useReportExport';
import { normalizePaginatedList, normalizeReportRows } from '@/lib/pagination';

export default function OccupancyStatusReportPage() {
  const { user: currentUser, authLoading, isUnauthorized } = useAuthGuard();
  const { showToast } = useToasts();
  const { exporting, performExport } = useReportExport();
  const [apiError, setApiError] = useState('');
  const [report, setReport] = useState({ summary: null, rows: [] });
  const [tableMeta, setTableMeta] = useState(null);
  const [rooms, setRooms] = useState([]);

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
    initialFilters: { room_id: '', bed_status: '' },
    buildExtraParams: ({ filters: current }) => {
      const extra = {};
      if (current.room_id) extra.room_id = current.room_id;
      if (current.bed_status) extra.bed_status = current.bed_status;
      return extra;
    },
  });

  const { data: roomsData } = useSWR(
    !authLoading && currentUser && canViewReports(currentUser)
      ? '/api/rooms?per_page=100'
      : null,
    fetcher
  );

  useEffect(() => {
    if (roomsData) {
      const rows = normalizePaginatedList(roomsData).rows;
      setRooms(
        rows.sort((a, b) =>
          String(a.room_code).localeCompare(String(b.room_code))
        )
      );
    }
  }, [roomsData]);

  const {
    data: reportData,
    error: reportError,
    mutate: loadReport,
    isValidating,
  } = useSWR(
    !authLoading && currentUser && canViewReports(currentUser)
      ? `/api/reports/occupancy-status${queryString}`
      : null,
    fetcher,
    { keepPreviousData: true }
  );

  const loading =
    !reportData &&
    !reportError &&
    !authLoading &&
    currentUser &&
    canViewReports(currentUser);
  const hasActiveFilters =
    Boolean(filters.room_id) || Boolean(filters.bed_status);

  useEffect(() => {
    if (reportError) {
      setApiError(flattenApiErrors(reportError));
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
      setReport(reportData);
      setTableMeta(normalizeReportRows(reportData, 'rows').meta);
    }
  }, [reportData]);

  const onExport = async () => {
    setApiError('');
    const exportFilters = Object.fromEntries(
      Object.entries(filters).filter(([, value]) => value && value !== 'all')
    );
    await performExport({
      endpoint: '/api/reports/occupancy-status/export',
      filters: exportFilters,
      filenamePrefix: 'occupancy-status',
      label: 'Bed Occupancy Report',
    });
  };

  if (isUnauthorized) return null;

  const rows = normalizeReportRows(report, 'rows').rows;
  const s = report.summary || {};

  const selectedRoom = filters.room_id
    ? rooms.find((r) => String(r.room_id) === String(filters.room_id))
    : null;

  return (
    <StandardPage
      title="Bed Occupancy"
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
      loading={authLoading || (loading && !reportData)}
      skeleton={<SkeletonListPage rows={10} />}
      breadcrumbs={
        <Breadcrumbs
          items={[
            { label: 'Reports', href: '/admin/reports' },
            { label: 'Bed Occupancy' },
          ]}
        />
      }
      actions={
        <ReportHeaderActions
          user={currentUser}
          onExport={onExport}
          exporting={exporting}
          exportDisabled={exporting}
        />
      }
    >
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total Beds"
          value={s.bed_count ?? '—'}
          icon={BedDouble}
          isSyncing={isValidating}
          className="hs-glass-effect"
        />
        <KpiCard
          label="Occupied"
          value={s.occupied_beds ?? '—'}
          icon={Home}
          isSyncing={isValidating}
          className="hs-glass-effect"
        />
        <KpiCard
          label="Vacant"
          value={s.vacant_beds ?? '—'}
          icon={Search}
          isSyncing={isValidating}
          className="hs-glass-effect"
        />
        <KpiCard
          label="Maintenance"
          value={s.maintenance_beds ?? '—'}
          icon={Wrench}
          isSyncing={isValidating}
          className="hs-glass-effect"
        />
      </div>

      <FilterPanelCard icon={Search}>
        <div className="grid gap-6 sm:grid-cols-4">
          <Field label="Room" icon={Home}>
            <Select
              className="!h-11 border-stone-200"
              value={filters.room_id}
              onChange={(e) => updateFilter('room_id', e.target.value)}
            >
              <option value="">All rooms</option>
              {rooms.map((r) => (
                <option key={r.room_id} value={String(r.room_id)}>
                  {r.room_code}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Bed status" icon={BedDouble}>
            <Select
              className="!h-11 border-stone-200"
              value={filters.bed_status}
              onChange={(e) => updateFilter('bed_status', e.target.value)}
            >
              <option value="">All statuses</option>
              {Object.entries(BED_STATUS_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <FilterChips
          className="mt-6"
          items={[
            {
              key: 'room',
              label: 'Room',
              value: filters.room_id
                ? selectedRoom
                  ? selectedRoom.room_code
                  : `#${filters.room_id}`
                : '',
              onClear: () => updateFilter('room_id', ''),
            },
            {
              key: 'bed_status',
              label: 'Bed',
              value: filters.bed_status
                ? BED_STATUS_LABELS[filters.bed_status] || filters.bed_status
                : '',
              onClear: () => updateFilter('bed_status', ''),
            },
          ]}
          onClearAll={resetFilters}
        />
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
          title: 'No bed records',
          description:
            'Adjust filters or confirm rooms and bed spaces exist in inventory.',
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
              BED UTILIZATION DIRECTORY
            </h2>
            <div className="text-[10px] font-mono font-bold text-stone-400 uppercase tracking-widest leading-none">
              {tableMeta?.total ?? rows.length} RECORDS MATCHING
            </div>
          </div>
          <Table
            embedded={true}
            caption="Per-bed occupancy"
            ariaLabel="Bed-level occupancy records"
            columns={[
              { key: 'room', label: 'Room' },
              { key: 'bed', label: 'Bed', className: 'text-center' },
              { key: 'status', label: 'Status', className: 'text-center' },
              { key: 'tenant', label: 'Tenant' },
              { key: 'deposit', label: 'Deposit', className: 'text-right' },
              {
                key: 'contract',
                label: 'Contract ID',
                className: 'text-right',
              },
            ]}
            rows={rows.map((row) => (
              <tr
                key={row.bed_space_id}
                className="border-t border-stone-100 hover:bg-stone-50 transition-colors duration-100"
              >
                <td className="px-6 py-4">
                  <div className="font-mono text-[10px] font-black uppercase tracking-tighter text-stone-900 leading-tight">
                    {row.room_code}
                  </div>
                  <ResourceIdCell id={row.room_id} type="room" />
                </td>
                <td className="px-6 py-4 text-center text-xs font-bold text-stone-800">
                  {row.bed_label}
                </td>
                <td className="px-6 py-4 text-center">
                  <StatusBadge>{row.bed_status}</StatusBadge>
                </td>
                <td className="px-6 py-4 text-xs font-bold text-stone-700">
                  {row.tenant_name || '—'}
                </td>
                <td className="px-6 py-4 text-right">
                  {row.contract_id ? (
                    <CurrencyDisplay
                      amount={row.deposit_amount}
                      className="text-xs font-bold text-stone-500"
                    />
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  {row.contract_id ? (
                    <Link
                      href={`/contracts/${row.contract_id}`}
                      className="font-mono text-[10px] font-black text-teal-600 hover:text-teal-900"
                    >
                      <ResourceIdCell id={row.contract_id} type="contract" />
                    </Link>
                  ) : (
                    <span className="text-stone-300">—</span>
                  )}
                </td>
              </tr>
            ))}
            emptyTitle="No bed records"
            emptyDescription="Adjust filters or confirm rooms and bed spaces exist in inventory."
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
