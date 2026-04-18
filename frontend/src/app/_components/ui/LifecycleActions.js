"use client";

import Button from "./Button";

export default function LifecycleActions({
  canManage = false,
  status = "active",
  hasActiveContract = false,
  busyAction = "",
  onReactivate,
  onArchive,
  onRestore,
}) {
  if (!canManage) return null;

  const isArchived = status === "archived";
  const isMovedOut = status === "moved_out";
  const canReactivate = !isArchived && isMovedOut;
  const canArchive = !isArchived && !hasActiveContract;
  const canRestore = isArchived;

  return (
    <div className="flex items-center gap-2">
      {canReactivate ? (
        <Button
          type="button"
          variant="secondary"
          onClick={onReactivate}
          loading={busyAction === "reactivate"}
          disabled={Boolean(busyAction)}
          className="!h-11 rounded-xl px-6 text-[10px] font-black uppercase tracking-widest border-teal-100 text-teal-700 hover:bg-teal-50"
        >
          Reactivate
        </Button>
      ) : null}
      {!isArchived ? (
        <Button
          type="button"
          variant="ghost"
          onClick={onArchive}
          loading={busyAction === "archive"}
          disabled={Boolean(busyAction) || hasActiveContract}
          className="!h-11 rounded-xl border border-rose-100 px-6 text-[10px] font-black uppercase tracking-widest text-rose-600 hover:bg-rose-50 disabled:opacity-50 disabled:cursor-not-allowed"
          title={hasActiveContract ? "Cannot archive tenant with active lease" : undefined}
        >
          Archive
        </Button>
      ) : null}
      {canRestore ? (
        <Button
          type="button"
          variant="primary"
          onClick={onRestore}
          loading={busyAction === "restore"}
          disabled={Boolean(busyAction)}
          className="!h-11 rounded-xl bg-teal-600 px-8 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-teal-900/10 border-0"
        >
          Restore
        </Button>
      ) : null}
    </div>
  );
}
