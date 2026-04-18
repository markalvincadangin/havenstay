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
  Activity,
} from "lucide-react";

import { apiRequest, fetcher } from "../../../lib/api";
import { canManageRooms } from "../../../lib/auth";
import { formatDateString, formatPHP, formatTenantDirectoryName } from "../../../lib/formatters";
import Alert from "../../_components/ui/Alert";
import RecordStateAlert from "../../_components/ui/RecordStateAlert";
import Button from "../../_components/ui/Button";
import LifecycleActions from "../../_components/ui/LifecycleActions";
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
import ConfirmationDialog from "../../_components/ui/ConfirmationDialog";
import MetricItem from "../../_components/ui/MetricItem";




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
  const { mutate: mutateRoom } = useSWR(currentUser && roomId ? `/api/rooms/${roomId}` : null, fetcher);
  const [actionError, setActionError] = useState("");
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [busyAction, setBusyAction] = useState("");

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
  const canArchiveRoom = canManageRooms(currentUser) && !archiveBlockReason && room?.status !== 'archived';
  const unitOfflineBedHint =
    room && roomStatusLower === "maintenance"
      ? ROOM_UNIT_OFFLINE_BED_HINT[roomStatusLower]
      : null;

  const handleArchiveRoom = async () => {
    if (!roomId) return;
    setActionError("");
    setBusyAction("archive");
    try {
      await apiRequest(`/api/rooms/${roomId}/archive`, { method: "POST" });
      setShowArchiveModal(false);
      router.push("/rooms");
    } catch (err) {
      setActionError(err?.message || "Failed to archive room.");
      setShowArchiveModal(false);
    } finally {
      setBusyAction("");
    }
  };

  const runLifecycleAction = async (action, path) => {
    setActionError("");
    setBusyAction(action);
    try {
      await apiRequest(path, { method: "POST" });
      await mutateRoom();
    } catch (error) {
      setActionError(error?.message || `Failed to ${action} room.`);
    } finally {
      setBusyAction("");
    }
  };

  return (
    <StandardPage
      title={title}
      subtitle={
        room ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-stone-500">
              Unit profile: beds, status, and assignments.
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
              <LifecycleActions
                canManage={canManageRooms(currentUser)}
                status={room?.status}
                hasActiveContract={hasActiveContracts || hasOccupiedBeds}
                busyAction={busyAction}
                onArchive={() => setShowArchiveModal(true)}
                onRestore={() => runLifecycleAction("restore", `/api/rooms/${roomId}/restore`)}
              />
            </div>
          )}
        </PageHeaderActions>
      }
    >
      <ConfirmationDialog
        open={showArchiveModal}
        title="Archive Inventory Unit"
        message={`Are you sure you want to archive Room ${room?.room_code}? This will remove the unit from active booking availability while keeping its history.`}
        confirmLabel="Archive Room"
        isDanger
        isLoading={busyAction === "archive"}
        onConfirm={handleArchiveRoom}
        onCancel={() => busyAction !== "archive" && setShowArchiveModal(false)}
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

        <RecordStateAlert show={room?.status === 'archived'} variant="warning" title="Forensic History">
          This room is currently archived and decommissioned from active inventory. It will not appear in occupancy reports or booking availability until restored.
        </RecordStateAlert>

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
                  Quick Profile
                </span>
              </div>
              <div className="space-y-2 p-8">
                <MetricItem label="Rental Rate" value={formatPHP(room?.monthly_rate)} icon={Receipt} />
                <MetricItem
                  label="Unit Capacity"
                  value={`${room?.capacity ?? "—"} ${Number(room?.capacity) === 1 ? "Bed" : "Beds"}`}
                  icon={UserCheck}
                />
                <MetricItem
                  label="Unit Category"
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

            <SectionCard
              title="Utility Monitoring"
              icon={Activity}
              iconClassName="bg-teal-50 text-teal-600"
              titleSize="xs"
            >
              <div className="space-y-4">
                <p className="text-xs font-medium text-stone-500 leading-relaxed">
                  Sub-meter tracking for electric and water consumption is active for this unit.
                </p>
                <Link
                  href={`/rooms/${roomId}/meters`}
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-stone-50 border border-stone-100 text-[10px] font-black uppercase tracking-widest text-teal-600 hover:bg-white hover:border-teal-200 transition-all shadow-sm"
                >
                  <Activity size={14} />
                  Manage Readings
                </Link>
              </div>
            </SectionCard>
          </aside>

          <div className="space-y-6 lg:col-span-8">
            <SectionCard
              title="Bed Inventory"
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
                    { key: "registry_id", label: "RECORD ID", className: "pl-8" },
                    { key: "bed_label", label: "BED LABEL", className: "text-center" },
                    { key: "status", label: "STATUS", className: "text-center" },
                    { key: "tenant", label: "TENANT NAME" },
                    { key: "move_in", label: "MOVE-IN DATE", className: "text-right pr-8" },
                  ]}
                  rows={bedSpaces.map((bed) => (
                    <tr key={bed.bed_space_id} className="transition-colors hover:bg-stone-50">
                      <td className="pl-8 py-5">
                        <ResourceIdCell id={bed.bed_space_id} prefix="BS" />
                      </td>
                      <td className="py-5 text-center text-sm font-bold text-stone-900 font-mono tracking-tight">{bed.bed_label}</td>
                      <td className="py-5 text-center">
                        <StatusBadge size="xs">{bed.status}</StatusBadge>
                      </td>
                      <td className="py-5 text-sm font-semibold text-stone-800 leading-tight">
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
                      <td className="pr-8 py-5 text-right text-sm text-stone-600 leading-tight">
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
              title="Administrative Notes"
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
