"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { DoorOpen, Search, Plus, ArrowUpRight } from "lucide-react";

import { apiRequest } from "../../lib/api";
import { flattenApiErrors } from "../../lib/errors";
import { canManageRooms } from "../../lib/auth";
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
import { primaryLinkCtaClass } from "../_components/ui/primaryLinkClasses";
import { StatusBadge } from "../../components/ui/StatusBadge";
import FilterChips from "../_components/ui/FilterChips";

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.2, ease: "easeOut" },
};

function OccupancyBar({ bedSpaces, capacity }) {
  const shouldReduceMotion = useReducedMotion();
  const total = Number(capacity) || 0;
  const occupied = Array.isArray(bedSpaces)
    ? bedSpaces.filter((b) => b.status === "occupied").length
    : 0;
  const vacant = Array.isArray(bedSpaces)
    ? bedSpaces.filter((b) => b.status === "vacant").length
    : 0;
  const pct = total > 0 ? Math.round((occupied / total) * 100) : 0;

  return (
    <div className="mt-2">
      <div className="mb-1.5 flex items-center justify-between">
        <div className="flex flex-col">
          <p className="text-[10px] font-bold tracking-widest text-stone-400">
            Bed Occupancy
          </p>
          {vacant > 0 && (
            <p className="text-[9px] font-medium text-teal-600">
              {vacant} {vacant === 1 ? 'bed' : 'beds'} available
            </p>
          )}
        </div>
        <p className="text-[10px] font-bold tabular-nums text-stone-900">
          {occupied}/{total}
        </p>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
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
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (authLoading || !currentUser) return;

    const fetchRooms = async () => {
      try {
        const data = await apiRequest("/api/rooms", { method: "GET" });
        setRooms(Array.isArray(data) ? data : data?.rooms || []);
      } catch (err) {
        setError(flattenApiErrors(err));
      } finally {
        setLoading(false);
      }
    };
    fetchRooms();
  }, [authLoading, currentUser]);

  const filteredRooms = useMemo(() => {
    return rooms.filter((room) => {
      const matchStatus = statusFilter === "all" || String(room.status).toLowerCase() === statusFilter;
      const matchType = typeFilter === "all" || String(room.room_type).toLowerCase() === typeFilter;
      const matchSearch = !query || String(room.room_code).toLowerCase().includes(query.toLowerCase());
      return matchStatus && matchType && matchSearch;
    });
  }, [rooms, statusFilter, typeFilter, query]);

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
          title="Room Registry"
          subtitle="Review room inventory, capacity limits, and current rate configurations."
          breadcrumbs={<Breadcrumbs items={[{ label: "Room Registry" }]} />}
          actions={(
            <div className="flex items-center gap-3">
              {canManageRooms(currentUser) && (
                <Link href="/rooms/new" className={primaryLinkCtaClass + " gap-2 !px-5 shadow-sm"}>
                  <Plus size={18} aria-hidden />
                  <span>Register Room</span>
                </Link>
              )}
              <div className={`flex items-center ${canManageRooms(currentUser) ? "border-l border-stone-200 pl-3" : ""}`}>
                <UserRoleBadge username={currentUser?.username} roleName={currentUser?.role?.role_name} />
              </div>
            </div>
          )}
        />

        <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
          <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/50 px-6 py-4 sm:px-8 sm:py-5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-stone-100 text-stone-600">
                <DoorOpen size={14} aria-hidden />
              </div>
              <h2 className="hs-strip-title">Registry Filters</h2>
            </div>
          </div>
          
          <div className="p-6">
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
                    className="!h-12 border-stone-200 focus:border-teal-500/50"
                  >
                    <option value="all">All Statuses</option>
                    <option value="available">Available</option>
                    <option value="unavailable">Unavailable</option>
                    <option value="maintenance">Maintenance</option>
                  </Select>
                </Field>
              </div>

              <div className="md:col-span-3 lg:col-span-3">
                <Field label="Room category">
                  <Select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="!h-12 border-stone-200 focus:border-teal-500/50"
                  >
                    <option value="all">All Categories</option>
                    <option value="solo">Solo Room</option>
                    <option value="shared">Shared Room</option>
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

        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredRooms.map((room) => {
            const capacity = Number(room.capacity || 0);
            return (
              <Link
                key={room.room_id}
                href={`/rooms/${room.room_id}`}
                className="group block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2"
              >
                <Card className="h-full !p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm transition-[box-shadow,border-color] duration-200 group-hover:border-teal-200/80 group-hover:shadow-md">
                  <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/50 px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-stone-200 bg-white text-teal-600 shadow-sm transition-[background-color,border-color] group-hover:border-teal-100 group-hover:bg-teal-50">
                        <DoorOpen size={18} aria-hidden />
                      </div>
                      <div>
                        <p className="font-mono text-lg font-black uppercase leading-none tracking-tight text-stone-900">
                         Room {room.room_code}
                        </p>
                        <p className="mt-1 text-[10px] font-bold tracking-widest text-stone-400">
                          {(room.room_type || "").charAt(0).toUpperCase() + (room.room_type || "").slice(1)}
                        </p>
                      </div>
                    </div>
                    <StatusBadge size="xs">{room.status}</StatusBadge>
                  </div>

                  <div className="space-y-4 p-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="mb-1 text-[10px] font-bold tracking-widest text-stone-400">Beds</p>
                        <p className="text-sm font-bold text-stone-900">
                          {capacity} {capacity === 1 ? "bed" : "beds"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="mb-1 text-[10px] font-bold tracking-widest text-stone-400">Monthly Rate</p>
                        <p className="font-mono text-sm font-bold tabular-nums text-stone-900">{formatPHP(room.monthly_rate)}</p>
                      </div>
                    </div>

                    <OccupancyBar bedSpaces={room.bed_spaces} capacity={capacity} />
                  </div>

                  <div className="mx-6 flex items-center justify-between border-t border-stone-50 py-3">
                    <span className="text-[10px] font-bold tracking-widest text-stone-400 transition-colors group-hover:text-teal-700">
                      View Room
                    </span>
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-stone-50 text-stone-400 transition-[background-color,color] group-hover:bg-teal-50 group-hover:text-teal-600">
                      <ArrowUpRight size={14} aria-hidden />
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>

        {filteredRooms.length === 0 ? (
          <Card className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-dashed border-stone-200 bg-stone-50/30 py-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-stone-200 bg-stone-100 text-stone-400">
              <Search size={28} aria-hidden />
            </div>
            <h3 className="text-sm font-bold text-stone-900">No rooms match these filters</h3>
            <p className="mt-2 max-w-sm text-xs font-medium text-stone-500">
              Try clearing search or status, or register a room if you are Admin or Staff.
            </p>
          </Card>
        ) : null}
      </motion.div>
    </AppMain>
  );
}
