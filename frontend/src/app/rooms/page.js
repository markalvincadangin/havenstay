"use client";

import Link from "next/link";
import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { DoorOpen, Search, ArrowUpRight, Bed, PieChart, PlusCircle } from "lucide-react";

import useSWR from "swr";
import { fetcher } from "../../lib/api";
import { canManageRooms } from "../../lib/auth";
import { useAuth } from "../_context/AuthContext";
import { formatPHP } from "../../lib/formatters";
import Alert from "../_components/ui/Alert";
import { Card } from "../_components/ui/Card";
import FilterPanelCard from "../_components/ui/FilterPanelCard";
import { Field, Input, Select } from "../_components/ui/Fields";
import Breadcrumbs from "../_components/ui/Breadcrumbs";
import { SkeletonGridPage } from "../_components/ui/Skeleton";
import { StatusBadge } from "../_components/ui/StatusBadge";
import FilterChips from "../_components/ui/FilterChips";
import { KpiCard } from "../_components/ui/KpiCard";
import { ROOM_STATUS_LABELS, ROOM_TYPE_LABELS, ROOM_UNIT_OFFLINE_BED_HINT } from "../../lib/constants";
import {
  normalizePaginatedList,
} from "../../lib/pagination";
import ResourceView from "../_components/ui/ResourceView";
import TablePagination from "../_components/ui/TablePagination";
import StandardPage from "../_components/ui/StandardPage";
import PageHeaderActions from "../_components/ui/PageHeaderActions";
import { usePaginatedFilters } from "../../hooks/usePaginatedFilters";


function OccupancyBar({ bedSpaces, capacity, roomStatus }) {
  const shouldReduceMotion = useReducedMotion();
  const bedList = Array.isArray(bedSpaces) ? bedSpaces : [];
  const occupied = bedList.filter((b) => b.status === "occupied").length;
  const vacant = bedList.filter((b) => b.status === "vacant").length;
  /** Prefer room capacity; fall back to bed row count so full/unavailable units still show a full bar if API desyncs. */
  const total = Math.max(Number(capacity) || 0, bedList.length);
  const pct = total > 0 ? Math.round((occupied / total) * 100) : 0;

  const rs = String(roomStatus ?? "").toLowerCase();
  const unitOffline = rs === "maintenance";
  const offlineHint =
    rs === "maintenance" ? ROOM_UNIT_OFFLINE_BED_HINT[rs] : null;

  return (
    <div className="mt-2">
      <div className="mb-1.5 flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <p className="text-[10px] font-bold tracking-widest text-stone-400 uppercase">
            BED OCCUPANCY
          </p>
          {unitOffline ? (
            <p className="text-[9px] font-medium leading-snug text-amber-800">
              {offlineHint}
            </p>
          ) : (
            vacant > 0 && (
              <p className="text-[9px] font-medium text-teal-600">
                {vacant} {vacant === 1 ? "bed" : "beds"} available
              </p>
            )
          )}
        </div>
        <p className="text-[10px] font-bold tabular-nums text-stone-900">
          {occupied}/{total}
        </p>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-stone-100"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={
          unitOffline
            ? `Occupancy ${occupied} of ${total}. Unit not bookable.`
            : `Occupancy ${occupied} of ${total}`
        }
      >
        <motion.div
          className="h-full rounded-full bg-teal-500"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.6, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

export default function RoomsPage() {
  const { user: currentUser } = useAuth();
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

  const { data: statsData } = useSWR(
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
      occupancyPct: statsData?.occupancy_pct ?? 0,
    };
  }, [statsData]);

  const { data: roomsData, error: roomsError, isValidating: isSyncing } = useSWR(
    currentUser ? `/api/rooms?per_page=100${queryString}` : null,
    fetcher,
    { keepPreviousData: true }
  );

  const { rows: rooms = [], meta: listMeta = null } = useMemo(() => {
    if (!roomsData) return { rows: [], meta: null };
    return normalizePaginatedList(roomsData);
  }, [roomsData]);

  const loading = !roomsData && !roomsError;

  const pageTitle = "Room Inventory";
  const pageSubtitle = "Review room capacity limits and current rate configurations.";

  const ROOM_DISPLAY_MAP = {
    solo: "Solo Unit",
    shared: "Shared Unit",
  };

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

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <KpiCard
            label="Total Inventory"
            icon={DoorOpen}
            value={stats.totalRooms}
            sub={`${stats.totalBeds} BEDS CONFIGURED`}
            isSyncing={statsValidating || isSyncing}
          />
          <KpiCard
            label="Occupancy Rate"
            icon={PieChart}
            value={`${stats.occupancyPct}%`}
            progress={stats.occupancyPct}
            isSuccess={stats.occupancyPct >= 80}
            isWarning={stats.occupancyPct < 50}
            isSyncing={statsValidating || isSyncing}
          />
          <KpiCard
            label="Available Capacity"
            icon={Bed}
            value={stats.bookableVacantBeds}
            sub="VACANT BEDS IN AVAILABLE UNITS"
            isWarning={stats.bookableVacantBeds < 5}
            isSyncing={statsValidating || isSyncing}
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
                <Field label="Room Filter">
                  <Input
                    icon={Search}
                    placeholder="Search by code or number…"
                    className="!h-12 border-stone-200 focus:ring-4 focus:ring-teal-500/5 transition-[border-color,box-shadow]"
                    value={query}
                    onChange={(e) => {
                      updateFilter("query", e.target.value);
                    }}
                  />
                </Field>
              </div>

              <div className="md:col-span-3 lg:col-span-3">
                <Field label="Status">
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
                    <option value="archived">Archived</option>
                  </Select>
                </Field>
              </div>

              <div className="md:col-span-3 lg:col-span-3">
                <Field label="Room category">
                  <Select
                    value={typeFilter}
                    onChange={(e) => {
                      updateFilter("type", e.target.value);
                    }}
                    className="!h-12 border-stone-200 focus:border-teal-500/50 font-bold"
                  >
                    <option value="all">All Categories</option>
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
                  value: statusFilter !== "all" ? statusFilter : "",
                  onClear: () => updateFilter("status", "all"),
                },
                {
                  key: "type",
                  label: "Category",
                  value: typeFilter !== "all" ? typeFilter : "",
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
            message: "Try clearing search or status, or register a new room to expand the registry."
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
                  <Card className="h-full !p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm transition-[box-shadow,border-color] duration-200 group-hover:border-teal-200 group-hover:shadow-md">
                    <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/50 px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-stone-200 bg-white text-teal-600 shadow-sm transition-[background-color,border-color] group-hover:border-teal-100 group-hover:bg-teal-50">
                          <DoorOpen size={18} aria-hidden />
                        </div>
                        <div>
                          <p className="font-mono text-lg font-black uppercase leading-none tracking-tight text-stone-900">
                            {room.room_code}
                          </p>
                          <p className="mt-1 text-[10px] font-bold tracking-widest text-stone-400">
                            {ROOM_DISPLAY_MAP[room.room_type] || "Unit"}
                          </p>
                        </div>
                      </div>
                      <StatusBadge size="xs">{room.status}</StatusBadge>
                    </div>

                    <div className="space-y-4 p-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="mb-1 text-[10px] font-bold tracking-widest text-stone-400 uppercase">CAPACITY</p>
                          <p className="text-sm font-bold text-stone-900">
                            {capacity} {capacity === 1 ? "Bed" : "Beds"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="mb-1 text-[10px] font-bold tracking-widest text-stone-400 uppercase text-right">MONTHLY RENT</p>
                          <p className="font-mono text-sm font-bold tabular-nums text-stone-900">{formatPHP(room.monthly_rate)}</p>
                        </div>
                      </div>

                      <OccupancyBar
                        bedSpaces={room.bed_spaces}
                        capacity={capacity}
                        roomStatus={room.status}
                      />
                    </div>

                    <div className="mx-6 flex items-center justify-between border-t border-stone-50 py-3">
                        <span className="text-[10px] font-bold tracking-widest text-stone-400 transition-colors group-hover:text-teal-700 uppercase">
                        VIEW PROFILE
                      </span>
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-400 transition-[border-color,background-color,color] group-hover:border-teal-200 group-hover:bg-teal-50 group-hover:text-teal-600">
                        <ArrowUpRight size={14} aria-hidden />
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
            className="mt-4 rounded-2xl border border-stone-200 bg-white"
          />
        ) : null}
      </div>
    </StandardPage>
  );
}
