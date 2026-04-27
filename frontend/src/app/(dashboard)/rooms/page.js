"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { DoorOpen, Search, ArrowUpRight, Bed, PieChart, PlusCircle, ShieldAlert } from "lucide-react";
import useSWR from "swr";
import { fetcher } from "@/lib/api";
import { canManageRooms } from "@/lib/auth";
import { useAuth } from "@/context/AuthContext";
import { formatPHP } from "@/lib/formatters";
import Alert from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import FilterPanelCard from "@/components/ui/FilterPanelCard";
import { Field, Input, Select } from "@/components/ui/Fields";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import { SkeletonGridPage } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import FilterChips from "@/components/ui/FilterChips";
import { KpiCard } from "@/components/ui/KpiCard";
import { SideSheetOverlay } from "@/components/ui/SideSheetOverlay";
import { QuickEditRowAction } from "@/components/ui/QuickEditRowAction";
import { RoomQuickEditForm } from '@/features/rooms/components/RoomQuickEditForm';
import { ROOM_STATUS_LABELS, ROOM_TYPE_LABELS, } from "@/lib/constants";
import {
  normalizePaginatedList,
} from "@/lib/pagination";
import ResourceView from "@/components/ui/ResourceView";
import TablePagination from "@/components/ui/TablePagination";
import StandardPage from "@/components/ui/StandardPage";
import PageHeaderActions from "@/components/ui/PageHeaderActions";
import { usePaginatedFilters } from "@/hooks/usePaginatedFilters";
import OccupancyBar from "@/components/ui/OccupancyBar";
export default function RoomsPage() {
  const { user: currentUser } = useAuth();
  const [editingRoom, setEditingRoom] = useState(null);
  const { filters, updateFilter, resetFilters, page, setPage, perPage, setPerPage, queryString } =
    usePaginatedFilters({
      initialFilters: { status: "all", type: "all", query: "" },
      debounceKeys: ["query"],
      buildExtraParams: ({ filters: current, debounced }) => {
        const extra = {};
        const q = String(debounced.query ?? "").trim();
        if (q) extra.q = q;
        if (current.status !== "all") extra.status = current.status;
        if (current.type !== "all") extra.type = current.type;
        return extra;
      },
    });
  const statusFilter = filters.status;
  const typeFilter = filters.type;
  const query = filters.query;
  const { data: statsData, isValidating: statsValidating } = useSWR(
    currentUser ? "/api/rooms/stats" : null,
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
      occupancyPct: statsData?.occupancy_pct ?? 0,
    };
  }, [statsData]);
  const { data: roomsData, error: roomsError, isValidating: isSyncing, mutate: refetchRooms } = useSWR(
    currentUser ? `/api/rooms${queryString}` : null,
    fetcher,
    { keepPreviousData: true }
  );
  const { rows: rooms = [], meta: listMeta = null } = useMemo(() => {
    if (!roomsData) return { rows: [], meta: null };
    return normalizePaginatedList(roomsData);
  }, [roomsData]);
  const loading = !roomsData && !roomsError;
  const pageTitle = "Room Inventory";
  const pageSubtitle = "Manage room configurations, rates, and availability.";
  return (
    <StandardPage
      title={pageTitle}
      subtitle={pageSubtitle}
      breadcrumbs={<Breadcrumbs items={[{ label: "Room Inventory" }]} />}
      loading={loading}
      skeleton={<SkeletonGridPage cards={6} />}
      actions={
        <PageHeaderActions
          ctaHref={canManageRooms(currentUser) ? "/rooms/new" : null}
          ctaLabel="Register Room"
          ctaIcon={PlusCircle}
          user={currentUser}
        />
      }
    >
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
            isActiveDecision={stats.offlineUnits > 0}
            isSyncing={statsValidating || isSyncing}
            className="hs-glass-effect"
          />
        </div>
        <FilterPanelCard icon={DoorOpen}>
          {!canManageRooms(currentUser) && (
            <div className="mb-6">
              <Alert variant="info" title="Read-only access">
                Your role can review rooms and beds; only Admin or Staff can register or edit rooms.
              </Alert>
            </div>
          )}
          <div className="grid items-end gap-6 md:grid-cols-12">
            <div className="md:col-span-6 lg:col-span-6">
              <Field label="Search Directory">
                <Input
                  icon={Search}
                  placeholder="Search by code, tenant, or amenities…"
                  className="!h-12 border-stone-200 focus:ring-4 focus:ring-teal-500/5 transition-[border-color,box-shadow]"
                  value={query}
                  onChange={(e) => {
                    updateFilter("query", e.target.value);
                  }}
                />
              </Field>
            </div>
            <div className="md:col-span-3 lg:col-span-3">
              <Field label="Unit Status">
                <Select
                  value={statusFilter}
                  onChange={(e) => {
                    updateFilter("status", e.target.value);
                  }}
                  className="!h-12 border-stone-200 focus:border-teal-500/50 font-bold"
                >
                  <option value="all">All Statuses</option>
                  {Object.entries(ROOM_STATUS_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="md:col-span-3 lg:col-span-3">
              <Field label="Accommodation Type">
                <Select
                  value={typeFilter}
                  onChange={(e) => {
                    updateFilter("type", e.target.value);
                  }}
                  className="!h-12 border-stone-200 focus:border-teal-500/50 font-bold"
                >
                  <option value="all">All Types</option>
                  {Object.entries(ROOM_TYPE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </Select>
              </Field>
            </div>
          </div>
          <FilterChips
            className="mt-6"
            items={[
              {
                key: "query",
                label: "Search",
                value: query,
                onClear: () => updateFilter("query", ""),
              },
              {
                key: "status",
                label: "Status",
                value: statusFilter !== "all" ? ROOM_STATUS_LABELS[statusFilter] || statusFilter : "",
                onClear: () => updateFilter("status", "all"),
              },
              {
                key: "type",
                label: "Room Type",
                value: typeFilter !== "all" ? ROOM_TYPE_LABELS[typeFilter] || typeFilter : "",
                onClear: () => updateFilter("type", "all"),
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
            title: "No rooms match these filters",
            description: "Try clearing search or status, or register a new room to expand the registry."
          }}
          skeleton={<SkeletonGridPage cards={6} />}
        >
          <div className="mt-2 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {rooms.map((room) => {
              const capacity = Number(room.capacity || 0);
              return (
                <Link
                  key={room.room_id}
                  href={`/rooms/${room.room_id}`}
                  className="group block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
                >
                  <Card className="h-full !p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm transition-[box-shadow,border-color] duration-200 group-hover:border-teal-200 group-hover:shadow-lg hs-glass-effect">
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
                            {ROOM_TYPE_LABELS[room.room_type] || "Unit"}
                          </p>
                        </div>
                      </div>
                      <StatusBadge size="xs">{room.status}</StatusBadge>
                    </div>
                    <div className="space-y-4 p-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="mb-1 text-[10px] font-black tracking-[0.2em] text-stone-300 uppercase leading-none">CAPACITY</p>
                          <p className="text-sm font-bold text-stone-900">
                            {capacity} {capacity === 1 ? "bed" : "beds"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="mb-1 text-[10px] font-black tracking-[0.2em] text-stone-300 uppercase text-right leading-none">MONTHLY RENT</p>
                          <p className="font-mono text-sm font-black tabular-nums text-stone-900">
                            {formatPHP(room.monthly_rate)}<span className="ml-1 text-[10px] font-medium text-stone-500 font-sans tracking-tight opacity-60">/ bed</span>
                          </p>
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
                          disabled={!canManageRooms(currentUser)}
                          onClick={(e) => {
                            e.preventDefault();
                            setEditingRoom(room);
                          }}
                          title="Update Asset Config"
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
