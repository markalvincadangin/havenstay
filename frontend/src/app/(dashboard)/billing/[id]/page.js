"use client";

import Link from "next/link";
import { useMemo } from "react";
import useSWR from "swr";
import { useParams, useRouter } from "next/navigation";
import { Calendar, Receipt, History, CreditCard, User, Building2, FileText, FileSignature } from "lucide-react";

import { fetcher } from "@/lib/api";
import { canManageBilling, canViewBilling } from "@/lib/auth";
import { formatDateString } from "@/lib/formatters";
import { isPastDueReceivable } from "@/lib/billingReceivables";
import Alert from "@/components/ui/Alert";
import CurrencyDisplay from "@/components/ui/CurrencyDisplay";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table } from "@/components/ui/Table";
import { BILLING_ITEM_TYPE_LABELS } from "@/lib/constants";
import StandardPage from "@/components/ui/StandardPage";
import ResourceIdCell from "@/components/ui/ResourceIdCell";
import { useAuth } from "@/context/AuthContext";
import PageHeaderActions from "@/components/ui/PageHeaderActions";
import { SkeletonDetailPage } from "@/components/ui/Skeleton";
import RecordStateAlert from "@/components/ui/RecordStateAlert";

/** Metric item — standard registry detail atom. */
function MetricItem({ label, children, icon: Icon }) {
  return (
    <div className="flex flex-col gap-2 border-l-2 border-stone-100 pl-4 transition-colors hover:border-teal-400">
      <div className="flex items-center gap-2">
        {Icon && <Icon size={12} strokeWidth={2.5} className="text-stone-300" />}
        <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">{label}</span>
      </div>
      <div className="text-sm font-black text-stone-900 leading-tight">{children ?? "—"}</div>
    </div>
  );
}

export default function BillingDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const billingId = params?.id;

  const { user: currentUser } = useAuth();

  const canPostPayments = useMemo(() => canManageBilling(currentUser), [currentUser]);

  const { data: billing, error: billingError } = useSWR(
    currentUser && billingId && canViewBilling(currentUser) ? `/api/billing/${billingId}` : null,
    fetcher
  );

  const loading = !billing && !billingError;

  const title = billing ? `#BILL-${String(billingId).padStart(6, '0')}` : "Billing Detail";

  const tenant = billing?.contract?.tenant;
  const tenantName = tenant ? `${tenant.last_name || ""}, ${tenant.first_name || ""}`.trim() : null;
  const room = billing?.contract?.room;
  const bedSpace = billing?.contract?.bed_space || billing?.contract?.bedSpace;
  const roomCode = room?.room_code || "—";
  const roomId = room?.room_id;
  const totalAmount = Number(billing?.total_amount || 0);
  const totalPaid = Number(billing?.total_paid || 0);
  const balance = totalAmount - totalPaid;
  const lineItems = billing?.line_items || [];
  const payments = billing?.payments || [];

  return (
    <StandardPage
      title={title}
      subtitle={
        loading ? (
          "Loading billing details..."
        ) : billing ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-stone-500">
              Itemized charges and payments for this bill.
            </span>
            <div className="hidden sm:block h-3 w-[1px] bg-stone-200" />
            <ResourceIdCell id={billing.billing_id} type="billing" />
          </div>
        ) : null
      }
      loading={loading}
      skeleton={<SkeletonDetailPage />}
      error={billingError}
      breadcrumbs={
        <Breadcrumbs
          items={[
            { label: "Billing", href: "/billing" },
            { label: `Billing #${billingId || ""}` }
          ]}
        />
      }
      actions={
        <PageHeaderActions
          backHref="/billing"
          backLabel="Back to Billing"
          user={currentUser}
        />
      }
    >
      {billing ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <RecordStateAlert
              show={billing?.status === 'paid'}
              variant="info"
              title="Bill Settled"
            >
              This billing cycle has been fully collected. No further payments are required.
            </RecordStateAlert>
            <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm hs-glass-effect">
              <div className="flex items-center gap-3 border-b border-stone-100 bg-stone-50/50 px-8 py-5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                  <Receipt size={16} aria-hidden />
                </div>
                <h2 className="hs-strip-title text-stone-400 tracking-widest uppercase font-black text-[10px]">Bill Details</h2>
              </div>
              <div className="p-8">
                <div className="grid gap-8 sm:grid-cols-2">
                  <MetricItem label="Primary Tenant" icon={User}>
                    {tenant?.tenant_id ? (
                      <Link href={`/tenants/${tenant.tenant_id}`} className="text-teal-700 underline decoration-teal-700/30 hover:shadow-[0_1px_0_0_currentColor]">
                        {tenantName || "—"}
                      </Link>
                    ) : (
                      tenantName || "—"
                    )}
                  </MetricItem>
                  <MetricItem label="Room / Bed" icon={Building2}>
                    {roomId ? (
                      <Link href={`/rooms/${roomId}`} className="text-teal-700 underline decoration-teal-700/30 hover:shadow-[0_1px_0_0_currentColor]">
                        Room {roomCode}{bedSpace?.bed_label ? ` / ${bedSpace.bed_label}` : ""}
                      </Link>
                    ) : (
                      `Room ${roomCode}${bedSpace?.bed_label ? " / " + bedSpace.bed_label : ""}`
                    )}
                  </MetricItem>
                  <MetricItem label="Billing Cycle" icon={Calendar}>
                    <span className="text-stone-600">
                      {formatDateString(billing.billing_period_from)} – {formatDateString(billing.billing_period_to)}
                    </span>
                  </MetricItem>
                  <MetricItem label="Status">
                    <StatusBadge>{billing.status}</StatusBadge>
                  </MetricItem>
                  <MetricItem label="Linked Contract" icon={FileSignature}>
                    {billing.contract_id ? (
                      <Link href={`/contracts/${billing.contract_id}`} className="text-teal-700 underline decoration-teal-700/30 hover:shadow-[0_1px_0_0_currentColor]">
                        #CONTRACT-{String(billing.contract_id).padStart(4, "0")}
                      </Link>
                    ) : "—"}
                  </MetricItem>
                  <MetricItem label="Due Date">
                    <span className={isPastDueReceivable(billing) ? "text-red-700" : "text-stone-600"}>
                      {formatDateString(billing.due_date)}
                    </span>
                  </MetricItem>
                </div>
              </div>
            </Card>

            <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm hs-glass-effect">
              <div className="flex items-center gap-3 border-b border-stone-100 bg-stone-50/50 px-8 py-5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-50 text-stone-600">
                  <FileText size={16} aria-hidden />
                </div>
                <h2 className="hs-strip-title text-stone-400 tracking-widest uppercase font-black text-[10px]">Itemized Charges</h2>
              </div>
              <div className="p-0">
                <Table
                  embedded
                  caption={`Line items for billing #${billingId}`}
                  columns={[
                    { key: "type", label: "TYPE" },
                    { key: "desc", label: "DESCRIPTION" },
                    { key: "amount", label: "AMOUNT", className: "text-right" },
                  ]}
                  rows={lineItems.map((item) => (
                    <tr key={item.line_item_id} className="border-t border-stone-100 group transition-colors hover:bg-stone-50">
                      <td className="px-8 py-4 text-xs font-bold uppercase tracking-widest text-stone-400">
                        {BILLING_ITEM_TYPE_LABELS[item.item_type] || item.item_type || "—"}
                      </td>
                      <td className="px-8 py-4 text-sm font-medium text-stone-900 leading-tight">{item.item_description || "—"}</td>
                      <td className="px-8 py-4 text-right group-hover:text-stone-900">
                        <CurrencyDisplay amount={item.amount} className="text-sm font-bold text-stone-700" />
                      </td>
                    </tr>
                  ))}
                  emptyTitle="No line items"
                  emptyDescription="No line items found for this cycle."
                />
                {lineItems.length > 0 && (
                  <div className="flex items-center justify-between border-t border-stone-200 bg-stone-50/50 px-8 py-4">
                    <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">Total amount</span>
                    <CurrencyDisplay amount={totalAmount} className="text-base font-bold text-stone-900" />
                  </div>
                )}
              </div>
            </Card>

            <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm hs-glass-effect">
              <div className="flex items-center gap-3 border-b border-stone-100 bg-stone-50/50 px-8 py-5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                  <History size={16} aria-hidden />
                </div>
                <h2 className="hs-strip-title text-stone-400 tracking-widest uppercase font-black text-[10px]">Payment History</h2>
              </div>
              <div className="p-0">
                <Table
                  embedded
                  caption={`Payment history for billing #${billingId}`}
                  columns={[
                    { key: "date", label: "PAYMENT DATE", className: "pl-8" },
                    { key: "amount", label: "AMOUNT PAID", className: "text-right" },
                    { key: "ref", label: "REFERENCE", className: "text-center" },
                    { key: "status", label: "STATUS", className: "text-center" },
                    { key: "actions", label: "", className: "pr-8" },
                  ]}
                  rows={payments.map((payment) => (
                    <tr key={payment.payment_id} className="border-t border-stone-100 group transition-colors hover:bg-stone-50">
                      <td className="pl-8 py-5 text-xs font-bold text-stone-900">
                        <div className="flex items-center gap-2">
                          {formatDateString(payment.payment_date)}
                          {payment.correlation_id && (
                            <span className="font-mono text-[8px] font-black text-stone-300 bg-stone-50 border border-stone-100 rounded px-1.5 py-0.5" title={`Linked to Audit #TX-${payment.correlation_id.slice(0, 8).toUpperCase()}`}>
                              #TX-{payment.correlation_id.slice(0, 5).toUpperCase()}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-5 text-right">
                        <CurrencyDisplay
                          amount={payment.amount_paid}
                          className={`text-sm font-bold ${payment.voided_at ? "text-stone-400 line-through" : "text-emerald-700"}`}
                        />
                      </td>
                      <td className="py-5 text-center">
                        <ResourceIdCell id={payment.payment_id} type="payment" />
                      </td>
                      <td className="py-5 text-center"><StatusBadge size="xs">{payment.status || "posted"}</StatusBadge></td>
                      <td className="pr-8 py-5 text-right">
                        <Link href={`/payments/${payment.payment_id}`} className="text-[10px] font-black uppercase tracking-widest text-teal-700 hover:text-teal-900">
                          Details
                        </Link>
                      </td>
                    </tr>
                  ))}
                  emptyTitle="No Payments"
                  emptyDescription="No posted payments for this cycle."
                />
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-stone-200 bg-white p-8 shadow-sm hs-glass-effect">
              <div className="flex items-center gap-2 mb-6">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                  <CreditCard size={14} aria-hidden />
                </div>
                <h2 className="hs-strip-title text-stone-400">Billing Summary</h2>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-baseline border-b border-stone-100 pb-4">
                  <span className="text-[10px] font-black uppercase tracking-widest text-stone-500">Total Amount</span>
                  <CurrencyDisplay amount={totalAmount} className="text-sm font-bold text-stone-900" />
                </div>
                <div className="flex justify-between items-baseline border-b border-stone-100 pb-4">
                  <span className="text-[10px] font-black uppercase tracking-widest text-stone-500">Amount Paid</span>
                  <CurrencyDisplay amount={totalPaid} className={`text-sm font-bold ${totalPaid > 0 ? "text-emerald-600" : "text-stone-500"}`} />
                </div>
                <div className="pt-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-stone-400 block mb-1">Remaining Balance</span>
                  <div className="flex items-baseline justify-between">
                    <CurrencyDisplay
                      amount={Math.abs(balance)}
                      className={`${balance > 0 ? "text-red-600" : "text-emerald-600"} text-3xl font-black`}
                    />
                    {balance < 0 && (
                      <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-600">
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
                  className="mt-8 w-full !h-12 rounded-xl bg-teal-600 text-[11px] font-black uppercase tracking-widest shadow-lg shadow-teal-900/50 hover:bg-teal-500 active:scale-95 border-0"
                >
                  Record Payment
                </Button>
              )}
            </div>

            <div className="rounded-2xl border border-stone-100 bg-stone-50/50 p-6 space-y-4 hs-glass-effect">
              <div className="flex items-center gap-2 text-stone-400">
                <Calendar size={14} />
                <span className="text-[10px] font-black uppercase tracking-widest">Important Note</span>
              </div>
              <MetricItem label="Due Date">
                <span className={isPastDueReceivable(billing) ? "text-red-700" : "text-stone-900"}>
                  {formatDateString(billing.due_date)}
                </span>
              </MetricItem>
              <p className="text-[11px] leading-relaxed text-stone-500 font-medium">
                This billing record reflects the current cycle balance. If a posted payment needs correction, void it and record a new payment.
              </p>
            </div>
          </div>
        </div>
      ) : !loading && !billingError ? (
        <Alert variant="warning" title="Billing Not Found">
          The requested billing record could not be found.
        </Alert>
      ) : null}
    </StandardPage>
  );
}
