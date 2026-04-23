"use client";
import {
  User, Phone, Mail, MapPin,
  History, Edit2, ArrowUpRight,
  Calendar, FileCheck, _AlertTriangle
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {  useState, useMemo } from "react";
import useSWR from "swr";
import { apiRequest, fetcher } from "@/lib/api";
import { flattenApiErrors } from "@/lib/errors";
import { canManageBilling, canManageTenants } from "@/lib/auth";
import { formatDateString, formatPHP, formatTenantDirectoryName, formatPII } from "@/lib/formatters";
import { Card } from "@/components/ui/Card";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import { Table } from "@/components/ui/Table";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { secondaryOutlineLinkClass } from "@/components/ui/LinkTokens";
import LifecycleActions from "@/components/ui/LifecycleActions";
import RecordStateAlert from "@/components/ui/RecordStateAlert";
import StandardPage from "@/components/ui/StandardPage";
import ResourceIdCell from "@/components/ui/ResourceIdCell";
import Avatar from "@/components/ui/Avatar";
import { useAuth } from "@/context/AuthContext";
import { useToasts } from "@/context/ToastContext";
import { interactiveTableRowClass, stopRowClick } from "@/lib/tableRows";
import PageHeaderActions from "@/components/ui/PageHeaderActions";
import { normalizePaginatedList } from "@/lib/pagination";
import { FormSection } from "@/components/ui/FormSection";
import { SkeletonDetailPage } from "@/components/ui/Skeleton";
import ConfirmationDialog from "@/components/ui/ConfirmationDialog";
import MetricItem from "@/components/ui/MetricItem";
import DetailRow from "@/components/ui/DetailRow";
import { SideSheetOverlay } from "@/components/ui/SideSheetOverlay";
import { TenantQuickEditForm } from '@/features/tenants/components/TenantQuickEditForm';
export default function TenantDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const tenantId = params?.id;
  const { user: currentUser } = useAuth();
  const { showToast } = useToasts();
  const { data: tenant, error: tenantError, mutate: mutateTenant } = useSWR(
    currentUser && tenantId ? `/api/tenants/${tenantId}` : null,
    fetcher
  );
  const { data: contractData } = useSWR(
    currentUser && tenantId ? `/api/contracts?tenant_id=${tenantId}` : null,
    fetcher
  );
  const contracts = useMemo(() => {
    return normalizePaginatedList(contractData).rows;
  }, [contractData]);
  const loading = !tenant && !tenantError;
  const [actionError, setActionError] = useState("");
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const [editingTenant, setEditingTenant] = useState(null);
  const fullName = tenant ? formatTenantDirectoryName(tenant) : "Profile";
  const activeContract = contracts.find(c => c.status === 'active');
  const canManage = canManageTenants(currentUser);
  const hasActiveContract = Boolean(activeContract);
  const handleArchiveTenant = async () => {
    if (!tenant) return;
    setActionError("");
    setBusyAction("archive");
    try {
      await apiRequest(`/api/tenants/${tenantId}/archive`, { method: "POST" });
      showToast("Tenant record archived successfully.", "success");
      setShowArchiveModal(false);
      router.push("/tenants");
    } catch (error) {
      setActionError(flattenApiErrors(error));
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
      showToast(`Action ${action} completed.`, "success");
      await mutateTenant();
    } catch (error) {
      setActionError(flattenApiErrors(error));
    } finally {
      setBusyAction("");
    }
  };
  return (
    <StandardPage
      title={fullName}
      subtitle={
        tenant ? (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-stone-500">
              Comprehensive profile: contact, lease, and ledger context.
            </span>
            <div className="h-3 w-[1px] bg-stone-200" />
            <ResourceIdCell id={tenant.tenant_id} type="tenant" />
          </div>
        ) : (
          "Loading tenant record…"
        )
      }
      loading={loading}
      skeleton={<SkeletonDetailPage />}
      error={tenantError}
      breadcrumbs={
        <Breadcrumbs
          items={[
            { label: "Tenant Directory", href: "/tenants" },
            { label: "Profile" },
          ]}
        />
      }
      actions={
        <PageHeaderActions
          backHref="/tenants"
          backLabel="Back to Tenant Directory"
          user={currentUser}
        >
          {canManageTenants(currentUser) && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEditingTenant(tenant)}
                className={secondaryOutlineLinkClass + " px-6"}
              >
                <Edit2 size={16} aria-hidden />
                Update Details
              </button>
              <LifecycleActions
                canManage={canManage}
                status={tenant?.status}
                hasActiveContract={hasActiveContract}
                busyAction={busyAction}
                onDeactivate={() => runLifecycleAction("deactivate", `/api/tenants/${tenantId}/deactivate`)}
                onReactivate={() => runLifecycleAction("reactivate", `/api/tenants/${tenantId}/reactivate`)}
                onRestore={() => runLifecycleAction("restore", `/api/tenants/${tenantId}/restore`)}
                onArchive={() => setShowArchiveModal(true)}
              />
            </div>
          )}
        </PageHeaderActions>
      }
    >
      <ConfirmationDialog
        open={showArchiveModal}
        title="Archive Tenant Record"
        description={`This will move ${fullName} to historical archives. This action releases active operational locks while preserving all forensic and audit data.`}
        confirmLabel="Archive Profile"
        isDanger
        isLoading={busyAction === "archive"}
        onConfirm={handleArchiveTenant}
        onCancel={() => busyAction !== "archive" && setShowArchiveModal(false)}
      />
      <div className="space-y-6">
        <RecordStateAlert show={Boolean(actionError)} variant="error" title="Action blocked">
          {actionError}
        </RecordStateAlert>
        <RecordStateAlert show={hasActiveContract && canManage} variant="info" title="Lifecycle locked">
          Tenant lifecycle changes are restricted while an active contract exists. Process move-out first.
        </RecordStateAlert>
        <RecordStateAlert show={tenant?.status === 'archived'} variant="warning" title="Forensic History">
          This profile is currently archived in the historical registry. Restoration is required before this tenant can be assigned to new lease agreements.
        </RecordStateAlert>
        <div className="grid gap-6 lg:grid-cols-12">
          {/* --- Left Column: Overview --- */}
          <aside className="lg:col-span-4 space-y-6">
            <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm hs-glass-effect">
              <div className="bg-stone-50/50 border-b border-stone-100 px-8 py-6 flex flex-col items-center text-center">
                <Avatar tenant={tenant} size="xl" />
                <h2 className="mt-4 text-xl font-black text-stone-900 tracking-tight flex items-center gap-2">
                  {fullName}
                  {tenant?.correlation_id && (
                    <span className="font-mono text-[10px] font-black text-stone-300 bg-stone-50 border border-stone-100 rounded px-2 py-0.5" title={`Workflow ID: ${tenant.correlation_id.toUpperCase()}`}>
                      #WF-{tenant.correlation_id.slice(0, 5).toUpperCase()}
                    </span>
                  )}
                </h2>
                <div className="mt-2">
                  <StatusBadge size="sm">{tenant?.status || "active"}</StatusBadge>
                </div>
              </div>
              <div className="flex justify-center border-b border-stone-100 bg-stone-50/30 px-4 py-3">
                <span className="text-xs font-bold uppercase tracking-widest text-stone-400">Quick Profile</span>
              </div>
              <div className="p-8 space-y-2">
                <MetricItem
                  label="Assigned Unit"
                  value={activeContract ? (activeContract.room?.room_code ? `Room ${activeContract.room.room_code}` : "—") : "—"}
                  icon={MapPin}
                />
                <MetricItem
                  label="Move-in Date"
                  value={activeContract ? formatDateString(activeContract.move_in_date) : "—"}
                  icon={Calendar}
                />
                <MetricItem
                  label="Security Deposit"
                  value={activeContract ? formatPHP(activeContract.deposit_amount) : "—"}
                  icon={FileCheck}
                />
              </div>
            </Card>
            <FormSection
              title="Emergency Contact"
              icon={Phone}
              className="hs-glass-effect"
              bodyClassName="p-8 space-y-4"
            >
              <div className="space-y-4">
                <DetailRow label="Name" value={tenant?.emergency_contact_name} icon={User} />
                <DetailRow label="Phone" value={tenant?.emergency_contact_number} icon={Phone} mono />
              </div>
            </FormSection>
          </aside>
          {/* --- Right Column: Details & History --- */}
          <main className="lg:col-span-8 space-y-6">
            <FormSection
              title="Identity & Contact"
              icon={User}
              className="hs-glass-effect"
              bodyClassName="p-8"
            >
              <div className="grid gap-x-12 gap-y-2 md:grid-cols-2">
                <DetailRow label="First Name" value={tenant?.first_name} icon={User} />
                <DetailRow label="Last Name" value={tenant?.last_name} icon={User} />
                <DetailRow label="Mobile Number" value={formatPII(tenant?.contact_number, "phone", canManage)} icon={Phone} mono />
                <DetailRow label="Email" value={formatPII(tenant?.email, "email", canManage)} icon={Mail} />
                <div className="md:col-span-2">
                  <DetailRow label="Permanent Address" value={tenant?.address} icon={MapPin} />
                </div>
              </div>
            </FormSection>
            <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm hs-glass-effect">
              <div className="border-b border-stone-100 bg-white px-8 py-5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-stone-100 text-stone-600">
                    <History size={14} aria-hidden />
                  </div>
                  <h2 className="hs-strip-title text-stone-400 tracking-[0.2em] uppercase font-black text-[10px]">Contract History</h2>
                </div>
              </div>
              <div className="p-0">
                <Table
                  embedded
                  caption="History of tenant contracts"
                  columns={[
                    { key: "contract_id", label: "CONTRACT ID" },
                    { key: "room", label: "ASSIGNED UNIT" },
                    { key: "dates", label: "CONTRACT PERIOD", className: "text-center" },
                    { key: "status", label: "STATUS", className: "text-center" },
                    { key: "actions", label: "", className: "text-right" },
                  ]}
                  rows={contracts.map((c) => (
                    <tr
                      key={c.contract_id}
                      className={interactiveTableRowClass}
                      onClick={() => router.push(`/contracts/${c.contract_id}`)}
                    >
                      <td className="px-8 py-5">
                        <div className="flex flex-col gap-1.5 items-start">
                          <ResourceIdCell id={c.contract_id} type="contract" />
                          {c.correlation_id && (
                            <div className="font-mono text-[8px] font-black text-stone-300 bg-stone-50 border border-stone-100 rounded px-1.5 py-0.5 tracking-widest leading-none block" title={`Workflow ID: ${c.correlation_id.toUpperCase()}`}>
                              #WF-{c.correlation_id.slice(0, 5).toUpperCase()}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-5">
                        <div className="font-bold text-sm text-stone-800 leading-tight">
                          {c.room?.room_code ? `Room ${c.room.room_code}` : "—"}
                        </div>
                        {c.bed_space?.bed_label && (
                          <div className="text-[10px] font-bold text-stone-500 uppercase tracking-widest mt-1">
                            {c.bed_space.bed_label}
                          </div>
                        )}
                      </td>
                      <td className="py-5 text-center">
                        <div className="text-xs text-stone-600 leading-tight">
                          {formatDateString(c.move_in_date)} — {c.expected_move_out_date ? formatDateString(c.expected_move_out_date) : "Present"}
                        </div>
                      </td>
                      <td className="py-5 text-center">
                        <StatusBadge size="xs">{c.status}</StatusBadge>
                      </td>
                      <td className="px-8 py-5 text-right">
                        {c.status === "active" && canManageBilling(currentUser) ? (
                          <Link
                            href={`/billing?contract_id=${c.contract_id}`}
                            className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-400 transition-[border-color,box-shadow,colors] group-hover:border-teal-200 group-hover:bg-teal-50 group-hover:text-teal-600 shadow-sm"
                            onClick={stopRowClick}
                            aria-label="View ledger"
                          >
                            <ArrowUpRight size={16} aria-hidden />
                          </Link>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                  emptyTitle="No contracts found"
                  emptyDescription="This tenant has no registered rental agreements."
                />
              </div>
            </Card>
          </main>
        </div>
      </div>
      <SideSheetOverlay
        isOpen={!!editingTenant}
        onClose={() => setEditingTenant(null)}
        title="Quick Update"
      >
        {editingTenant && (
          <TenantQuickEditForm
            tenant={editingTenant}
            currentUser={currentUser}
            onSuccess={() => {
              setEditingTenant(null);
              mutateTenant();
            }}
            onCancel={() => setEditingTenant(null)}
          />
        )}
      </SideSheetOverlay>
    </StandardPage>
  );
}
