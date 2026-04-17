"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Calendar,
  CreditCard,
  FileText,
  Printer,
  Receipt,
  User,
  ShieldCheck,
  RefreshCw,
  Trash2,
  AlertCircle
} from "lucide-react";

import { apiRequest, fetcher } from "../../../lib/api";
import { canManageBilling, canViewBilling } from "../../../lib/auth";
import { formatDateRange, formatDateString, formatPHP } from "../../../lib/formatters";
import Alert from "../../_components/ui/Alert";
import Button from "../../_components/ui/Button";
import { Card } from "../../_components/ui/Card";
import Breadcrumbs from "../../_components/ui/Breadcrumbs";
import { StatusBadge } from "../../_components/ui/StatusBadge";
import { METHOD_LABELS } from "../../../lib/constants";
import StandardPage from "../../_components/ui/StandardPage";
import ResourceIdCell from "../../_components/ui/ResourceIdCell";
import PageHeaderActions from "../../_components/ui/PageHeaderActions";
import { useAuth } from "../../_context/AuthContext";

function paymentStatus(p) {
  return p?.voided_at ? "voided" : "posted";
}

function processorLabel(payment) {
  const u = payment?.processor;
  if (!u) return "System Automated";
  const name = [u.first_name, u.last_name].filter(Boolean).join(" ").trim();
  return name || u.username || "System Automated";
}

function MetricItem({ label, children, mono = false }) {
  return (
    <div className="flex flex-col gap-2 border-l-2 border-stone-100 pl-4 transition-colors hover:border-teal-400">
      <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">{label}</div>
      <div className={`text-sm font-black text-stone-900 ${mono ? "font-mono tracking-tighter" : ""}`}>
        {children ?? "—"}
      </div>
    </div>
  );
}

export default function PaymentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const paymentId = params?.id;

  const { user: currentUser } = useAuth();
  const { data: payment, error: paymentError, mutate: refetchPayment } = useSWR(
    currentUser && paymentId && canViewBilling(currentUser) ? `/api/payments/${paymentId}` : null,
    fetcher
  );

  const loading = !payment && !paymentError;
  const [actionError, setActionError] = useState("");
  const [voidLoading, setVoidLoading] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [isVoiding, setIsVoiding] = useState(false);

  const loadPayment = () => refetchPayment();

  const handleVoid = async () => {
    if (!voidReason.trim()) {
      alert("Please provide a reason for voiding this payment.");
      return;
    }

    setVoidLoading(true);
    setActionError("");
    try {
      await apiRequest(`/api/payments/${paymentId}`, {
        method: "DELETE",
        body: JSON.stringify({ void_reason: voidReason }),
      });
      await loadPayment();
      setIsVoiding(false);
    } catch (error) {
      setActionError(error?.message || "Failed to void payment.");
    } finally {
      setVoidLoading(false);
    }
  };

  const title = payment ? `Payment ${String(paymentId).padStart(6, "0")}` : "Payment Detail";

  const tenant = payment?.billing?.contract?.tenant;
  const tenantName = tenant ? `${tenant.last_name}, ${tenant.first_name}`.trim() : "—";
  const room = payment?.billing?.contract?.room;
  const roomCode = room?.room_code || "—";
  const bedLabel = payment?.billing?.contract?.bed_space?.bed_label || "—";
  const status = paymentStatus(payment);
  const methodKey = String(payment?.payment_method || "").toLowerCase();
  const methodLabel = METHOD_LABELS[methodKey] || payment?.payment_method || "—";

  return (
    <StandardPage
      title={title}
      subtitle={
        payment ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-stone-500">
              Payment details, billing link, and record history.
            </span>
            <div className="hidden sm:block h-3 w-[1px] bg-stone-200" />
            <ResourceIdCell id={payment.payment_id} prefix="PAY" />
          </div>
        ) : (
          "Loading payment details…"
        )
      }
      loading={loading}
      error={paymentError}
      breadcrumbs={
        <Breadcrumbs
          items={[
            { label: "Payments", href: "/payments" }, 
            { label: `PAY ${String(paymentId).padStart(6, "0")}` }
          ]}
        />
      }
      actions={
        <PageHeaderActions
          backHref="/payments"
          backLabel="Back to Payments"
          user={currentUser}
        >
          <Button
            type="button"
            variant="secondary"
            onClick={() => window.print()}
            className="!h-11 rounded-xl px-4 sm:px-6 font-bold uppercase tracking-widest text-[10px] print:hidden border-stone-200"
          >
            <Printer size={16} aria-hidden />
            <span className="hidden sm:inline">Print Receipt</span>
          </Button>
          {canManageBilling(currentUser) && status !== "voided" && (
            <Button
              type="button"
              variant="danger"
              onClick={() => setIsVoiding(true)}
              className="!h-11 rounded-xl px-4 sm:px-6 font-bold uppercase tracking-widest text-[10px] print:hidden shadow-lg shadow-rose-900/5"
            >
              <Trash2 size={16} aria-hidden />
              <span className="hidden sm:inline">Void Payment</span>
            </Button>
          )}
        </PageHeaderActions>
      }
    >
      <div className="space-y-6">
        {status === "voided" && (
          <Alert variant="warning" title="Payment Voided">
            This payment was voided. Amounts have been adjusted in the linked billing record.
          </Alert>
        )}

        {actionError && <Alert variant="error" title="Action failed">{actionError}</Alert>}

        {isVoiding && (
          <Card className="border-rose-200 bg-rose-50/50 p-6 sm:p-8">
             <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                   <div className="flex items-center gap-2 text-rose-700">
                      <AlertCircle size={20} />
                      <h3 className="font-black uppercase tracking-widest text-sm">Void Payment</h3>
                   </div>
                   <p className="text-sm font-medium text-rose-600/80 leading-relaxed max-w-xl">
                      You are about to void this payment. This restores the balance on the linked billing record and keeps the audit history intact.
                   </p>
                </div>
                <div className="flex items-center gap-3">
                   <Button variant="secondary" onClick={() => setIsVoiding(false)} disabled={voidLoading} className="!h-10 rounded-xl px-6">
                      Cancel
                   </Button>
                   <Button variant="danger" onClick={handleVoid} loading={voidLoading} className="!h-10 rounded-xl px-8 shadow-lg shadow-rose-900/10">
                      Confirm Void
                   </Button>
                </div>
             </div>
             <div className="mt-6">
                <label className="text-[10px] font-black uppercase tracking-widest text-rose-700/60 block mb-2 px-1">Void Reason</label>
                <input 
                  type="text"
                  placeholder="e.g. Duplicate entry, wrong amount, incorrect billing link..."
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  className="w-full h-12 bg-white border border-rose-200 rounded-xl px-4 text-sm font-medium focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500/50 outline-none transition-all"
                  autoFocus
                />
             </div>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1 space-y-6">
            <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 bg-stone-900 shadow-xl shadow-stone-900/10">
              <div className="bg-stone-800/50 p-6 flex items-center justify-between border-b border-stone-800">
                <p className="text-[10px] font-black uppercase tracking-widest text-stone-500">Payment Summary</p>
                <StatusBadge size="sm">{status}</StatusBadge>
              </div>
              <div className="p-8 text-white space-y-6">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-2">Amount Paid</p>
                  <p className={`font-mono text-4xl font-black tabular-nums ${status === 'voided' ? 'text-stone-600 line-through' : 'text-emerald-400'}`}>
                    {formatPHP(payment?.amount_paid)}
                  </p>
                </div>
                <div className="grid gap-4 pt-6 border-t border-stone-800">
                  <div className="flex items-center gap-3">
                    <Calendar size={14} className="text-stone-500" />
                    <span className="text-xs font-bold text-stone-300">{formatDateString(payment?.payment_date)}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CreditCard size={14} className="text-stone-500" />
                    <span className="text-xs font-bold text-stone-300">{methodLabel}</span>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
              <div className="border-b border-stone-100 bg-stone-50/50 px-6 py-4">
                <h3 className="hs-strip-title text-stone-400 tracking-widest uppercase font-black text-[10px]">Record History</h3>
              </div>
              <div className="p-6 space-y-5">
                <MetricItem label="Recorded On">
                  {formatDateString(payment?.created_at)} · {new Date(payment?.created_at).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" })}
                </MetricItem>
                <MetricItem label="Recorded By">
                  {processorLabel(payment)}
                </MetricItem>
                {payment?.reference_number && (
                  <MetricItem label="Reference No." mono>
                    {payment.reference_number}
                  </MetricItem>
                )}
              </div>
            </Card>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
              <div className="border-b border-stone-100 bg-stone-50/50 px-8 py-5 flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                  <User size={16} aria-hidden />
                </div>
                <h3 className="hs-strip-title text-stone-400 tracking-widest uppercase font-black text-[10px]">Tenant Details</h3>
              </div>
              <div className="grid gap-8 p-8 sm:grid-cols-2">
                <div className="space-y-6">
                  <MetricItem label="Tenant Name">
                    <Link href={`/tenants/${tenant?.tenant_id}`} className="text-teal-700 hover:underline">{tenantName}</Link>
                  </MetricItem>
                  <MetricItem label="Tenant ID">
                     <ResourceIdCell id={tenant?.tenant_id} prefix="TENANT" />
                  </MetricItem>
                </div>
                <div className="space-y-6">
                  <MetricItem label="Room / Bed Space">
                    {roomCode} · {bedLabel}
                  </MetricItem>
                  <MetricItem label="Room Category">
                    {room?.room_type?.toUpperCase() || "N/A"}
                  </MetricItem>
                </div>
              </div>
            </Card>

            <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
              <div className="border-b border-stone-100 bg-stone-50/50 px-8 py-5 flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                  <Receipt size={16} aria-hidden />
                </div>
                <h3 className="hs-strip-title text-stone-400 tracking-widest uppercase font-black text-[10px]">Linked Billing</h3>
              </div>
              <div className="p-8 space-y-8">
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="flex items-center gap-4 rounded-xl border border-stone-100 bg-stone-50/50 p-4">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm">
                      <RefreshCw size={18} className="text-stone-400" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Billing ID</p>
                      <div className="mt-0.5">
                         <ResourceIdCell id={payment?.billing_id} prefix="BILL" />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 rounded-xl border border-stone-100 bg-stone-50/50 p-4">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm">
                      <Receipt size={18} className="text-stone-400" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Billing Period</p>
                      <p className="text-sm font-black text-stone-900 mt-0.5">
                        {formatDateRange(payment?.billing?.billing_period_from, payment?.billing?.billing_period_to)}
                      </p>
                    </div>
                  </div>
                </div>

                {payment?.remarks && (
                  <div className="rounded-xl bg-stone-50 border border-stone-100 p-6">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-3 flex items-center gap-2">
                       <FileText size={12} />
                       Notes
                    </p>
                    <p className="text-sm font-medium text-stone-600 leading-relaxed italic">
                      &ldquo;{payment.remarks}&rdquo;
                    </p>
                  </div>
                )}

                <div className="flex justify-end pt-4">
                  <Button type="button" variant="secondary" onClick={() => router.push(`/billing/${payment?.billing_id}`)} className="!h-10 px-8 rounded-xl text-[10px] font-bold uppercase tracking-widest group">
                    View Billing
                    <span className="ml-2 group-hover:translate-x-1 transition-transform">→</span>
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-2xl bg-stone-50 p-6 text-stone-500">
          <ShieldCheck size={20} className="text-stone-300" />
          <p className="text-[10px] font-bold uppercase tracking-widest leading-relaxed">
            This payment record is part of the financial ledger. Corrections and voids are logged with the acting user and timestamp.
          </p>
        </div>
      </div>
    </StandardPage>
  );
}
