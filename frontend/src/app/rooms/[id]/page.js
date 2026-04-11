"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  DoorOpen,
  Edit2,
  ArrowLeft,
  Settings,
  Info,
  Receipt,
  Columns2,
  UserCheck,
  ShieldCheck,
} from "lucide-react";

import { apiRequest } from "../../../lib/api";
import { canManageRooms } from "../../../lib/auth";
import { useAuthGuard } from "../../../hooks/useAuthGuard";
import { formatPHP } from "../../../lib/formatters";
import Alert from "../../_components/ui/Alert";
import { AppMain } from "../../_components/ui/AppShell";
import { Card } from "../../_components/ui/Card";
import PageHeader from "../../_components/ui/PageHeader";
import { SkeletonDetailPage } from "../../_components/ui/Skeleton";
import Breadcrumbs from "../../_components/ui/Breadcrumbs";
import UserRoleBadge from "../../_components/ui/UserRoleBadge";
import { StatusBadge } from "../../../components/ui/StatusBadge";

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.2, ease: "easeOut" },
};

function MetricItem({ label, value, icon: Icon }) {
  return (
    <div className="flex items-center gap-4 border-b border-stone-100 py-4 last:border-0">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-stone-50 text-stone-400">
        <Icon size={18} aria-hidden />
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400 [word-spacing:0.08em]">{label}</p>
        <p className="text-sm font-bold tabular-nums text-stone-900">{value}</p>
      </div>
    </div>
  );
}

export default function RoomDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params?.id;

  const { user: currentUser, authLoading } = useAuthGuard();
  const shouldReduceMotion = useReducedMotion();
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState("");

  const loadRoom = useCallback(async () => {
    try {
      const data = await apiRequest(`/api/rooms/${roomId}`, { method: "GET" });
      setRoom(data);
    } catch (error) {
      setApiError(error?.message || "Failed to load room details.");
    }
  }, [roomId]);

  useEffect(() => {
    if (authLoading || !currentUser || !roomId) return;

    const fetchData = async () => {
      try {
        await loadRoom();
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [authLoading, currentUser, roomId, loadRoom]);

  if (authLoading || loading) {
    return (
      <AppMain>
        <SkeletonDetailPage />
      </AppMain>
    );
  }

  const title = room ? `Room ${room.room_code}` : "Room";
  const bedSpaces = room?.bed_spaces ?? [];

  return (
    <AppMain>
      <motion.div
        initial={shouldReduceMotion ? false : pageVariants.initial}
        animate={shouldReduceMotion ? false : pageVariants.animate}
        transition={shouldReduceMotion ? { duration: 0 } : pageVariants.transition}
        className="space-y-6"
      >
        <PageHeader
          title={title}
          subtitle={
            room ? (
              <>
                <span className="block sm:inline">
                  Room profile — beds, status, and assignments.
                </span>
                <span className="mt-1 block font-mono text-[10px] font-bold uppercase tracking-tighter text-stone-400 sm:mt-0 sm:ml-2 sm:inline">
                  #ROOM-{room.room_id}
                </span>
              </>
            ) : (
              "Loading room…"
            )
          }
          breadcrumbs={
            <Breadcrumbs
              items={[
                { label: "Room Registry", href: "/rooms" },
                { label: "Room Profile" },
              ]}
            />
          }
          actions={
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => router.push("/rooms")}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-500 transition-colors hover:bg-stone-50"
                aria-label="Back to Room Registry"
              >
                <ArrowLeft size={18} aria-hidden />
              </button>
              {canManageRooms(currentUser) ? (
                <Link
                  href={`/rooms/${roomId}/edit`}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-teal-600 px-6 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-teal-900/10 transition-colors hover:bg-teal-700"
                >
                  <Edit2 size={16} aria-hidden />
                  Update details
                </Link>
              ) : null}
              <div className="border-l border-stone-200 pl-3">
                <UserRoleBadge username={currentUser?.username} roleName={currentUser?.role?.role_name} />
              </div>
            </div>
          }
        />

        {apiError ? (
          <Alert variant="error" title="Could not load room">
            {apiError}
          </Alert>
        ) : null}

        <div className="grid gap-8 lg:grid-cols-12">
          <aside className="space-y-6 lg:col-span-4">
            <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
              <div className="flex flex-col items-center border-b border-stone-100 bg-stone-50/50 px-8 py-6 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-stone-200 bg-white text-teal-600 shadow-sm">
                  <DoorOpen size={32} aria-hidden />
                </div>
                <h2 className="text-xl font-black tracking-tight text-stone-900">{room?.room_code}</h2>
                <div className="mt-2">
                  <StatusBadge size="sm">{room?.status}</StatusBadge>
                </div>
              </div>
              <div className="flex justify-center border-b border-stone-100 bg-stone-50/30 px-4 py-3">
                <span className="text-xs font-bold uppercase tracking-wide text-stone-400 [word-spacing:0.08em]">
                  At a Glance
                </span>
              </div>
              <div className="space-y-2 p-8">
                <MetricItem label="Monthly Rate" value={formatPHP(room?.monthly_rate)} icon={Receipt} />
                <MetricItem
                  label="Bed Capacity"
                  value={`${room?.capacity ?? "—"} ${Number(room?.capacity) === 1 ? "bed" : "beds"}`}
                  icon={UserCheck}
                />
                <MetricItem
                  label="Room Category"
                  value={
                    room?.room_type
                      ? room.room_type.charAt(0).toUpperCase() + room.room_type.slice(1)
                      : "—"
                  }
                  icon={Columns2}
                />
              </div>
            </Card>

            <Card className="rounded-2xl border-stone-200 !p-8 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-100 text-stone-600">
                  <Info size={16} aria-hidden />
                </div>
                <h3 className="hs-strip-title">Amenities</h3>
              </div>
              <p className="text-sm font-medium leading-relaxed text-stone-600">
                {room?.amenities || "No amenities on file for this room."}
              </p>
            </Card>
          </aside>

          <div className="space-y-6 lg:col-span-8">
            <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
              <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/50 px-8 py-5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                    <ShieldCheck size={14} aria-hidden />
                  </div>
                  <h2 className="hs-strip-title">Bed Spaces</h2>
                </div>
                <span className="font-mono text-[10px] font-bold uppercase tracking-tighter text-stone-400">
                  {bedSpaces.length} {bedSpaces.length === 1 ? "record" : "records"}
                </span>
              </div>

              <div className="overflow-x-auto p-0">
                <table className="w-full min-w-[320px] text-left">
                  <caption className="sr-only">Bed spaces for this room</caption>
                  <thead>
                    <tr className="border-b border-stone-100 bg-stone-50/50">
                      <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-stone-400">
                        Registry ID
                      </th>
                      <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-stone-400">
                        Bed label
                      </th>
                      <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-stone-400">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {bedSpaces.map((bed) => (
                      <tr key={bed.bed_space_id} className="transition-colors hover:bg-stone-50">
                        <td className="px-6 py-4">
                          <span className="font-mono text-[10px] font-bold uppercase tracking-tighter text-stone-400">
                            #BS-{bed.bed_space_id}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-stone-900">{bed.bed_label}</td>
                        <td className="px-6 py-4">
                          <StatusBadge size="xs">{bed.status}</StatusBadge>
                        </td>
                      </tr>
                    ))}
                    {bedSpaces.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-6 py-12 text-center">
                          <p className="text-sm font-bold text-stone-700">No bed spaces</p>
                          <p className="mt-1 text-xs font-medium text-stone-500">
                            Bed records should appear here once the room is configured.
                          </p>
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
              <div className="flex items-center gap-2.5 border-b border-stone-100 bg-stone-50/50 px-8 py-5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-stone-100 text-stone-600">
                  <Settings size={14} aria-hidden />
                </div>
                <h2 className="hs-strip-title">Description</h2>
              </div>
              <div className="p-8">
                <p className="text-sm font-medium leading-relaxed text-stone-600">
                  {room?.description || "No description on file."}
                </p>
              </div>
            </Card>
          </div>
        </div>
      </motion.div>
    </AppMain>
  );
}
