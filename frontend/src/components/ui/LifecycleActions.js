"use client";
import Button from "./Button";

export default function LifecycleActions({
  canManage = false,
  status = "active",
  hasActiveContract = false,
  busyAction = "",
  mode = "tenant", // "tenant", "room", or "user"
  isActive = true, // mode="user"
  isArchived = false, // mode="user"
  isSelf = false, // mode="user"
  onDeactivate, // mode="user"
  onReactivate,
  onArchive,
  onRestore,
}) {
  if (!canManage) return null;

  const isRoomMode = mode === "room";
  const isUserMode = mode === "user";

  // Archival logic
  const archivedKey = isRoomMode ? "decommissioned" : "archived";
  const internalIsArchived = isUserMode ? isArchived : status === archivedKey;
  
  // Reactivate logic (Tenant)
  const isMovedOut = !isRoomMode && !isUserMode && status === "moved_out";
  const canTenantReactivate = !isRoomMode && !isUserMode && !internalIsArchived && isMovedOut;

  // Reactivate logic (User)
  const canUserReactivate = isUserMode && !internalIsArchived && !isActive;
  const canUserDeactivate = isUserMode && !internalIsArchived && isActive;

  // Restore logic
  const canRestore = internalIsArchived;

  // Labels
  let archiveLabel = isRoomMode ? "Decommission Room" : "Archive";
  if (isUserMode) archiveLabel = "Archive Account";

  let restoreLabel = isRoomMode ? "Restore Room" : "Restore";
  if (isUserMode) restoreLabel = "Restore Account";

  return (
    <div className="flex items-center gap-2">
      {/* Reactivate Button (Tenant/User) */}
      {(canTenantReactivate || canUserReactivate) ? (
        <Button
          type="button"
          variant="secondary"
          onClick={onReactivate}
          loading={busyAction === "reactivate"}
          disabled={Boolean(busyAction) || isSelf}
          className="!h-11 rounded-xl px-6 text-[10px] font-black uppercase tracking-widest border-teal-100 text-teal-700 hover:bg-teal-50"
        >
          Reactivate
        </Button>
      ) : null}

      {/* Deactivate Button (User Only) */}
      {canUserDeactivate ? (
        <Button
          type="button"
          variant="ghost"
          onClick={onDeactivate}
          loading={busyAction === "deactivate"}
          disabled={Boolean(busyAction) || isSelf}
          className="!h-11 rounded-xl border border-stone-200 px-6 text-[10px] font-black uppercase tracking-widest text-stone-600 hover:bg-stone-50 disabled:opacity-30 disabled:cursor-not-allowed"
          title={isSelf ? "Self-account deactivation restricted." : undefined}
        >
          Deactivate
        </Button>
      ) : null}

      {/* Archive Button */}
      {!internalIsArchived ? (
        <Button
          type="button"
          variant="ghost"
          onClick={onArchive}
          loading={busyAction === "archive" || busyAction === "decommission"}
          disabled={Boolean(busyAction) || hasActiveContract || isSelf}
          className={`!h-11 rounded-xl border px-6 text-[10px] font-black uppercase tracking-widest transition-colors ${
            isUserMode 
              ? "border-rose-100 text-rose-600 hover:bg-rose-50 hover:border-rose-200" 
              : "border-stone-200 text-stone-600 hover:bg-stone-50"
          } disabled:opacity-30 disabled:cursor-not-allowed`}
          title={
            isSelf ? "Self-account archival restricted." :
            hasActiveContract ? `${isRoomMode ? "Decommissioning" : "Archive"} restricted: operational dependencies detected.` : 
            undefined
          }
        >
          {archiveLabel}
        </Button>
      ) : null}

      {/* Restore Button */}
      {canRestore ? (
        <Button
          type="button"
          variant="primary"
          onClick={onRestore}
          loading={busyAction === "restore"}
          disabled={Boolean(busyAction)}
          className="!h-11 rounded-xl bg-teal-600 px-8 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-teal-900/10 border-0"
        >
          {restoreLabel}
        </Button>
      ) : null}
    </div>
  );
}
