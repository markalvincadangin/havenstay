'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  DoorOpen,
  Search,
  ArrowUpRight,
  Bed,
  PieChart,
  PlusCircle,
  ShieldAlert,
} from 'lucide-react';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { canManageRooms } from '@/lib/auth';
import { useAuth } from '@/context/AuthContext';
import CurrencyDisplay from '@/components/ui/CurrencyDisplay';
import Alert from '@/components/ui/Alert';
import { Card } from '@/components/ui/Card';
import FilterPanelCard from '@/components/ui/FilterPanelCard';
import { Field, Input, Select } from '@/components/ui/Fields';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
import { SkeletonGridPage } from '@/components/ui/Skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import FilterChips from '@/components/ui/FilterChips';
import { KpiCard } from '@/components/ui/KpiCard';
import { SideSheetOverlay } from '@/components/ui/SideSheetOverlay';
import { QuickEditRowAction } from '@/components/ui/QuickEditRowAction';
import { RoomQuickEditForm } from '@/features/rooms/components/RoomQuickEditForm';
import {
  ROOM_STATUS_LABELS,
  ROOM_TYPE_LABELS,
  SEARCH_LABELS,
  SEARCH_PLACEHOLDERS,
  FILTER_ALL_OPTION,
  UTILITY_TYPE_FILTER_LABELS,
  FILTER_ALL_TYPES,
} from '@/lib/constants';
import { normalizePaginatedList } from '@/lib/pagination';
import ResourceView from '@/components/ui/ResourceView';
import TablePagination from '@/components/ui/TablePagination';
import StandardPage from '@/components/ui/StandardPage';
import PageHeaderActions from '@/components/ui/PageHeaderActions';
import { usePaginatedFilters } from '@/hooks/usePaginatedFilters';
import OccupancyBar from '@/components/ui/OccupancyBar';
import { ArrowUpDown } from 'lucide-react';
export default function RoomsPage() {
  const { user: currentUser } = useAuth();
  const [editingRoom, setEditingRoom] = useState(null);
  const {
    filters,
    updateFilter,
    resetFilters,
    sort,
    onSortChange,
    page,
    setPage,
    perPage,
    setPerPage,
    queryString,
  } = usePaginatedFilters({
    initialFilters: { status: 'all', type: 'all', query: '' },
    initialSort: { by: 'room_code', dir: 'asc' },
    debounceKeys: ['query'],
    buildExtraParams: ({ filters: current, debounced }) => {
      const extra = {};
      const q = String(debounced.query ?? '').trim();
      if (q) extra.q = q;
      if (current.status !== 'all') extra.status = current.status;
      if (current.type !== 'all') extra.room_type = current.type;
      return extra;
    },
  });
  const statusFilter = filters.status;
  const typeFilter = filters.type;
  const query = filters.query;
  const { data: statsData, isValidating: statsValidating } = useSWR(
    currentUser ? '/api/rooms/stats' : null,
    fetcher,
    { revalidateOnFocus: false, shouldRetryOnError: false }
  );
  const stats = useMemo(() => {
    return {
      totalRooms: statsData?.total_rooms ?? 0,
      totalBeds: statsData?.total_beds ?? 0,
      occupiedBeds: statsData?.occupied_beds ?? 0,
      bookableVacantBeds: statsData?.bookable_vacant_beds ?? 0,
      maintenanceBeds: statsData?.maintenance_beds ?? 0,
      offlineUnits: statsData?.offline_units ?? 0,
      decommissionedRooms: statsData?.decommissioned_rooms ?? 0,
      occupancyPct: statsData?.occupancy_pct ?? 0,
    };
  }, [statsData]);
  const {
    data: roomsData,
    error: roomsError,
    isValidating: isSyncing,
    mutate: refetchRooms,
  } = useSWR(currentUser ? `/api/rooms${queryString}` : null, fetcher, {
    keepPreviousData: true,
  });
  const { rows: rooms = [], meta: listMeta = null } = useMemo(() => {
    if (!roomsData) return { rows: [], meta: null };
    return normalizePaginatedList(roomsData);
  }, [roomsData]);
  const loading = !roomsData && !roomsError;
  const pageTitle = 'Room Inventory';
  const pageSubtitle = 'Manage room configurations, rates, and availability.';
  return (
    <StandardPage
      title={pageTitle}
      subtitle={pageSubtitle}
      breadcrumbs={<Breadcrumbs items={[{ label: 'Room Inventory' }]} />}
      loading={loading}
      skeleton={<SkeletonGridPage cards={6} />}
      actions={
        <PageHeaderActions
          ctaHref={canManageRooms(currentUser) ? '/rooms/new' : null}
          ctaLabel="Register Room"
          ctaIcon={PlusCircle}
          user={currentUser}
        />
      }
    >
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <KpiCard
            label="Total Capacity"
            icon={DoorOpen}
            value={stats.totalBeds}
            sub={`${stats.totalRooms} UNITS REGISTERED`}
            isSyncing={statsValidating || isSyncing}
            className="hs-glass-effect"
          />
          <KpiCard
            label="Occupancy Rate"
            icon={PieChart}
            value={`${stats.occupancyPct}%`}
            progress={stats.occupancyPct}
            isSuccess={stats.occupancyPct >= 80}
            isWarning={stats.occupancyPct < 50}
            isSyncing={statsValidating || isSyncing}
            className="hs-glass-effect"
          />
          <KpiCard
            label="Available Beds"
            icon={Bed}
            value={stats.bookableVacantBeds}
            sub="READY FOR OCCUPANCY"
            isWarning={stats.bookableVacantBeds < 5}
            isActiveDecision={stats.bookableVacantBeds < 5}
            isSyncing={statsValidating || isSyncing}
            className="hs-glass-effect"
          />
          <KpiCard
            label="Offline Units"
            icon={ShieldAlert}
            value={stats.offlineUnits}
            sub={`${stats.maintenanceBeds} BEDS IN MAINTENANCE`}
            isWarning={stats.offlineUnits > 0}
            isSyncing={statsValidating || isSyncing}
            className="hs-glass-effect"
          />
          <KpiCard
            label="Decommissioned"
            icon={ShieldAlert}
            value={stats.decommissionedRooms}
            sub="REMOVED FROM INVENTORY"
            isSyncing={statsValidating || isSyncing}
            className="hs-glass-effect opacity-80"
          />
        </div>
        <FilterPanelCard icon={DoorOpen}>
          {!canManageRooms(currentUser) && (
            <div className="mb-6">
              <Alert variant="info" title="Read-only access">
                Your role can review rooms and beds; only Admin or Staff can
                register or edit rooms.
              </Alert>
            </div>
          )}
          <div className="grid items-end gap-6 md:grid-cols-12">
            <div className="md:col-span-6 lg:col-span-6">
              <Field label={SEARCH_LABELS.rooms}>
                <Input
                  icon={Search}
                  placeholder={SEARCH_PLACEHOLDERS.rooms}
                  className="!h-12 border-stone-200 font-bold focus:border-teal-500/50 focus:ring-4 focus:ring-teal-500/5 transition-[border-color,box-shadow]"
                  value={query}
                  onChange={(e) => {
                    updateFilter('query', e.target.value);
                  }}
                />
              </Field>
            </div>
            <div className="md:col-span-3 lg:col-span-3">
              <Field label="Unit Status">
                <Select
                  value={statusFilter}
                  onChange={(e) => {
                    updateFilter('status', e.target.value);
                  }}
                  className="!h-12 border-stone-200 focus:border-teal-500/50 font-bold"
                >
                  <option value="all">{FILTER_ALL_OPTION}</option>
                  {Object.entries(ROOM_STATUS_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="md:col-span-3 lg:col-span-3">
              <Field label="Accommodation Type">
                <Select
                  value={typeFilter}
                  onChange={(e) => {
                    updateFilter('type', e.target.value);
                  }}
                  className="!h-12 border-stone-200 focus:border-teal-500/50 font-bold"
                >
                  <option value="all">{FILTER_ALL_TYPES}</option>
                  {Object.entries(ROOM_TYPE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="md:col-span-3 lg:col-span-3">
              <Field label="Sort By">
                <div className="relative">
                  <Select
                    value={`${sort.by || 'room_code'}-${sort.dir || 'asc'}`}
                    onChange={(e) => {
                      const [by, dir] = e.target.value.split('-');
                      onSortChange(by, dir);
                    }}
                    className="!h-12 border-stone-200 focus:border-teal-500/50 font-bold pl-10"
                  >
                    <option value="room_code-asc">Room Code (A-Z)</option>
                    <option value="room_code-desc">Room Code (Z-A)</option>
                    <option value="monthly_rate-asc">Rate (Lowest)</option>
                    <option value="monthly_rate-desc">Rate (Highest)</option>
                    <option value="capacity-desc">Capacity (High)</option>
                    <option value="capacity-asc">Capacity (Low)</option>
                    <option value="status-asc">Status</option>
                  </Select>
                  <ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
                </div>
              </Field>
            </div>
          </div>
          <FilterChips
            className="mt-6"
            items={[
              {
                key: 'query',
                label: 'Rooms',
                value: query,
                onClear: () => updateFilter('query', ''),
              },
              {
                key: 'status',
                label: 'Unit Status',
                value:
                  statusFilter !== 'all'
                    ? ROOM_STATUS_LABELS[statusFilter] || statusFilter
                    : '',
                onClear: () => updateFilter('status', 'all'),
              },
              {
                key: 'type',
                label: 'Accommodation Type',
                value:
                  typeFilter !== 'all'
                    ? ROOM_TYPE_LABELS[typeFilter] || typeFilter
                    : '',
                onClear: () => updateFilter('type', 'all'),
              },
            ]}
            onClearAll={resetFilters}
          />
        </FilterPanelCard>
        <ResourceView
          isLoading={loading}
          isSyncing={isSyncing}
          error={roomsError}
          isEmpty={rooms.length === 0}
          emptyProps={{
            title: 'No rooms match these filters',
            description:
              'Try clearing search or status, or register a new room to expand the registry.',
          }}
          skeleton={<SkeletonGridPage cards={6} />}
        >
          <div className="mb-6 overflow-hidden rounded-2xl border border-stone-200 bg-white hs-glass-effect">
            <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/50 px-8 py-4">
              <h2 className="hs-strip-title uppercase tracking-[0.2em] text-[10px] font-black text-stone-400">
                ROOM DIRECTORY
              </h2>
              <div className="text-[10px] font-mono font-bold text-stone-400 uppercase tracking-widest leading-none">
                {rooms.length} UNITS MATCHING
              </div>
            </div>
            <div className="p-8">
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {rooms.map((room) => {
                  const capacity = Number(room.capacity || 0);
                  return (
                    <Link
                      key={room.room_id}
                      href={`/rooms/${room.room_id}`}
                      className={`group block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 ${
                        room.status === 'decommissioned'
                          ? 'opacity-60 grayscale-[0.5]'
                          : ''
                      }`}
                    >
                      <Card
                        className={`h-full !p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm transition-[box-shadow,border-color] duration-200 group-hover:border-teal-200 group-hover:shadow-lg hs-glass-effect ${
                          room.status === 'decommissioned'
                            ? 'bg-stone-50/50'
                            : ''
                        }`}
                      >
                        <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/50 px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-stone-200 bg-white text-teal-600 shadow-sm transition-[background-color,border-color] group-hover:border-teal-100 group-hover:bg-teal-50">
                              <DoorOpen size={18} aria-hidden />
                            </div>
                            <div>
                              <p className="font-mono text-lg font-black uppercase leading-none tracking-tighter text-stone-900 group-hover:text-teal-700 transition-colors">
                                {room.room_code}
                              </p>
                              <p className="mt-1 text-[10px] font-black tracking-[0.2em] text-stone-400 uppercase">
                                {ROOM_TYPE_LABELS[room.room_type] || 'Unit'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[9px] font-black tracking-widest px-2 py-0.5 rounded-md border ${
                                room.is_metered
                                  ? 'bg-amber-50 text-amber-600 border-amber-100'
                                  : 'bg-blue-50 text-blue-600 border-blue-100'
                              }`}
                            >
                              {room.is_metered ? 'METERED' : 'ALL-INCLUSIVE'}
                            </span>
                            <StatusBadge size="xs">{room.status}</StatusBadge>
                          </div>
                        </div>
                        <div className="space-y-4 p-6">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="mb-1 text-[10px] font-black tracking-[0.2em] text-stone-300 uppercase leading-none">
                                CAPACITY
                              </p>
                              <p className="text-sm font-bold text-stone-900">
                                {capacity} {capacity === 1 ? 'bed' : 'beds'}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="mb-1 text-[10px] font-black tracking-[0.2em] text-stone-300 uppercase text-right leading-none">
                                MONTHLY RENT
                              </p>
                              <div className="text-sm font-bold text-stone-900">
                                <CurrencyDisplay amount={room.monthly_rate} />
                                <span className="ml-1 text-[10px] font-medium text-stone-500 font-sans tracking-tight opacity-60">
                                  / bed
                                </span>
                              </div>
                            </div>
                          </div>
                          <OccupancyBar
                            bedSpaces={room.bed_spaces}
                            capacity={capacity}
                            roomStatus={room.status}
                          />
                        </div>
                        <div className="flex items-center justify-between border-t border-stone-100/50 bg-stone-50/50 px-6 py-3.5 mt-auto">
                          <span className="text-[10px] font-black tracking-[0.2em] text-stone-400 transition-colors group-hover:text-teal-600 uppercase">
                            View Unit Details
                          </span>
                          <div className="flex items-center gap-2.5">
                            <QuickEditRowAction
                              disabled={
                                !canManageRooms(currentUser) ||
                                room.status === 'decommissioned'
                              }
                              onClick={(e) => {
                                e.preventDefault();
                                setEditingRoom(room);
                              }}
                              title={
                                room.status === 'decommissioned'
                                  ? 'Decommissioned — restore to edit'
                                  : 'Update Asset Config'
                              }
                            />
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-stone-100 bg-white text-stone-300 transition-[border-color,background-color,color] group-hover:border-teal-200 group-hover:bg-teal-50 group-hover:text-teal-600">
                              <ArrowUpRight size={14} aria-hidden />
                            </div>
                          </div>
                        </div>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </ResourceView>
        {listMeta && listMeta.total > 0 ? (
          <TablePagination
            meta={listMeta}
            page={page}
            perPage={perPage}
            onPageChange={setPage}
            onPerPageChange={(n) => {
              setPage(1);
              setPerPage(n);
            }}
            disabled={loading || isSyncing}
            className="mt-4 rounded-2xl border border-stone-200 bg-white hs-glass-effect"
          />
        ) : null}
      </div>
      <SideSheetOverlay
        isOpen={!!editingRoom}
        onClose={() => setEditingRoom(null)}
        title="Quick Update"
      >
        {editingRoom && (
          <RoomQuickEditForm
            room={editingRoom}
            currentUser={currentUser}
            onSuccess={() => {
              setEditingRoom(null);
              refetchRooms();
            }}
            onCancel={() => setEditingRoom(null)}
          />
        )}
      </SideSheetOverlay>
    </StandardPage>
  );
}
