"use client";

import {
  User, Phone, Mail, MapPin,
  History, Edit2,
  Calendar, FileCheck, AlertTriangle
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState, useMemo } from "react";
import useSWR from "swr";
import { apiRequest, fetcher } from "../../../lib/api";
import { flattenApiErrors } from "../../../lib/errors";
import { canManageBilling, canManageTenants } from "../../../lib/auth";
import { formatDateString, formatPHP, formatTenantDirectoryName } from "../../../lib/formatters";
import Button from "../../_components/ui/Button";
import { Card } from "../../_components/ui/Card";
import Breadcrumbs from "../../_components/ui/Breadcrumbs";
import { Table } from "../../_components/ui/Table";
import { StatusBadge } from "../../_components/ui/StatusBadge";
import { secondaryOutlineLinkClass } from "../../_components/ui/LinkTokens";
import LifecycleActions from "../../_components/ui/LifecycleActions";
import RecordStateAlert from "../../_components/ui/RecordStateAlert";
import StandardPage from "../../_components/ui/StandardPage";
import ResourceIdCell from "../../_components/ui/ResourceIdCell";
import Avatar from "../../_components/ui/Avatar";
import { useAuth } from "../../_context/AuthContext";
import { interactiveTableRowClass, stopRowClick } from "../../../lib/tableRows";
import PageHeaderActions from "../../_components/ui/PageHeaderActions";
import { normalizePaginatedList } from "../../../lib/pagination";
import SectionCard from "../../_components/ui/SectionCard";
import { SkeletonDetailPage } from "../../_components/ui/Skeleton";

function DetailRow({ label, value, icon: Icon, mono = false }) {
  return (
    <div className="flex items-start justify-between py-3.5 border-b border-stone-50 last:border-0 hover:bg-stone-50/50 transition-colors">
      <div className="flex items-center gap-2.5">
        <div className="text-stone-300">
          <Icon size={14} strokeWidth={2.5} />
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">{label}</span>
      </div>
      <span className={`text-sm font-semibold text-stone-900 text-right max-w-[200px] leading-snug ${mono ? 'font-mono' : ''}`}>
        {value || "—"}
      </span>
    </div>
  );
}

function MetricItem({ label, value, icon: Icon }) {
  return (
    <div className="flex items-center gap-4 border-b border-stone-100 py-4 last:border-0 hover:bg-stone-50/30 transition-colors">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-stone-50 text-stone-400 border border-white/60 shadow-sm">
        <Icon size={18} strokeWidth={2.5} />
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">{label}</p>
        <p className="text-sm font-black tabular-nums text-stone-900">{value}</p>
      </div>
    </div>
  );
}

function ArchiveTenantModal({ open, tenant, isSubmitting, onClose, onConfirm }) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && !isSubmitting) onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, isSubmitting, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="archive-tenant-title">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        aria-label="Close archive confirmation"
        disabled={isSubmitting}
        onClick={onClose}
      />
      <div className="relative w-full max-w-[460px] rounded-2xl border border-stone-200 bg-white p-8 shadow-2xl">
        <div className="mb-6 flex items-start gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-rose-50 shadow-sm shadow-rose-900/10">
            <AlertTriangle className="size-6 text-rose-600" aria-hidden />
          </div>
          <div>
            <h2 id="archive-tenant-title" className="text-xl font-black tracking-tight text-stone-900">Archive Tenant</h2>
            <p className="mt-1 text-sm text-stone-500">This will remove the tenant from active operations while preserving historical and audit records.</p>
          </div>
        </div>
        <div className="mb-6 rounded-2xl border border-stone-100 bg-stone-50/50 p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Record</p>
          <p className="mt-1 text-sm font-black text-stone-900">{tenant ? formatTenantDirectoryName(tenant) : "—"}</p>
          <div className="mt-2">
            {tenant && <ResourceIdCell id={tenant.tenant_id} prefix="TENANT" />}
          </div>
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

export default function TenantDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const tenantId = params?.id;

  const { user: currentUser } = useAuth();
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
              Personal information, emergency contacts, and active lease records.
            </span>
            <div className="h-3 w-[1px] bg-stone-200" />
            <ResourceIdCell id={tenant.tenant_id} prefix="TENANT" />
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
              <Link
                href={`/tenants/${tenantId}/edit`}
                className={secondaryOutlineLinkClass + " px-6"}
              >
                <Edit2 size={16} aria-hidden />
                Update Details
              </Link>
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
      <ArchiveTenantModal
        open={showArchiveModal}
        tenant={tenant}
        isSubmitting={busyAction === "archive"}
        onClose={() => busyAction !== "archive" && setShowArchiveModal(false)}
        onConfirm={handleArchiveTenant}
      />

      <div className="space-y-6">
        <RecordStateAlert show={Boolean(actionError)} variant="error" title="Action blocked">
          {actionError}
        </RecordStateAlert>
        <RecordStateAlert show={hasActiveContract && canManage} variant="info" title="Lifecycle locked">
          Tenant lifecycle changes are restricted while an active contract exists. Process move-out first.
        </RecordStateAlert>

        <div className="grid gap-6 lg:grid-cols-12">
          {/* --- Left Column: Overview --- */}
          <aside className="lg:col-span-4 space-y-6">
            <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
              <div className="bg-stone-50/50 border-b border-stone-100 px-8 py-6 flex flex-col items-center text-center">
                <Avatar tenant={tenant} size="xl" />
                <h2 className="mt-4 text-xl font-black text-stone-900 tracking-tight">{fullName}</h2>
                <div className="mt-2">
                  <StatusBadge size="sm">{tenant?.status || "active"}</StatusBadge>
                </div>
              </div>
              <div className="flex justify-center border-b border-stone-100 bg-stone-50/30 px-4 py-3">
                <span className="text-xs font-bold uppercase tracking-widest text-stone-400">At a glance</span>
              </div>
              <div className="p-8 space-y-2">
                <MetricItem
                  label="Current room"
                  value={activeContract ? (activeContract.room?.room_code ? `Room ${activeContract.room.room_code}` : "—") : "—"}
                  icon={MapPin}
                />
                <MetricItem
                  label="Lease started"
                  value={activeContract ? formatDateString(activeContract.move_in_date) : "—"}
                  icon={Calendar}
                />
                <MetricItem
                  label="Deposit on file"
                  value={activeContract ? formatPHP(activeContract.deposit_amount) : "—"}
                  icon={FileCheck}
                />
              </div>
            </Card>

            <SectionCard
              title="Emergency Contact"
              icon={Phone}
              titleSize="xs"
            >
              <div className="space-y-4">
                <DetailRow label="Name" value={tenant?.emergency_contact_name} icon={User} />
                <DetailRow label="Phone" value={tenant?.emergency_contact_number} icon={Phone} mono />
              </div>
            </SectionCard>
          </aside>

          {/* --- Right Column: Details & History --- */}
          <main className="lg:col-span-8 space-y-6">
            <SectionCard
              title="Basic Information"
              icon={User}
              titleSize="xs"
            >
              <div className="grid gap-x-12 gap-y-2 md:grid-cols-2">
                <DetailRow label="First Name" value={tenant?.first_name} icon={User} />
                <DetailRow label="Last Name" value={tenant?.last_name} icon={User} />
                <DetailRow label="Phone number" value={tenant?.contact_number} icon={Phone} mono />
                <DetailRow label="Email" value={tenant?.email} icon={Mail} />
                <div className="md:col-span-2">
                  <DetailRow label="Permanent address" value={tenant?.address} icon={MapPin} />
                </div>
              </div>
            </SectionCard>

            <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
              <div className="border-b border-stone-100 bg-stone-50/50 px-8 py-5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-stone-100 text-stone-600">
                    <History size={14} aria-hidden />
                  </div>
                  <h2 className="hs-strip-title text-stone-400 uppercase tracking-widest font-black text-[10px]">Lease Agreements</h2>
                </div>
              </div>

              <div className="p-0">
                <Table
                  embedded
                  caption="History of tenant contracts"
                  columns={[
                    { key: "contract_id", label: "CONTRACT ID" },
                    { key: "room", label: "ROOM CODE" },
                    { key: "dates", label: "LEASE PERIOD" },
                    { key: "status", label: "STATUS" },
                    { key: "actions", label: "", className: "text-right" },
                  ]}
                  rows={contracts.map((c) => (
                    <tr
                      key={c.contract_id}
                      className={interactiveTableRowClass}
                      onClick={() => router.push(`/contracts/${c.contract_id}`)}
                    >
                      <td className="px-6 py-4">
                        <ResourceIdCell id={c.contract_id} prefix="CONTRACT" />
                      </td>
                      <td className="px-6 py-4 font-bold text-sm text-stone-800 leading-tight">
                        {c.room?.room_code ? `Room ${c.room.room_code}` : "—"}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-xs text-stone-600 leading-tight">
                          {formatDateString(c.move_in_date)} — {c.expected_move_out_date ? formatDateString(c.expected_move_out_date) : "Present"}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge size="xs">{c.status}</StatusBadge>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {c.status === "active" && canManageBilling(currentUser) ? (
                          <Link
                            href={`/payments/new?contract_id=${c.contract_id}&tenant_id=${tenantId}`}
                            className="inline-flex h-8 items-center justify-center rounded-lg bg-teal-600 px-4 text-[10px] font-black uppercase tracking-widest text-white shadow-sm transition-colors hover:bg-teal-700"
                            onClick={stopRowClick}
                          >
                            Record payment
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
    </StandardPage>
  );
}
