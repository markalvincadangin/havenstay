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
} from "lucide-react";
import { apiRequest, fetcher } from "@/lib/api";
import { useSWRConfig } from "swr";
import { canManageBilling, canViewBilling } from "@/lib/auth";
import { formatDateRange, formatDateString } from "@/lib/formatters";
import CurrencyDisplay from "@/components/ui/CurrencyDisplay";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { METHOD_LABELS } from "@/lib/constants";
import StandardPage from "@/components/ui/StandardPage";
import ResourceIdCell from "@/components/ui/ResourceIdCell";
import { CorrelationIdCell } from "@/components/ui/CorrelationIdCell";
import PageHeaderActions from "@/components/ui/PageHeaderActions";
import { useAuth } from "@/context/AuthContext";
import { useToasts } from "@/context/ToastContext";
import ConfirmationDialog from "@/components/ui/ConfirmationDialog";

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
  const { showToast } = useToasts();
  const { data: payment, error: paymentError, mutate: refetchPayment } = useSWR(
    currentUser && paymentId && canViewBilling(currentUser) ? `/api/payments/${paymentId}` : null,
    fetcher
  );
  const loading = !payment && !paymentError;
  const [voidLoading, setVoidLoading] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [isVoiding, setIsVoiding] = useState(false);
  const { mutate: globalMutate } = useSWRConfig();
  const loadPayment = () => refetchPayment();

  const handleVoid = async () => {
    if (!voidReason.trim()) {
      return;
    }
    setVoidLoading(true);
    try {
      await apiRequest(`/api/payments/${paymentId}`, {
        method: "DELETE",
        body: JSON.stringify({ void_reason: voidReason }),
      });
      await loadPayment();
      globalMutate(key => typeof key === 'string' && key.startsWith('/api/billing'));
      showToast("Payment voided successfully.", "success");
      setIsVoiding(false);
    } catch (error) {
      showToast(error?.message || "Failed to void payment.", "error");
    } finally {
      setVoidLoading(false);
    }
  };

  const title = payment ? `#PAY-${String(paymentId).padStart(6, "0")}` : "Payment Detail";
  const tenant = payment?.billing?.contract?.tenant || payment?.contract?.tenant;
  const tenantName = tenant ? `${tenant.last_name}, ${tenant.first_name}`.trim() : "—";
  const room = payment?.billing?.contract?.room || payment?.contract?.room;
  const roomCode = room?.room_code || "—";
  const bedLabel = (payment?.billing?.contract?.bed_space?.bed_label || payment?.contract?.bed_space?.bed_label) || "—";
  const status = paymentStatus(payment);
  const methodKey = String(payment?.payment_method || "").toLowerCase();
  const methodLabel = METHOD_LABELS[methodKey] || payment?.payment_method || "—";

  return (
    <StandardPage
      title={
        loading ? (
          "Loading Payment..."
        ) : (
          title
        )
      }
      subtitle={
        loading ? (
          "Fetching payment audit log..."
        ) : payment ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-stone-500">
              Payment details, billing link, and record history.
            </span>
            <div className="hidden sm:block h-3 w-[1px] bg-stone-200" />
            <ResourceIdCell id={payment.payment_id} type="payment" />
          </div>
        ) : null
      }
      loading={loading}
      error={paymentError}
      breadcrumbs={
        <Breadcrumbs
          items={[
            { label: "Payments", href: "/payments" },
            { label: `#PAY-${String(paymentId).padStart(6, "0")}` }
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
      {payment ? (
        <div className="space-y-6">
          {status === "voided" && (
            <Alert variant="warning" title="Payment Voided">
              This payment was voided. Amounts have been adjusted in the linked billing record.
            </Alert>
          )}
          <ConfirmationDialog
            open={isVoiding}
            title="Void Payment Record"
            description="Are you sure you want to void this payment? This action will reverse the collection, restore the balance on the linked billing record, and permanently mark this transaction as voided in the financial ledger."
            confirmLabel="Confirm Void"
            isDanger
            isLoading={voidLoading}
            onConfirm={handleVoid}
            onCancel={() => !voidLoading && setIsVoiding(false)}
          >
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 block px-1">Reason for reversal</label>
              <input
                type="text"
                placeholder="e.g. Duplicate entry, wrong amount…"
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                className="w-full h-11 bg-stone-50 border border-stone-200 rounded-xl px-4 text-sm font-medium focus:ring-4 focus:ring-teal-500/5 focus:border-teal-500/50 outline-none transition-all"
                autoFocus
              />
            </div>
          </ConfirmationDialog>
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-1 space-y-6">
              <Card className="!p-0 overflow-hidden border-stone-200 rounded-2xl shadow-sm hs-glass-effect">
                <div className="border-b border-stone-100 bg-stone-50/50 px-6 py-4 flex items-center justify-between">
                  <p className="hs-strip-title uppercase tracking-widest text-[10px] font-black text-stone-400">Payment Summary</p>
                  <StatusBadge size="sm">{status}</StatusBadge>
                </div>
                <div className="p-8 space-y-6">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-2">Amount Paid</p>
                    <CurrencyDisplay 
                      amount={payment?.amount_paid} 
                      className={`text-4xl font-black ${status === 'voided' ? 'text-stone-300 line-through' : 'text-emerald-700'}`}
                    />
                  </div>
                  <div className="grid gap-4 pt-6 border-t border-stone-100">
                    <div className="flex items-center gap-3">
                      <Calendar size={14} className="text-stone-300" />
                      <span className="text-xs font-bold text-stone-600">{formatDateString(payment?.payment_date)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <CreditCard size={14} className="text-stone-300" />
                      <span className="text-xs font-bold text-stone-600">{methodLabel}</span>
                    </div>
                  </div>
                </div>
              </Card>
              <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm hs-glass-effect">
                <div className="border-b border-stone-100 bg-stone-50/50 px-6 py-4">
                  <h3 className="hs-strip-title text-stone-400 tracking-[0.2em] uppercase font-black text-[10px]">Audit Trail</h3>
                </div>
                <div className="p-6 space-y-5">
                  <MetricItem label="Payment Date">
                    {formatDateString(payment?.created_at)} · {new Date(payment?.created_at).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" })}
                  </MetricItem>
                  <MetricItem label="Staff Officer">
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
              <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm hs-glass-effect">
                <div className="border-b border-stone-100 bg-stone-50/50 px-8 py-5 flex items-center gap-3">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                    <User size={16} aria-hidden />
                  </div>
                  <h3 className="hs-strip-title text-stone-400 tracking-[0.2em] uppercase font-black text-[10px]">Tenant Details</h3>
                </div>
                <div className="grid gap-8 p-8 sm:grid-cols-2">
                  <div className="space-y-6">
                    <MetricItem label="Tenant Name">
                      <Link href={`/tenants/${tenant?.tenant_id}`} className="text-teal-700 hover:underline">{tenantName}</Link>
                    </MetricItem>
                    <MetricItem label="Tenant ID">
                      <ResourceIdCell id={tenant?.tenant_id} type="tenant" />
                    </MetricItem>
                  </div>
                  <div className="space-y-6">
                    <MetricItem label="Room / Bed Space">
                      Room {roomCode}{bedLabel && bedLabel !== "—" ? ` / ${bedLabel}` : ""}
                    </MetricItem>
                    <MetricItem label="Room Category">
                      {room?.room_type?.toUpperCase() || "N/A"}
                    </MetricItem>
                  </div>
                </div>
              </Card>
              <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm hs-glass-effect">
                <div className="border-b border-stone-100 bg-stone-50/50 px-8 py-5 flex items-center gap-3">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                    <Receipt size={16} aria-hidden />
                  </div>
                  <h3 className="hs-strip-title text-stone-400 tracking-[0.2em] uppercase font-black text-[10px]">Linked Billing</h3>
                </div>
                <div className="p-8 space-y-8">
                  <div className="grid gap-6 sm:grid-cols-2">
                    <div className="flex items-center gap-4 rounded-xl border border-stone-100 bg-stone-50/50 p-4">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm">
                        <RefreshCw size={18} className="text-stone-400" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Billing ID</p>
                        <div className="mt-1.5 flex items-center gap-2">
                          {payment?.billing_id ? (
                            <>
                              <ResourceIdCell id={payment?.billing_id} type="billing" />
                              <CorrelationIdCell value={payment?.billing?.correlation_id} className="opacity-60 scale-90" />
                            </>
                          ) : (
                            <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">N/A (Contract Direct)</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 rounded-xl border border-stone-100 bg-stone-50/50 p-4">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm">
                        <Receipt size={18} className="text-stone-400" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Payment Nature</p>
                        <p className="text-sm font-black text-stone-900 mt-0.5">
                          {payment?.billing_id ? "Rent Settlement" : (payment?.payment_category === 'deposit' ? "Security Deposit" : "Direct Contract Payment")}
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
      ) : !loading && !paymentError ? (
        <Alert variant="warning" title="Transaction Not Found">
          The requested payment record could not be found.
        </Alert>
      ) : null}
    </StandardPage>
  );
}
