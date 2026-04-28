"use client";

import { useMemo, use, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Zap,
  Droplet,
  Box,
  Clock,
  Activity,
  Edit2,
  ShieldCheck,
  History
} from "lucide-react";
import { fetcher, apiRequest } from "@/lib/api";
import { canManageMeters, canManageUsers } from "@/lib/auth";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { formatDateString } from "@/lib/formatters";
import { useToasts } from "@/context/ToastContext";

import Alert from "@/components/ui/Alert";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import { Card } from "@/components/ui/Card";
import PageHeaderActions from "@/components/ui/PageHeaderActions";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table } from "@/components/ui/Table";
import ResourceView from "@/components/ui/ResourceView";
import ResourceIdCell from "@/components/ui/ResourceIdCell";
import StandardPage from "@/components/ui/StandardPage";
import { SkeletonDetailPage } from "@/components/ui/Skeleton";
import Button from "@/components/ui/Button";
import ConfirmationDialog from "@/components/ui/ConfirmationDialog";
import { SideSheetOverlay } from "@/components/ui/SideSheetOverlay";
import LifecycleActions from "@/components/ui/LifecycleActions";
import CurrencyCell from "@/components/ui/CurrencyCell";

import { UtilityRateQuickEditForm } from '@/features/utilities/components/UtilityRateQuickEditForm';
import { UtilityQuickEditForm } from '@/features/utilities/components/UtilityQuickEditForm';

/**
 * @module Utilities/ServiceDetail
 * @description Operational view for specific utility categories, hardware inventory, and unit rate history.
 * @version 7.1.0
 * 
 * @traceability
 * - Requirements: FR-024, FR-025, FR-028, FR-031
 * - Business Rules: BR-GEN-002, BR-MET-001, BR-MET-002, BR-MET-007
 * - Forensic: CCR-007
 * 
 * @performance
 * - Category: Operational (30s cache)
 * - Pattern: SWR DetailView with nested relations
 */

export default function UtilityDetailPage({ params }) {
  const unwrappedParams = use(params);
  const utilityId = unwrappedParams.id;
  const router = useRouter();
  const { showToast } = useToasts();
  const { user: currentUser, authLoading, isUnauthorized } = useAuthGuard();

  const [activeSideSheet, setActiveSideSheet] = useState(null); // 'edit-utility', 'add-rate'
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [busyAction, setBusyAction] = useState("");

  const canAccess = useMemo(() => canManageMeters(currentUser), [currentUser]);
  const isAdmin = useMemo(() => canManageUsers(currentUser), [currentUser]);
  const viewDenied = !authLoading && currentUser !== null && !canAccess;

  const {
    data: utility,
    error: utilityError,
    isValidating: isSyncing,
    mutate: refetchUtility
  } = useSWR(
    !authLoading && currentUser && canAccess ? `/api/utilities/${utilityId}` : null,
    fetcher
  );

  const handleArchiveUtility = async () => {
    setBusyAction("archive");
    try {
      await apiRequest(`/api/utilities/${utilityId}/archive`, { method: "POST" });
      showToast("Service category archived.", "success");
      router.push("/utilities");
    } catch (e) {
      showToast(e.message || "Archive restricted: operational dependencies detected.", "error");
    } finally {
      setBusyAction("");
      setShowArchiveModal(false);
    }
  };

  const loading = !utility && !utilityError;

  const rates = useMemo(() => {
    return (utility?.rates || []).sort((a, b) => new Date(b.effective_from) - new Date(a.effective_from));
  }, [utility]);

  if (isUnauthorized) return null;

  const title = utility ? utility.name : "Utility Details";
  const isElectric = utility?.name?.toLowerCase().includes("electric");
  const isWater = utility?.name?.toLowerCase().includes("water");
  const UtilityIcon = isElectric ? Zap : (isWater ? Droplet : Box);

  const meters = utility?.meters || [];

  return (
    <StandardPage
      title={title}
      subtitle="Configure specific utility settings and track historical unit rates."
      breadcrumbs={
        <Breadcrumbs
          items={[
            { label: "Utilities", href: "/utilities" },
            { label: title },
          ]}
        />
      }
      loading={authLoading || loading}
      skeleton={<SkeletonDetailPage />}
      actions={
        <PageHeaderActions
          backHref="/utilities"
          backLabel="Back to Utilities"
          user={currentUser}
        >
          {isAdmin && (
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                className="px-6 shadow-sm border-stone-200"
                onClick={() => setActiveSideSheet('edit-utility')}
              >
                <Edit2 size={16} aria-hidden />
                Update Utility
              </Button>

              <LifecycleActions
                canManage={isAdmin}
                status="active" // Utilities are always active unless soft-deleted
                hasActiveContract={meters.length > 0} // Block archive if meters are linked
                busyAction={busyAction}
                onArchive={() => setShowArchiveModal(true)}
              />
            </div>
          )}
        </PageHeaderActions>
      }
    >
      <ConfirmationDialog
        open={showArchiveModal}
        title="Archive Utility?"
        message="This will hide the utility from future registrations. Historical billing and consumption records will be preserved for auditing. All assigned meters must be decommissioned first."
        confirmLabel="Confirm Archive"
        isDanger
        isLoading={busyAction === "archive"}
        onConfirm={handleArchiveUtility}
        onCancel={() => setShowArchiveModal(false)}
      />

      <div className="mx-auto w-full max-w-5xl space-y-8">
        {viewDenied && (
          <Alert variant="warning" title="Access restricted" data-testid="access-denied-utilities">
            You do not have permission to view utility profiles. Contact an administrator to adjust your access level.
          </Alert>
        )}

        {!viewDenied && (
          <ResourceView
            isLoading={loading}
            isSyncing={isSyncing}
            error={utilityError}
            isEmpty={!utility}
            onRetry={() => refetchUtility()}
            skeleton={<SkeletonDetailPage />}
          >
            {utility && (
              <div className="grid gap-8 lg:grid-cols-12">
                {/* Sidebar Summary (33%) */}
                <div className="lg:col-span-4 space-y-6">
                  <Card className="border-stone-200 shadow-sm p-8 flex flex-col items-center text-center">
                    <div className={`flex h-20 w-20 items-center justify-center rounded-2xl shadow-inner mb-6 ${isElectric ? 'bg-amber-50 text-amber-500' : (isWater ? 'bg-sky-50 text-sky-500' : 'bg-stone-50 text-stone-500')}`}>
                      <UtilityIcon size={40} strokeWidth={2.5} />
                    </div>

                    <h2 className="text-2xl font-black text-stone-900 tracking-tight">{utility.name}</h2>
                    <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                      <ResourceIdCell type="utility" id={utility.utility_id} />
                      <StatusBadge size="sm">active</StatusBadge>
                    </div>

                    <div className="mt-8 w-full border-t border-stone-100 pt-8 space-y-4">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold uppercase tracking-widest text-stone-400">Unit</span>
                        <span className="font-black text-stone-900 border-b-2 border-teal-500/20">
                          {utility.unit_of_measurement === "KWH" ? "kWh" : (utility.unit_of_measurement === "M3" ? "m³" : utility.unit_of_measurement)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold uppercase tracking-widest text-stone-400">Records</span>
                        <span className="font-black text-stone-900">{rates.length} {rates.length === 1 ? 'rate' : 'rates'}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold uppercase tracking-widest text-stone-400">Meter Count</span>
                        <span className="font-black text-stone-900">{meters.length} meters</span>
                      </div>
                    </div>
                  </Card>

                  {/* Forensic Footer Note */}
                  <div className="rounded-xl border border-stone-200 bg-stone-50/50 p-6 flex items-start gap-4">
                    <ShieldCheck size={18} className="text-teal-600 mt-0.5" />
                    <p className="text-[11px] leading-relaxed text-stone-500 italic">
                      Full audit trail enabled. All rate changes are timestamped and immutable once applied to a billing cycle. This utility is referenced by {meters.length} linked meters.
                    </p>
                  </div>
                </div>

                {/* Main Content (67%) */}
                <div className="lg:col-span-8 space-y-6">
                  {/* Rate Schedule Card */}
                  <Card className="overflow-hidden border-stone-200 !p-0 shadow-sm rounded-2xl flex flex-col">
                    <div className="flex items-center justify-between border-b border-stone-100 bg-white px-8 py-5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-600 shadow-inner">
                          <History size={16} strokeWidth={2.5} />
                        </div>
                        <h2 className="hs-strip-title text-[10px] uppercase font-black tracking-widest text-stone-900">
                          Rate History
                        </h2>
                      </div>
                      {canAccess && (
                        <Button
                          variant="primary"
                          className="h-8 px-4 rounded-lg text-[10px] font-black uppercase tracking-widest"
                          onClick={() => setActiveSideSheet('add-rate')}
                        >
                          Add New Rate
                        </Button>
                      )}
                    </div>
                    <div className="flex-1">
                      <Table
                        embedded={true}
                        columns={[
                          { key: "rate_id", label: "Rate ID", className: "pl-8" },
                          { key: "base_rate", label: "Base Rate" },
                          { key: "effective_from", label: "Effective from" },
                          { key: "status", label: "Status", className: "text-right pr-8" },
                        ]}
                        rows={rates.map((rate) => {
                          const isActive = utility.active_rate?.rate_id === rate.rate_id;
                          return (
                            <tr key={rate.rate_id}>
                              <td className="pl-8 py-5">
                                <ResourceIdCell type="rate" id={rate.rate_id} />
                              </td>
                              <td className="py-5">
                                <CurrencyCell 
                                  amount={rate.base_rate} 
                                  suffix={`/ ${utility.unit_of_measurement === "KWH" ? "kWh" : (utility.unit_of_measurement === "M3" ? "m³" : utility.unit_of_measurement)}`} 
                                />
                              </td>
                              <td className="py-5">
                                <div className="flex items-center gap-2 text-xs font-mono font-medium text-stone-600">
                                  <Clock size={12} className="text-stone-400" />
                                  {formatDateString(rate.effective_from)}
                                </div>
                              </td>
                              <td className="pr-8 py-5 text-right">
                                {isActive ? (
                                  <StatusBadge size="sm">active</StatusBadge>
                                ) : (
                                  <StatusBadge size="sm">historical</StatusBadge>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                        emptyTitle="No Rates Defined"
                        emptyDescription="This service has no pricing strategy. Register a rate to enable billing."
                      />
                    </div>
                  </Card>

                  {/* Hardware Assets Card */}
                  <Card className="overflow-hidden border-stone-200 !p-0 shadow-sm rounded-2xl flex flex-col">
                    <div className="flex items-center gap-3 border-b border-stone-100 bg-white px-8 py-5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 shadow-inner">
                        <Activity size={16} strokeWidth={2.5} />
                      </div>
                      <h2 className="hs-strip-title text-[10px] uppercase font-black tracking-widest text-stone-900">
                        Linked Meters
                      </h2>
                    </div>
                    <div className="flex-1">
                      <Table
                        embedded={true}
                        dense={true}
                        columns={[
                          { key: "serial", label: "Serial Number", className: "pl-8" },
                          { key: "status", label: "Status", className: "text-right pr-8" },
                        ]}
                        rows={meters.map((meter) => (
                          <tr key={meter.meter_id}>
                            <td className="pl-8 py-4">
                              <Link
                                href={`/utilities/meters/${meter.meter_id}`}
                                className="font-mono text-[11px] font-black text-teal-600 hover:text-teal-800 hover:underline"
                              >
                                {meter.serial_number}
                              </Link>
                            </td>
                            <td className="pr-8 py-4 text-right">
                              <StatusBadge size="xs">{meter.status}</StatusBadge>
                            </td>
                          </tr>
                        ))}
                        emptyTitle="No Meters Assigned"
                        emptyDescription="There are no active meters measuring this utility."
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
        title={activeSideSheet === 'edit-utility' ? "Utility Details" : "Add Rate"}
      >
        {activeSideSheet === 'add-rate' && (
          <UtilityRateQuickEditForm
            preselectedUtilityId={utility?.utility_id}
            onSuccess={() => {
              setActiveSideSheet(null);
              refetchUtility();
            }}
            onCancel={() => setActiveSideSheet(null)}
          />
        )}
        {activeSideSheet === 'edit-utility' && (
          <UtilityQuickEditForm
            utility={utility}
            onSuccess={() => {
              setActiveSideSheet(null);
              refetchUtility();
            }}
            onCancel={() => setActiveSideSheet(null)}
          />
        )}
      </SideSheetOverlay>
    </StandardPage>
  );
}
