"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";
import { DoorOpen, Search, Plus, ArrowUpRight, Bed, PieChart } from "lucide-react";

import { apiRequest } from "../../lib/api";
import { flattenApiErrors } from "../../lib/errors";
import { canManageRooms, canViewReports } from "../../lib/auth";
import { useAuthGuard } from "../../hooks/useAuthGuard";
import { formatPHP } from "../../lib/formatters";
import Alert from "../_components/ui/Alert";
import { AppMain } from "../_components/ui/AppShell";
import { Card } from "../_components/ui/Card";
import { Field, Input, Select } from "../_components/ui/Fields";
import PageHeader from "../_components/ui/PageHeader";
import Breadcrumbs from "../_components/ui/Breadcrumbs";
import { SkeletonGridPage } from "../_components/ui/Skeleton";
import UserRoleBadge from "../_components/ui/UserRoleBadge";
import { primaryLinkCtaClass, secondaryOutlineLinkClass } from "../_components/ui/LinkTokens";
import { StatusBadge } from "../_components/ui/StatusBadge";
import FilterChips from "../_components/ui/FilterChips";
import { KpiCard } from "../_components/ui/KpiCard";
import { ROOM_STATUS_LABELS, ROOM_TYPE_LABELS, ROOM_UNIT_OFFLINE_BED_HINT } from "../../lib/constants";
import {
  buildPaginationQuery,
  normalizePaginatedList,
  readStoredPerPage,
} from "../../lib/pagination";
import EmptyState from "../_components/ui/EmptyState";
import TablePagination from "../_components/ui/TablePagination";

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.2, ease: "easeOut" },
};

function OccupancyBar({ bedSpaces, capacity, roomStatus }) {
  const shouldReduceMotion = useReducedMotion();
  const bedList = Array.isArray(bedSpaces) ? bedSpaces : [];
  const occupied = bedList.filter((b) => b.status === "occupied").length;
  const vacant = bedList.filter((b) => b.status === "vacant").length;
  /** Prefer room capacity; fall back to bed row count so full/unavailable units still show a full bar if API desyncs. */
  const total = Math.max(Number(capacity) || 0, bedList.length);
  const pct = total > 0 ? Math.round((occupied / total) * 100) : 0;

  const rs = String(roomStatus ?? "").toLowerCase();
  const unitOffline = rs === "maintenance" || rs === "unavailable";
  const offlineHint =
    rs === "maintenance" || rs === "unavailable"
      ? ROOM_UNIT_OFFLINE_BED_HINT[rs]
      : null;

  return (
    <div className="mt-2">
      <div className="mb-1.5 flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <p className="text-[10px] font-bold tracking-widest text-stone-400">
            Bed Occupancy
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
  const { user: currentUser, authLoading } = useAuthGuard();
  const shouldReduceMotion = useReducedMotion();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rooms, setRooms] = useState([]);
  const [listMeta, setListMeta] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(() => readStoredPerPage());

  const [stats, setStats] = useState({
    totalRooms: 0,
    totalBeds: 0,
    occupiedBeds: 0,
    occupancyPct: 0,
    /** Vacant beds that can be assigned — only in `rooms.status === 'available'` (matches `ReportService::occupancy` / Dashboard). */
    bookableVacantBeds: 0,
  });

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const fetchStats = useCallback(async () => {
    try {
      const reportData = await apiRequest("/api/reports/occupancy", { method: "GET" });
      const s = reportData?.summary ?? {};
      const totalRooms = Number(s.total_rooms ?? 0);
      const totalBeds = Number(s.total_beds ?? 0);
      const occupiedBeds = Number(s.occupied_beds ?? 0);
      const bookableVacantBeds = Number(s.vacant_beds ?? 0);
      setStats({
        totalRooms,
        totalBeds,
        occupiedBeds,
        occupancyPct: totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0,
        bookableVacantBeds,
      });
    } catch {
      /* KPIs best-effort */
    }
  }, []);

  const fetchRooms = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const extra = {};
      if (debouncedQuery) extra.q = debouncedQuery;
      if (statusFilter !== "all") extra.status = statusFilter;
      if (typeFilter !== "all") extra.room_type = typeFilter;
      const qs = buildPaginationQuery(page, perPage, extra);
      const data = await apiRequest(`/api/rooms${qs}`, { method: "GET" });
      const { rows, meta } = normalizePaginatedList(data);
      setRooms(rows);
      setListMeta(meta);
    } catch (err) {
      setError(flattenApiErrors(err));
    } finally {
      setLoading(false);
    }
  }, [page, perPage, debouncedQuery, statusFilter, typeFilter]);

  useEffect(() => {
    if (authLoading || !currentUser) return;
    fetchStats();
  }, [authLoading, currentUser, fetchStats]);

  useEffect(() => {
    if (authLoading || !currentUser) return;
    fetchRooms();
  }, [authLoading, currentUser, fetchRooms]);

  useEffect(() => {
    flushSync(() => {
      setPage(1);
    });
  }, [debouncedQuery, statusFilter, typeFilter]);

  if (authLoading || loading) {
    return (
      <AppMain>
        <SkeletonGridPage cards={6} />
      </AppMain>
    );
  }

  return (
    <AppMain>
      <motion.div
        initial={shouldReduceMotion ? false : pageVariants.initial}
        animate={shouldReduceMotion ? false : pageVariants.animate}
        transition={shouldReduceMotion ? { duration: 0 } : pageVariants.transition}
        className="space-y-6"
      >
        <PageHeader
          title="Room Inventory"
          subtitle="Review room capacity limits and current rate configurations."
          breadcrumbs={<Breadcrumbs items={[{ label: "Room Inventory" }]} />}
          actions={(
            <div className="flex flex-wrap items-center gap-3">
              {canViewReports(currentUser) && (
                <Link
                  href="/reports/occupancy"
                  className={secondaryOutlineLinkClass + " gap-2 !px-4"}
                >
                  <PieChart size={16} aria-hidden />
                  <span>Occupancy report</span>
                </Link>
              )}
              {canManageRooms(currentUser) && (
                <Link href="/rooms/new" className={primaryLinkCtaClass + " gap-2 !px-5 shadow-sm"}>
                  <Plus size={18} aria-hidden />
                  <span>Register Unit</span>
                </Link>
              )}
              <div className={`flex items-center ${canManageRooms(currentUser) || canViewReports(currentUser) ? "border-l border-stone-200 pl-3" : ""}`}>
                <UserRoleBadge username={currentUser?.username} roleName={currentUser?.role?.role_name} />
              </div>
            </div>
          )}
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
           <KpiCard
             label="Total Inventory"
             icon={DoorOpen}
             value={stats.totalRooms}
             sub={`${stats.totalBeds} configured beds`}
           />
           <KpiCard
             label="Occupancy Rate"
             icon={PieChart}
             value={`${stats.occupancyPct}%`}
             progress={stats.occupancyPct}
           />
           <KpiCard
             label="Available Capacity"
             icon={Bed}
             value={stats.bookableVacantBeds}
             sub="Vacant beds in available units"
             isDanger={stats.bookableVacantBeds < 5}
           />
        </div>

        <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
          <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/50 px-6 py-4 sm:px-8 sm:py-5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-stone-100 text-stone-600">
                <DoorOpen size={14} aria-hidden />
              </div>
              <h2 className="hs-strip-title text-stone-400 tracking-widest uppercase font-black text-sm">Filter Inventory</h2>
            </div>
          </div>
          
          <div className="p-6 sm:p-8">
            {!canManageRooms(currentUser) && (
              <div className="mb-6">
                <Alert variant="info" title="Read-only access">
                  Your role can review rooms and beds; only Admin or Staff can register or edit rooms.
                </Alert>
              </div>
            )}

            <div className="grid items-end gap-6 md:grid-cols-12">
              <div className="md:col-span-6 lg:col-span-6">
                <Field label="Room code">
                  <Input
                    icon={Search}
                    placeholder="Filter by code…"
                    className="!h-12 border-stone-200 focus:ring-4 focus:ring-teal-500/5 transition-[border-color,box-shadow]"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </Field>
              </div>
              
              <div className="md:col-span-3 lg:col-span-3">
                <Field label="Status">
                  <Select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
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
                <Field label="Room category">
                  <Select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
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
                  onClear: () => setQuery(""),
                },
                {
                  key: "status",
                  label: "Status",
                  value: statusFilter !== "all" ? statusFilter : "",
                  onClear: () => setStatusFilter("all"),
                },
                {
                  key: "type",
                  label: "Category",
                  value: typeFilter !== "all" ? typeFilter : "",
                  onClear: () => setTypeFilter("all"),
                },
              ]}
              onClearAll={() => {
                setQuery("");
                setStatusFilter("all");
                setTypeFilter("all");
              }}
            />
          </div>
        </Card>

        {error ? (
          <Alert variant="error" title="Could not load rooms">
            {error}
          </Alert>
        ) : null}

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
                          {(room.room_type || "").charAt(0).toUpperCase() + (room.room_type || "").slice(1)} Unit
                        </p>
                      </div>
                    </div>
                    <StatusBadge size="xs">{room.status}</StatusBadge>
                  </div>

                  <div className="space-y-4 p-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="mb-1 text-[10px] font-bold tracking-widest text-stone-400">Capacity</p>
                        <p className="text-sm font-bold text-stone-900">
                          {capacity} {capacity === 1 ? "Bed" : "Beds"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="mb-1 text-[10px] font-bold tracking-widest text-stone-400">Monthly Rate</p>
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
                    <span className="text-[10px] font-bold tracking-widest text-stone-400 transition-colors group-hover:text-teal-700">
                      View Profile
                    </span>
                    {/* Registry Action Pattern (Master §5.8) */}
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-400 transition-[border-color,background-color,color] group-hover:border-teal-200 group-hover:bg-teal-50 group-hover:text-teal-600">
                      <ArrowUpRight size={14} aria-hidden />
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>

        {rooms.length === 0 && !error ? (
          <div className="mt-6">
             <EmptyState
               title="No rooms match these filters"
               message="Try clearing search or status, or register a new room to expand the registry."
             />
          </div>
        ) : null}

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
            disabled={loading}
            className="mt-4 rounded-2xl border border-stone-200 bg-white"
          />
        ) : null}
      </motion.div>
    </AppMain>
  );
}
