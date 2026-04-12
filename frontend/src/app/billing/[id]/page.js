"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, Calendar, CreditCard, FileText, Receipt, User, Building2, History } from "lucide-react";

import { apiRequest } from "../../../lib/api";
import { canManageBilling, canViewBilling } from "../../../lib/auth";
import { flattenApiErrors } from "../../../lib/errors";
import { useAuthGuard } from "../../../hooks/useAuthGuard";
import { formatDateString, formatPHP } from "../../../lib/formatters";
import { isPastDueReceivable } from "../../../lib/billingReceivables";
import { SkeletonDetailPage } from "../../_components/ui/Skeleton";
import Alert from "../../_components/ui/Alert";
import { AppMain } from "../../_components/ui/AppShell";
import Breadcrumbs from "../../_components/ui/Breadcrumbs";
import Button from "../../_components/ui/Button";
import { Card } from "../../_components/ui/Card";
import PageHeader from "../../_components/ui/PageHeader";
import UserRoleBadge from "../../_components/ui/UserRoleBadge";
import { StatusBadge } from "../../_components/ui/StatusBadge";
import { Table } from "../../_components/ui/Table";
import { BILLING_ITEM_TYPE_LABELS } from "../../../lib/constants";

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.2, ease: "easeOut" },
};

/** Metric item — standard registry detail atom. */
function MetricItem({ label, children, icon: Icon }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        {Icon && <Icon size={12} className="text-stone-400" />}
        <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">{label}</span>
      </div>
      <div className="text-sm font-bold text-stone-900">{children ?? "—"}</div>
    </div>
  );
}

export default function BillingDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const billingId = params?.id;
  const shouldReduceMotion = useReducedMotion();

  const { user: currentUser, authLoading } = useAuthGuard();
  const [billing, setBilling] = useState(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState("");

  const canPostPayments = useMemo(() => canManageBilling(currentUser), [currentUser]);

  const loadBilling = useCallback(async () => {
    const data = await apiRequest(`/api/billing/${billingId}`, { method: "GET" });
    setBilling(data);
  }, [billingId]);

  useEffect(() => {
    if (authLoading || !currentUser || !billingId) return;

    const fetchData = async () => {
      if (!canViewBilling(currentUser)) {
        setApiError("Administrative clearance required to view statement details.");
        setLoading(false);
        return;
      }

      try {
        await loadBilling();
      } catch (error) {
        setApiError(flattenApiErrors(error));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [authLoading, currentUser, billingId, loadBilling]);

  if (authLoading || loading) {
    return (
      <AppMain>
        <SkeletonDetailPage />
      </AppMain>
    );
  }

  const tenant = billing?.contract?.tenant;
  const tenantName = tenant ? `${tenant.last_name || ""}, ${tenant.first_name || ""}`.trim() : null;
  const room = billing?.contract?.room;
  const roomCode = room?.room_code || "—";
  const roomId = room?.room_id;
  const totalAmount = Number(billing?.total_amount || 0);
  const totalPaid = Number(billing?.total_paid || 0);
  const balance = Number(billing?.balance || 0);
  const lineItems = billing?.line_items || [];
  const payments = billing?.payments || [];

  return (
    <AppMain>
      <motion.div
        className="mx-auto mt-8 w-full max-w-5xl space-y-6"
        initial={shouldReduceMotion ? false : pageVariants.initial}
        animate={shouldReduceMotion ? false : pageVariants.animate}
        transition={shouldReduceMotion ? { duration: 0 } : pageVariants.transition}
      >
        <PageHeader
          title={`Statement #${billingId || ""}`}
          subtitle="Authoritative cycle statement and collection history."
          breadcrumbs={
            <Breadcrumbs items={[{ label: "Billing", href: "/billing" }, { label: `Bill #${billingId || ""}` }]} />
          }
          actions={
            <>
              <button
                type="button"
                onClick={() => router.push("/billing")}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-500 transition-colors hover:bg-stone-50"
                aria-label="Back to registry"
              >
                <ArrowLeft size={18} aria-hidden />
              </button>
              {canPostPayments && billing && balance > 0 ? (
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => router.push(`/payments/new?billing_id=${billing.billing_id}`)}
                  className="!h-11 rounded-xl bg-teal-600 px-4 sm:px-8 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-teal-900/10 hover:bg-teal-700"
                >
                  <span className="hidden sm:inline">Process Reception</span>
                  <span className="sm:hidden">Pay</span>
                </Button>
              ) : null}
              <div className="hidden sm:block border-l border-stone-200 h-6 mx-1" />
              <UserRoleBadge username={currentUser?.username} roleName={currentUser?.role?.role_name} />
            </>
          }
        />

        {apiError && <Alert variant="error" title="Could not load billing">{apiError}</Alert>}

        {billing ? (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
                <div className="flex items-center gap-3 border-b border-stone-100 bg-stone-50/50 px-8 py-5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                    <Receipt size={16} aria-hidden />
                  </div>
                  <h2 className="hs-strip-title text-stone-400 tracking-widest uppercase font-black text-sm">Billing Summary</h2>
                </div>
                <div className="p-8">
                  <div className="grid gap-8 sm:grid-cols-2">
                    <MetricItem label="Resident" icon={User}>
                      {tenant?.tenant_id ? (
                        <Link href={`/tenants/${tenant.tenant_id}`} className="text-teal-700 underline decoration-teal-700/30 hover:shadow-[0_1px_0_0_currentColor]">
                          {tenantName || "—"}
                        </Link>
                      ) : (
                        tenantName || "—"
                      )}
                    </MetricItem>
                    <MetricItem label="Room Allocation" icon={Building2}>
                      {roomId ? (
                        <Link href={`/rooms/${roomId}`} className="text-teal-700 underline decoration-teal-700/30 hover:shadow-[0_1px_0_0_currentColor]">
                          Room {roomCode}
                        </Link>
                      ) : (
                        `Room ${roomCode}`
                      )}
                    </MetricItem>
                    <MetricItem label="Billing Cycle" icon={Calendar}>
                      <span className="text-stone-600">
                        {formatDateString(billing.billing_period_from)} – {formatDateString(billing.billing_period_to)}
                      </span>
                    </MetricItem>
                    <MetricItem label="Status Protocol">
                      <StatusBadge>{billing.status}</StatusBadge>
                    </MetricItem>
                  </div>
                </div>
              </Card>

              <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
                <div className="flex items-center gap-3 border-b border-stone-100 bg-stone-50/50 px-8 py-5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-50 text-stone-600">
                    <FileText size={16} aria-hidden />
                  </div>
                  <h2 className="hs-strip-title text-stone-400 tracking-widest uppercase font-black text-sm">Charges & Fees</h2>
                </div>
                <div className="p-0">
                  <Table
                    embedded
                    caption={`Line items for statement #${billingId}`}
                    columns={[
                      { key: "type", label: "Type" },
                      { key: "desc", label: "Description" },
                      { key: "amount", label: "Yield", className: "text-right" },
                    ]}
                    rows={lineItems.map((item) => (
                      <tr key={item.billing_line_item_id} className="border-t border-stone-100 group transition-colors hover:bg-stone-50">
                        <td className="px-8 py-4 text-xs font-bold uppercase tracking-widest text-stone-400">
                          {BILLING_ITEM_TYPE_LABELS[item.item_type] || item.item_type || "—"}
                        </td>
                        <td className="px-8 py-4 text-sm font-medium text-stone-900">{item.item_description || "—"}</td>
                        <td className="px-8 py-4 text-right font-mono text-sm font-black tabular-nums text-stone-500 group-hover:text-stone-900">
                          {formatPHP(item.amount)}
                        </td>
                      </tr>
                    ))}
                    emptyTitle="Ledger Empty"
                    emptyDescription="No line items found for this cycle."
                  />
                  {lineItems.length > 0 && (
                    <div className="flex items-center justify-between border-t border-stone-200 bg-stone-50/50 px-8 py-4">
                      <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">Aggregate Yield</span>
                      <span className="font-mono text-base font-black text-stone-900">{formatPHP(totalAmount)}</span>
                    </div>
                  )}
                </div>
              </Card>

              <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
                <div className="flex items-center gap-3 border-b border-stone-100 bg-stone-50/50 px-8 py-5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                    <History size={16} aria-hidden />
                  </div>
                  <h2 className="hs-strip-title text-stone-400 tracking-widest uppercase font-black text-sm">Payment History</h2>
                </div>
                <div className="p-0">
                  <Table
                    embedded
                    caption={`History for statement #${billingId}`}
                    columns={[
                      { key: "date", label: "Reception Date" },
                      { key: "amount", label: "Posted", className: "text-right" },
                      { key: "ref", label: "Reference" },
                      { key: "status", label: "Post Status" },
                      { key: "actions", label: "" },
                    ]}
                    rows={payments.map((payment) => (
                      <tr key={payment.payment_id} className="border-t border-stone-100 group transition-colors hover:bg-stone-50">
                        <td className="px-8 py-4 text-xs font-bold text-stone-900">{formatDateString(payment.payment_date)}</td>
                        <td className="px-8 py-4 text-right font-mono text-sm font-black tabular-nums text-emerald-700">
                          {formatPHP(payment.amount_paid)}
                        </td>
                        <td className="px-8 py-4">
                           <span className="font-mono text-[10px] font-bold uppercase tracking-tighter text-stone-400">
                             {payment.reference_number || "—"}
                           </span>
                        </td>
                        <td className="px-8 py-4"><StatusBadge>{payment.status || "posted"}</StatusBadge></td>
                        <td className="px-8 py-4 text-right">
                          <Link href={`/payments/${payment.payment_id}`} className="text-[10px] font-black uppercase tracking-widest text-teal-700 hover:text-teal-900">
                            Details
                          </Link>
                        </td>
                      </tr>
                    ))}
                    emptyTitle="No Collections"
                    emptyDescription="No posted payments for this cycle."
                  />
                </div>
              </Card>
            </div>

            <div className="space-y-6">
              <div className="rounded-2xl border border-stone-200 bg-stone-900 p-8 shadow-xl">
                 <div className="flex items-center gap-2 mb-6">
                    <CreditCard size={16} className="text-teal-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-stone-500">Statement Yield</span>
                 </div>
                 
                 <div className="space-y-4">
                    <div className="flex justify-between items-baseline border-b border-stone-800 pb-4">
                       <span className="text-stone-500 tracking-widest uppercase font-black text-[10px]">Total Amount</span>
                       <span className="font-mono text-sm font-bold text-stone-300">{formatPHP(totalAmount)}</span>
                    </div>
                    <div className="flex justify-between items-baseline border-b border-stone-800 pb-4">
                       <span className="text-[10px] font-black uppercase tracking-widest text-stone-500">Posted Funds</span>
                       <span className="font-mono text-sm font-bold text-emerald-400">{formatPHP(totalPaid)}</span>
                    </div>
                    <div className="pt-2">
                       <span className="text-[10px] font-black uppercase tracking-widest text-teal-500 block mb-1">Outstanding Receivable</span>
                       <div className="flex items-baseline justify-between">
                          <span className={`${balance > 0 ? "text-teal-400" : "text-emerald-400"} font-mono text-3xl font-black tabular-nums`}>
                            {formatPHP(Math.max(balance, 0))}
                          </span>
                          {balance < 0 && (
                            <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-400">
                               Credit
                            </span>
                          )}
                       </div>
                    </div>
                 </div>

                 {canPostPayments && balance > 0 && (
                    <Button
                      type="button"
                      variant="primary"
                      onClick={() => router.push(`/payments/new?billing_id=${billing.billing_id}`)}
                      className="mt-8 w-full !h-12 rounded-xl bg-teal-600 text-[11px] font-black uppercase tracking-widest shadow-lg shadow-teal-900/50 hover:bg-teal-500 active:scale-95"
                    >
                      Record Payment
                    </Button>
                 )}
              </div>

              <div className="rounded-2xl border border-stone-100 bg-stone-50/50 p-6 space-y-4">
                 <div className="flex items-center gap-2 text-stone-400">
                    <Calendar size={14} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Important Note</span>
                 </div>
                 <MetricItem label="Payment Deadline">
                    <span className={isPastDueReceivable(billing) ? "text-red-700" : "text-stone-900"}>
                       {formatDateString(billing.due_date)}
                    </span>
                 </MetricItem>
                 <p className="text-[11px] leading-relaxed text-stone-500 font-medium">
                   This statement is an authoritative record of monthly accounts. Any discrepancies must be voided and re-posted through administrative protocols.
                 </p>
              </div>
            </div>
          </div>
        ) : (
          <Alert variant="warning" title="Bill Not Found">The requested billing record could not be found.</Alert>
        )}
      </motion.div>
    </AppMain>
  );
}
