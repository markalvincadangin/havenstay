"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  User, Phone, Mail, MapPin,
  History, Edit2,
  Calendar, FileCheck, ArrowLeft
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../../../lib/api";
import { canManageBilling, canManageTenants } from "../../../lib/auth";
import { useAuthGuard } from "../../../hooks/useAuthGuard";
import { formatDateString, formatPHP, formatTenantDirectoryName, getTenantInitials } from "../../../lib/formatters";
import Alert from "../../_components/ui/Alert";
import { AppMain } from "../../_components/ui/AppShell";
import { Card } from "../../_components/ui/Card";
import PageHeader from "../../_components/ui/PageHeader";
import Breadcrumbs from "../../_components/ui/Breadcrumbs";
import UserRoleBadge from "../../_components/ui/UserRoleBadge";
import { SkeletonDetailPage } from "../../_components/ui/Skeleton";
import { Table } from "../../_components/ui/Table";
import { StatusBadge } from "../../_components/ui/StatusBadge";
import { secondaryOutlineLinkClass } from "../../_components/ui/LinkTokens";

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.2, ease: "easeOut" },
};

function ProfileAvatar({ initials }) {
  return (
    <div className="flex h-20 w-20 items-center justify-center rounded-[2.5rem] bg-stone-100 text-2xl font-black text-stone-500 ring-4 ring-white shadow-xl">
      {initials}
    </div>
  );
}

function DetailRow({ label, value, icon: Icon, mono = false }) {
  return (
    <div className="flex items-start justify-between py-3.5 border-b border-stone-50 last:border-0">
      <div className="flex items-center gap-2.5">
        <div className="text-stone-300">
          <Icon size={14} />
        </div>
        <span className="text-xs font-bold uppercase tracking-wider text-stone-400">{label}</span>
      </div>
      <span className={`text-sm text-stone-900 text-right max-w-[200px] leading-snug ${mono ? 'font-mono' : ''}`}>
        {value || "—"}
      </span>
    </div>
  );
}

function MetricItem({ label, value, icon: Icon }) {
  return (
    <div className="flex items-center gap-4 border-b border-stone-100 py-4 last:border-0">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-stone-50 text-stone-400">
        <Icon size={18} />
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">{label}</p>
        <p className="text-sm font-bold text-stone-900 tabular-nums">{value}</p>
      </div>
    </div>
  );
}

export default function TenantDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const tenantId = params?.id;

  const { user: currentUser, authLoading } = useAuthGuard();
  const shouldReduceMotion = useReducedMotion();
  const [tenant, setTenant] = useState(null);
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState("");

  const loadTenant = useCallback(async () => {
    const data = await apiRequest(`/api/tenants/${tenantId}`, { method: "GET" });
    setTenant(data);
  }, [tenantId]);

  useEffect(() => {
    if (authLoading || !currentUser || !tenantId) return;

    const fetchData = async () => {
      try {
        await loadTenant();
        const contractData = await apiRequest(
          `/api/contracts?tenant_id=${tenantId}`,
          { method: "GET" }
        ).catch(() => []);
        setContracts(Array.isArray(contractData) ? contractData : []);
      } catch (error) {
        setApiError(error?.message || "Failed to load tenant details.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [authLoading, currentUser, tenantId, loadTenant]);

  if (authLoading || loading) return <AppMain><SkeletonDetailPage /></AppMain>;

  const fullName = tenant ? formatTenantDirectoryName(tenant) : "Profile";
  const activeContract = contracts.find(c => c.status === 'active');

  return (
    <AppMain>
      <motion.div
        initial={shouldReduceMotion ? false : pageVariants.initial}
        animate={shouldReduceMotion ? false : pageVariants.animate}
        transition={shouldReduceMotion ? { duration: 0 } : pageVariants.transition}
        className="space-y-6"
      >
        <PageHeader
          title={fullName}
          subtitle={
            tenant ? (
              <>
                <span>
                  Personal information, emergency contacts, and active lease records.
                </span>
                <span className="mt-1 block font-mono text-[10px] font-bold uppercase tracking-tighter text-stone-400 sm:mt-0 sm:ml-2 sm:inline tabular-nums">
                  #TENANT-{tenant.tenant_id}
                </span>
              </>
            ) : (
              "Loading tenant record…"
            )
          }
          breadcrumbs={
            <Breadcrumbs
              items={[
                { label: "Tenant Directory", href: "/tenants" },
                { label: "Profile" },
              ]}
            />
          }
          actions={
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => router.push("/tenants")}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-500 transition-colors hover:bg-stone-50"
                aria-label="Back to Tenant Directory"
              >
                <ArrowLeft size={18} aria-hidden />
              </button>
              {canManageTenants(currentUser) && (
                <Link
                  href={`/tenants/${tenantId}/edit`}
                  className={secondaryOutlineLinkClass + " px-6"}
                >
                  <Edit2 size={16} aria-hidden />
                  Update Details
                </Link>
              )}
              <div className="pl-3 border-l border-stone-200">
                <UserRoleBadge username={currentUser?.username} roleName={currentUser?.role?.role_name} />
              </div>
            </div>
          }
        />

        {apiError ? (
          <Alert variant="error" title="Could not load record">
            {apiError}
          </Alert>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-12">
          {/* --- Left Column: Overview --- */}
          <aside className="lg:col-span-4 space-y-6">
            <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
               <div className="bg-stone-50/50 border-b border-stone-100 px-8 py-6 flex flex-col items-center text-center">
                  <ProfileAvatar initials={tenant ? getTenantInitials(tenant) : "?"} />
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

            <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
              <div className="flex items-center gap-2.5 border-b border-stone-100 bg-stone-50/50 px-8 py-5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                  <Phone size={14} aria-hidden />
                </div>
                <h2 className="hs-strip-title">Emergency Contact</h2>
              </div>
              <div className="p-8">
                 <div className="space-y-4">
                    <DetailRow label="Name" value={tenant?.emergency_contact_name} icon={User} />
                    <DetailRow label="Phone" value={tenant?.emergency_contact_number} icon={Phone} mono />
                 </div>
              </div>
            </Card>
          </aside>

          {/* --- Right Column: Details & History --- */}
          <main className="lg:col-span-8 space-y-6">
            <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
               <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/50 px-8 py-5">
                 <div className="flex items-center gap-2.5">
                   <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                     <User size={14} aria-hidden />
                   </div>
                   <h2 className="hs-strip-title">Basic Information</h2>
                 </div>
               </div>
               
               <div className="p-8">
                 <div className="grid gap-x-12 gap-y-2 md:grid-cols-2">
                    <DetailRow label="First Name" value={tenant?.first_name} icon={User} />
                    <DetailRow label="Last Name" value={tenant?.last_name} icon={User} />
                    <DetailRow label="Phone number" value={tenant?.contact_number} icon={Phone} mono />
                    <DetailRow label="Email" value={tenant?.email} icon={Mail} />
                    <div className="md:col-span-2">
                      <DetailRow label="Permanent address" value={tenant?.address} icon={MapPin} />
                    </div>
                 </div>
               </div>
            </Card>

            <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
               <div className="border-b border-stone-100 bg-stone-50/50 px-8 py-5">
                 <div className="flex items-center gap-2.5">
                   <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                     <History size={14} aria-hidden />
                   </div>
                   <h2 className="hs-strip-title">Lease Agreements</h2>
                 </div>
               </div>

               <div className="p-0">
                 <Table
                   embedded
                   caption="History of tenant contracts"
                   columns={[
                     { key: "contract_id", label: "Contract ID" },
                     { key: "room", label: "Room code" },
                     { key: "dates", label: "Lease period" },
                     { key: "status", label: "Status" },
                     { key: "actions", label: "", className: "text-right" },
                   ]}
                   rows={contracts.map((c) => (
                     <tr 
                       key={c.contract_id} 
                       className="group border-t border-stone-50 hover:bg-stone-50 transition-colors cursor-pointer"
                       onClick={() => router.push(`/contracts/${c.contract_id}`)}
                     >
                       <td className="px-6 py-4">
                         <span className="font-mono text-[10px] font-bold uppercase tracking-tighter text-stone-400 tabular-nums">
                           #CONTRACT-{c.contract_id}
                         </span>
                       </td>
                       <td className="px-6 py-4 font-bold text-sm text-stone-800">
                         {c.room?.room_code ? `Room ${c.room.room_code}` : "—"}
                       </td>
                       <td className="px-6 py-4">
                         <div className="text-xs text-stone-600">
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
                              onClick={(e) => e.stopPropagation()}
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
      </motion.div>
    </AppMain>
  );
}
