"use client";

import { useState } from "react";
import useSWR from "swr";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  DoorOpen,
  Edit2,
  AlertTriangle,
  Settings,
  Info,
  Receipt,
  Columns2,
  UserCheck,
  ShieldCheck,
} from "lucide-react";

import { apiRequest, fetcher } from "../../../lib/api";
import { canManageRooms } from "../../../lib/auth";
import { formatDateString, formatPHP, formatTenantDirectoryName } from "../../../lib/formatters";
import Alert from "../../_components/ui/Alert";
import Button from "../../_components/ui/Button";
import { Card } from "../../_components/ui/Card";
import Breadcrumbs from "../../_components/ui/Breadcrumbs";
import { StatusBadge } from "../../_components/ui/StatusBadge";
import { Table } from "../../_components/ui/Table";
import { secondaryOutlineLinkClass } from "../../_components/ui/LinkTokens";
import { ROOM_UNIT_OFFLINE_BED_HINT } from "../../../lib/constants";
import StandardPage from "../../_components/ui/StandardPage";
import ResourceIdCell from "../../_components/ui/ResourceIdCell";
import { useAuth } from "../../_context/AuthContext";
import PageHeaderActions from "../../_components/ui/PageHeaderActions";
import SectionCard from "../../_components/ui/SectionCard";
import { SkeletonDetailPage } from "../../_components/ui/Skeleton";

function MetricItem({ label, value, icon: Icon }) {
  return (
    <div className="flex items-center gap-4 border-b border-stone-100 py-4 last:border-0 hover:bg-stone-50/30 transition-colors">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-stone-50 text-stone-400 border border-white/60 shadow-sm">
        <Icon size={18} strokeWidth={2.5} aria-hidden />
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">{label}</p>
        <p className="text-sm font-black tabular-nums text-stone-900">{value}</p>
      </div>
    </div>
  );
}

function ArchiveRoomModal({ open, roomCode, isSubmitting, onClose, onConfirm }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="archive-room-title">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        aria-label="Close archive room confirmation"
        disabled={isSubmitting}
        onClick={onClose}
      />
      <div className="relative w-full max-w-[460px] rounded-2xl border border-stone-200 bg-white p-8 shadow-2xl">
        <div className="mb-6 flex items-start gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-rose-50 shadow-sm shadow-rose-900/10">
            <AlertTriangle className="size-6 text-rose-600" aria-hidden />
          </div>
          <div>
            <h2 id="archive-room-title" className="text-xl font-black tracking-tight text-stone-900">Archive Room</h2>
            <p className="mt-1 text-sm text-stone-500">This will remove the room from active operations while preserving historical and audit records.</p>
          </div>
        </div>
        <div className="mb-6 rounded-2xl border border-stone-100 bg-stone-50/50 p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Record</p>
          <p className="mt-1 text-sm font-black text-stone-900">{roomCode || "—"}</p>
        </div>
        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="secondary" className="!h-11 rounded-xl px-6 text-[10px] font-bold uppercase tracking-widest" disabled={isSubmitting} onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant="danger" className="!h-11 rounded-xl px-8 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-red-900/10" loading={isSubmitting} disabled={isSubmitting} onClick={onConfirm}>
            Archive
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function RoomDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params?.id;

  const { user: currentUser } = useAuth();
  const { data: room, error: roomError } = useSWR(
    currentUser && roomId ? `/api/rooms/${roomId}` : null,
    fetcher
  );

  const loading = !room && !roomError;
  const [actionError, setActionError] = useState("");
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  const title = room ? `Room ${room.room_code}` : "Room";
  const bedSpaces = room?.bed_spaces ?? [];
  const roomStatusLower = String(room?.status ?? "").toLowerCase();
  const hasOccupiedBeds = room?.has_occupied_beds ?? bedSpaces.some((bed) => bed?.status === "occupied");
  const hasActiveContracts = room?.has_active_contracts ?? false;
  const archiveBlockReason = hasActiveContracts
    ? "Room cannot be archived while active contracts are linked to its bed spaces."
    : hasOccupiedBeds
      ? "Room cannot be archived while one or more bed spaces are occupied."
      : "";
  const canArchiveRoom = canManageRooms(currentUser) && !archiveBlockReason;
  const unitOfflineBedHint =
    room && (roomStatusLower === "maintenance" || roomStatusLower === "unavailable")
      ? ROOM_UNIT_OFFLINE_BED_HINT[roomStatusLower]
      : null;

  const handleArchiveRoom = async () => {
    if (!roomId) return;
    setActionError("");
    setIsArchiving(true);
    try {
      await apiRequest(`/api/rooms/${roomId}/archive`, { method: "POST" });
      setShowArchiveModal(false);
      router.push("/rooms");
    } catch (err) {
      setActionError(err?.message || "Failed to archive room.");
      setShowArchiveModal(false);
    } finally {
      setIsArchiving(false);
    }
  };

  return (
    <StandardPage
      title={title}
      subtitle={
        room ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-stone-500">
              Room profile — beds, status, and assignments.
            </span>
            <div className="hidden sm:block h-3 w-[1px] bg-stone-200" />
            <ResourceIdCell id={room.room_id} prefix="ROOM" />
          </div>
        ) : (
          "Loading room…"
        )
      }
      loading={loading}
      skeleton={<SkeletonDetailPage />}
      error={roomError}
      breadcrumbs={
        <Breadcrumbs
          items={[
            { label: "Room Inventory", href: "/rooms" },
            { label: "Room Profile" },
          ]}
        />
      }
      actions={
        <PageHeaderActions
          backHref="/rooms"
          backLabel="Back to Room Inventory"
          user={currentUser}
        >
          {canManageRooms(currentUser) && (
            <div className="flex items-center gap-2">
              <Link
                href={`/rooms/${roomId}/edit`}
                className={secondaryOutlineLinkClass + " px-6"}
              >
                <Edit2 size={16} aria-hidden />
                Update Details
              </Link>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowArchiveModal(true)}
                disabled={isArchiving || !canArchiveRoom}
                className="!h-11 rounded-xl border border-rose-200 px-6 text-[10px] font-black uppercase tracking-widest text-rose-600 hover:bg-rose-50"
              >
                Archive
              </Button>
            </div>
          )}
        </PageHeaderActions>
      }
    >
      <ArchiveRoomModal
        open={showArchiveModal}
        roomCode={room?.room_code}
        isSubmitting={isArchiving}
        onClose={() => !isArchiving && setShowArchiveModal(false)}
        onConfirm={handleArchiveRoom}
      />

      <div className="space-y-6">
        {actionError ? (
          <Alert variant="error" title="Action failed">
            {actionError}
          </Alert>
        ) : null}
        {!canArchiveRoom && canManageRooms(currentUser) ? (
          <Alert variant="info" title="Archive disabled">
            {archiveBlockReason}
          </Alert>
        ) : null}

        {unitOfflineBedHint ? (
          <Alert variant="info" title="Unit not bookable">
            {unitOfflineBedHint}
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
                <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">
                  At a Glance
                </span>
              </div>
              <div className="space-y-2 p-8">
                <MetricItem label="Monthly Rent" value={formatPHP(room?.monthly_rate)} icon={Receipt} />
                <MetricItem
                  label="Bed Capacity"
                  value={`${room?.capacity ?? "—"} ${Number(room?.capacity) === 1 ? "Bed" : "Beds"}`}
                  icon={UserCheck}
                />
                <MetricItem
                  label="Room Category"
                  value={
                    room?.room_type
                      ? (room.room_type === 'solo' ? 'Solo Room' : 'Shared Room')
                      : "—"
                  }
                  icon={Columns2}
                />
              </div>
            </Card>

            <SectionCard
              title="Amenities"
              icon={Info}
              iconClassName="bg-stone-100 text-stone-600"
              titleSize="xs"
            >
              <p className="text-sm font-medium leading-relaxed text-stone-600">
                {room?.amenities || "No amenities on file for this room."}
              </p>
            </SectionCard>
          </aside>

          <div className="space-y-6 lg:col-span-8">
            <SectionCard
              title="Room Layout"
              icon={ShieldCheck}
              iconClassName="bg-teal-50 text-teal-600"
              rightElement={(
                <span className="font-mono text-[10px] font-bold uppercase tracking-tighter text-stone-400">
                  {bedSpaces.length} {bedSpaces.length === 1 ? "bed" : "beds"}
                </span>
              )}
              titleSize="xs"
            >
              <div className="mx-[-2rem] mb-[-2rem]">
                <Table
                  embedded
                  columns={[
                    { key: "registry_id", label: "BED SPACE ID" },
                    { key: "bed_label", label: "BED LABEL" },
                    { key: "status", label: "STATUS" },
                    { key: "tenant", label: "TENANT" },
                    { key: "move_in", label: "MOVE-IN" },
                  ]}
                  rows={bedSpaces.map((bed) => (
                    <tr key={bed.bed_space_id} className="transition-colors hover:bg-stone-50">
                      <td className="px-6 py-4">
                        <ResourceIdCell id={bed.bed_space_id} prefix="BS" />
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-stone-900 font-mono tracking-tight">{bed.bed_label}</td>
                      <td className="px-6 py-4">
                        <StatusBadge size="xs">{bed.status}</StatusBadge>
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-stone-800 leading-tight">
                        {bed.active_contract?.tenant ? (
                          <Link
                            href={`/tenants/${bed.active_contract.tenant.tenant_id}`}
                            className="text-teal-600 transition-colors hover:text-teal-700 hover:underline"
                          >
                            {formatTenantDirectoryName(bed.active_contract.tenant)}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-stone-600 leading-tight">
                        {bed.active_contract?.move_in_date
                          ? formatDateString(bed.active_contract.move_in_date)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                  emptyTitle="No bed spaces"
                  emptyDescription="Bed records should appear here once the room is configured."
                />
              </div>
            </SectionCard>

            <SectionCard
              title="Management Notes"
              icon={Settings}
              iconClassName="bg-stone-100 text-stone-600"
              titleSize="xs"
            >
              <p className="text-sm font-medium leading-relaxed text-stone-600">
                {room?.description || "No description on file."}
              </p>
            </SectionCard>
          </div>
        </div>
      </div>
    </StandardPage>
  );
}
