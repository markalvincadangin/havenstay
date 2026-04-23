"use client";
import { useMemo, use, useState } from "react";
import useSWR from "swr";
import { fetcher, apiRequest } from "@/lib/api";
import { canManageMeters } from "@/lib/auth";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import Alert from "@/components/ui/Alert";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import { Card } from "@/components/ui/Card";
import PageHeaderActions from "@/components/ui/PageHeaderActions";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table } from "@/components/ui/Table";
import Button from '@/components/ui/Button';
import ResourceView from "@/components/ui/ResourceView";
import ResourceIdCell from "@/components/ui/ResourceIdCell";
import StandardPage from "@/components/ui/StandardPage";
import { SkeletonDetailPage } from "@/components/ui/Skeleton";
import { formatDateString, } from "@/lib/formatters";
import { Plus, Clock, FileMinus, Key, Zap, Droplet, Edit2 } from "lucide-react";
import LifecycleActions from "@/components/ui/LifecycleActions";
import ConfirmationDialog from "@/components/ui/ConfirmationDialog";
import { useRouter } from "next/navigation";
import { useToasts } from "@/context/ToastContext";
import { SideSheetOverlay } from "@/components/ui/SideSheetOverlay";
import { MeterQuickEditForm } from '@/features/utilities/components/MeterQuickEditForm';
import { MeterReadingForm } from '@/features/utilities/components/MeterReadingForm';
/**
 * Meter Registry Detail — /admin/meters/[id]
 */
export default function MeterDetailPage({ params }) {
  const unwrappedParams = use(params);
  const meterId = unwrappedParams.id;
  const router = useRouter();
  const { showToast } = useToasts();
  const { user: currentUser, authLoading, isUnauthorized } = useAuthGuard();
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const [activeSideSheet, setActiveSideSheet] = useState(null); // 'edit' or 'reading'
  const canAccess = useMemo(() => canManageMeters(currentUser), [currentUser]);
  const viewDenied = !authLoading && currentUser !== null && !canAccess;
  const { data: meter, error: meterError, isValidating: isSyncing, mutate: refetchMeter } = useSWR(
    !authLoading && currentUser && canAccess ? `/api/meters/${meterId}` : null,
    fetcher
  );
  const handleArchiveMeter = async () => {
    setBusyAction("archive");
    try {
      await apiRequest(`/api/meters/${meterId}/archive`, { method: "POST" });
      showToast("Meter archived.", "success");
      router.push("/utilities/meters");
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setBusyAction("");
    }
  };
  const loading = !meter && !meterError;
  if (isUnauthorized) return null;
  const title = meter ? `Meter Asset ${meter.serial_number}` : "Meter Record";
  const isElectric = meter?.utility?.name?.toLowerCase().includes("electric");
  const UtilityIcon = isElectric ? Zap : Droplet;
  const assignments = meter?.assignments ? [...meter.assignments].sort((a, b) => new Date(b.valid_from) - new Date(a.valid_from)) : [];
  const readings = meter?.readings ? [...meter.readings].sort((a, b) => new Date(b.reading_date) - new Date(a.reading_date)) : [];
  return (
    <StandardPage
      title={title}
      subtitle="Authoritative hardware profile and consumption ledger."
      breadcrumbs={
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Utilities", href: "/utilities" },
            { label: "Hardware", href: "/utilities/meters" },
            { label: title },
          ]}
        />
      }
      loading={authLoading || loading}
      skeleton={<SkeletonDetailPage />}
      actions={
        <PageHeaderActions
          backHref="/utilities/meters"
          backLabel="Back to Registry"
          user={currentUser}
        >
          {canManageMeters(currentUser) && (
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                className="px-6 shadow-sm border-stone-200"
                onClick={() => setActiveSideSheet('edit')}
              >
                <Edit2 size={16} aria-hidden />
                Update
              </Button>
              <LifecycleActions
                canManage={true}
                status={meter?.status}
                busyAction={busyAction}
                onArchive={() => setShowArchiveModal(true)}
              />
              <Button
                className="px-8 shadow-lg shadow-teal-900/10"
                onClick={() => setActiveSideSheet('reading')}
              >
                <Plus size={16} aria-hidden />
                Record Reading
              </Button>
            </div>
          )}
        </PageHeaderActions>
      }
    >
      <ConfirmationDialog
        open={showArchiveModal}
        title="Archive Hardware"
        message="This will remove the unit from active assignment. History is preserved."
        confirmLabel="Confirm Archive"
        isDanger
        isLoading={busyAction === "archive"}
        onConfirm={handleArchiveMeter}
        onCancel={() => setShowArchiveModal(false)}
      />
      <div className="mx-auto w-full max-w-5xl space-y-6">
        {viewDenied && (
          <Alert variant="warning" title="Access restricted" data-testid="access-denied-meter">
            You do not have permission to view meter profiles.
          </Alert>
        )}
        {!viewDenied && (
          <ResourceView
            isLoading={loading}
            isSyncing={isSyncing}
            error={meterError}
            isEmpty={!meter}
            onRetry={() => refetchMeter()}
            skeleton={<SkeletonDetailPage />}
          >
            {meter && (
              <div className="space-y-6">
                {/* Meta Overview */}
                <Card className="overflow-hidden border-stone-200 shadow-sm rounded-2xl p-0 hs-glass-effect">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-8 bg-white">
                    <div className="flex items-center gap-4">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-xl shadow-inner ${isElectric ? 'bg-amber-50 text-amber-500' : 'bg-sky-50 text-sky-500'}`}>
                        <UtilityIcon size={24} strokeWidth={2.5} />
                      </div>
                      <div>
                        <h2 className="text-xl font-black text-stone-900 tracking-tight">{meter.utility?.name || "Utility"}</h2>
                        <div className="flex items-center gap-2 mt-1 font-mono text-xs font-bold uppercase tracking-widest text-stone-400">
                          <ResourceIdCell id={meter.meter_id} prefix="METER" />
                          <span> • </span>
                          <span>Unit: {meter.utility?.unit_of_measurement}</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <StatusBadge size="md">{meter.status}</StatusBadge>
                    </div>
                  </div>
                </Card>
                <div className="grid gap-6 md:grid-cols-2">
                  {/* Assignment History */}
                  <Card className="overflow-hidden border-stone-200 !p-0 shadow-sm rounded-2xl flex flex-col h-full hs-glass-effect">
                    <div className="flex items-center gap-3 border-b border-stone-100 bg-stone-50/50 px-8 py-5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 shadow-inner">
                        <Key size={16} strokeWidth={2.5} />
                      </div>
                      <div>
                        <h2 className="hs-strip-title text-[10px] uppercase font-black tracking-[0.2em] text-stone-900">
                          Room Assignments
                        </h2>
                      </div>
                    </div>
                    <div className="flex-1">
                      <Table
                        embedded={true}
                        dense={true}
                        caption="Meter Assignment History"
                        columns={[
                          { key: "room", label: "ROOM" },
                          { key: "valid_from", label: "ACTIVATION DATE" },
                          { key: "valid_to", label: "DEACTIVATION DATE", className: "text-right pr-8" },
                        ]}
                        rows={assignments.map((assignment) => (
                          <tr key={assignment.assignment_id} className="border-t border-stone-100 hs-table-row-dense hover:bg-stone-50">
                            <td className="pl-8 py-3">
                              <ResourceIdCell type="room" id={assignment.room_id} />
                            </td>
                            <td className="py-3 text-[11px] font-medium text-stone-600">
                              {formatDateString(assignment.valid_from)}
                            </td>
                            <td className="pr-8 py-3 text-right">
                              {assignment.valid_to ? (
                                <span className="text-[11px] font-medium text-stone-500">{formatDateString(assignment.valid_to)}</span>
                              ) : (
                                <StatusBadge size="sm">active</StatusBadge>
                              )}
                            </td>
                          </tr>
                        ))}
                        emptyTitle="No Assignments"
                        emptyDescription="This meter has never been assigned to a room."
                      />
                    </div>
                  </Card>
                  {/* Reading History */}
                  <Card className="overflow-hidden border-stone-200 !p-0 shadow-sm rounded-2xl flex flex-col h-full bg-white/50 backdrop-blur-sm">
                    <div className="flex items-center gap-3 border-b border-stone-100 bg-stone-50/50 px-8 py-5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-600 shadow-inner">
                        <FileMinus size={16} strokeWidth={2.5} />
                      </div>
                      <div>
                        <h2 className="hs-strip-title text-[10px] uppercase font-black tracking-[0.2em] text-stone-900">
                          Consumption Log
                        </h2>
                      </div>
                    </div>
                    <div className="flex-1">
                      <Table
                        embedded={true}
                        dense={true}
                        caption="Meter Reading History"
                        columns={[
                          { key: "date", label: "READING DATE", className: "pl-8" },
                          { key: "value", label: "METER INDEX", className: "text-right" },
                          { key: "agent", label: "STAFF OFFICER", className: "text-right pr-8" },
                        ]}
                        rows={readings.map((reading) => (
                          <tr key={reading.reading_id} className="border-t border-stone-100 hs-table-row-dense hover:bg-stone-50">
                            <td className="pl-8 py-3 text-[11px] font-medium text-stone-600">
                              <div className="flex items-center gap-2">
                                <Clock size={12} className="text-stone-400" />
                                {formatDateString(reading.reading_date)}
                              </div>
                            </td>
                            <td className="py-3 text-right">
                              <span className="font-mono text-xs font-bold text-stone-900 tracking-wider">
                                {Number(reading.reading_value).toFixed(2)}
                              </span>
                              {reading.is_rollover ? (
                                <div className="text-[9px] uppercase tracking-widest text-teal-600 font-bold mt-0.5">Rollover</div>
                              ) : null}
                            </td>
                            <td className="pr-8 py-3 text-right text-[11px] font-bold text-stone-500">
                              {reading.recorder?.first_name} {reading.recorder?.last_name}
                            </td>
                          </tr>
                        ))}
                        emptyTitle="No Readings Logged"
                        emptyDescription="No consumption entries have been recorded yet."
                      />
                    </div>
                  </Card>
                </div>
              </div>
            )}
          </ResourceView>
        )}
      </div>
      <SideSheetOverlay
        isOpen={!!activeSideSheet}
        onClose={() => setActiveSideSheet(null)}
        title={activeSideSheet === 'edit' ? "Update Meter Info" : "Record Reading"}
      >
        {activeSideSheet === 'edit' && (
          <MeterQuickEditForm
            meter={meter}
            currentUser={currentUser}
            onSuccess={() => {
              setActiveSideSheet(null);
              refetchMeter();
            }}
            onCancel={() => setActiveSideSheet(null)}
          />
        )}
        {activeSideSheet === 'reading' && (
          <MeterReadingForm
            meter={meter}
            onSuccess={() => {
              setActiveSideSheet(null);
              refetchMeter();
            }}
            onCancel={() => setActiveSideSheet(null)}
          />
        )}
      </SideSheetOverlay>
    </StandardPage>
  );
}
