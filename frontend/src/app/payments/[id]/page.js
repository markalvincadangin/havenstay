"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  Building2,
  Calendar,
  CreditCard,
  FileText,
  Printer,
  Receipt,
  User,
} from "lucide-react";
import { apiRequest } from "../../../lib/api";
import { canViewBilling } from "../../../lib/auth";
import { flattenApiErrors } from "../../../lib/errors";
import { useAuthGuard } from "../../../hooks/useAuthGuard";
import { formatDateRange, formatDateString, formatPHP } from "../../../lib/formatters";
import { SkeletonDetailPage } from "../../_components/ui/Skeleton";
import Alert from "../../_components/ui/Alert";
import { AppMain } from "../../_components/ui/AppShell";
import Breadcrumbs from "../../_components/ui/Breadcrumbs";
import Button from "../../_components/ui/Button";
import { Card } from "../../_components/ui/Card";
import PageHeader from "../../_components/ui/PageHeader";
import UserRoleBadge from "../../_components/ui/UserRoleBadge";
import { StatusBadge } from "../../../components/ui/StatusBadge";

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.2, ease: "easeOut" },
};

const METHOD_LABELS = {
  cash: "Cash",
  gcash: "GCash",
  bank_transfer: "Bank transfer",
  other: "Other",
};

function paymentStatus(p) {
  return p?.voided_at ? "voided" : "posted";
}

function processorLabel(payment) {
  const u = payment?.processor;
  if (!u) return "—";
  const name = [u.first_name, u.last_name].filter(Boolean).join(" ").trim();
  return name || u.username || "—";
}

function SummaryField({ label, children }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-[10px] font-bold uppercase tracking-widest text-stone-400">{label}</div>
      <div className="text-sm font-semibold text-stone-900">{children ?? "—"}</div>
    </div>
  );
}

export default function PaymentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const paymentId = params?.id;
  const shouldReduceMotion = useReducedMotion();

  const { user: currentUser, authLoading } = useAuthGuard();
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState("");

  const loadPayment = useCallback(async () => {
    const data = await apiRequest(`/api/payments/${paymentId}`, { method: "GET" });
    setPayment(data);
  }, [paymentId]);

  useEffect(() => {
    if (authLoading || !currentUser || !paymentId) return;

    if (!canViewBilling(currentUser)) {
      setApiError("You do not have permission to view payment details.");
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        await loadPayment();
      } catch (error) {
        if (!cancelled) setApiError(flattenApiErrors(error));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, currentUser, paymentId, loadPayment]);

  if (authLoading || loading) {
    return (
      <AppMain>
        <SkeletonDetailPage />
      </AppMain>
    );
  }

  if (apiError && !payment) {
    return (
      <AppMain>
        <div className="mx-auto mt-8 w-full max-w-4xl space-y-6">
          <Alert variant="error" title="Could not load payment">{apiError}</Alert>
          <Button type="button" variant="secondary" onClick={() => router.push("/payments")} className="!h-11">
            <ArrowLeft size={16} className="mr-2 shrink-0" aria-hidden />
            Back to payments
          </Button>
        </div>
      </AppMain>
    );
  }

  if (!payment) {
    return (
      <AppMain>
        <div className="mx-auto mt-8 w-full max-w-4xl space-y-6">
          <Alert variant="warning" title="Payment not found">
            The requested payment record could not be found.
          </Alert>
          <Button type="button" variant="secondary" onClick={() => router.push("/payments")} className="!h-11">
            <ArrowLeft size={16} className="mr-2 shrink-0" aria-hidden />
            Back to payments
          </Button>
        </div>
      </AppMain>
    );
  }

  const tenant = payment.billing?.contract?.tenant;
  const tenantName = tenant ? `${tenant.first_name} ${tenant.last_name}`.trim() : null;
  const room = payment.billing?.contract?.room;
  const roomCode = room?.room_code || "—";
  const roomId = room?.room_id;
  const bedLabel = payment.billing?.contract?.bed_space?.bed_label;
  const status = paymentStatus(payment);
  const methodKey = String(payment.payment_method || "").toLowerCase();
  const methodLabel = METHOD_LABELS[methodKey] || payment.payment_method || "—";

  return (
    <AppMain>
      <motion.div
        className="mx-auto mt-8 w-full max-w-4xl space-y-6"
        initial={shouldReduceMotion ? false : pageVariants.initial}
        animate={shouldReduceMotion ? false : pageVariants.animate}
        transition={shouldReduceMotion ? { duration: 0 } : pageVariants.transition}
      >
        <PageHeader
          title={`Payment #${paymentId}`}
          subtitle="Official receipt context—allocation, billing cycle, and posting metadata."
          breadcrumbs={
            <Breadcrumbs
              items={[{ label: "Payments", href: "/payments" }, { label: `Payment #${paymentId}` }]}
            />
          }
          actions={
            <div className="flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => router.push("/payments")}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-500 transition-colors hover:bg-stone-50 print:hidden"
                aria-label="Back to payments"
                title="Back to payments"
              >
                <ArrowLeft size={18} aria-hidden />
              </button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => window.print()}
                className="!h-11 print:hidden"
              >
                <Printer size={16} className="mr-2 shrink-0" aria-hidden />
                Print receipt
              </Button>
              <div className="border-l border-stone-200 pl-3">
                <UserRoleBadge username={currentUser?.username} roleName={currentUser?.role?.role_name} />
              </div>
            </div>
          }
        />

        {status === "voided" ? (
          <Alert variant="warning" title="Voided payment">
            This payment was voided. Amounts no longer count toward the billing balance.
          </Alert>
        ) : null}

        <Card className="relative !p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm print:shadow-none">
          {status === "voided" ? (
            <div
              className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center"
              aria-hidden
            >
              <span className="rotate-[-12deg] select-none rounded-2xl border-4 border-red-200/80 bg-red-50/40 px-6 py-3 text-2xl font-black uppercase tracking-[0.2em] text-red-700/35">
                Voided
              </span>
            </div>
          ) : null}

          <div className="relative border-b border-stone-100 bg-stone-50/50 px-8 py-6">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-white shadow-sm">
                  <Receipt size={22} aria-hidden />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Reference</p>
                  <p className="font-mono text-lg font-bold text-stone-900">
                    PAY-{String(payment.payment_id).padStart(6, "0")}
                  </p>
                  <div className="mt-2">
                    <StatusBadge>{status}</StatusBadge>
                  </div>
                </div>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Amount paid</p>
                <p className="font-mono text-3xl font-bold tabular-nums text-teal-700">
                  {formatPHP(payment.amount_paid)}
                </p>
              </div>
            </div>
          </div>

          <div className="relative grid gap-8 p-8 sm:grid-cols-2">
            <div className="space-y-6">
              <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
                <CreditCard className="h-4 w-4 text-stone-400" aria-hidden />
                <h3 className="text-xs font-bold uppercase tracking-widest text-stone-400">Payment method</h3>
              </div>
              <div className="rounded-xl border border-stone-200 bg-stone-50/50 px-4 py-3">
                <p className="text-sm font-bold text-stone-900">{methodLabel}</p>
                {payment.reference_number ? (
                  <p className="mt-1 font-mono text-xs text-stone-500">Ref: {payment.reference_number}</p>
                ) : (
                  <p className="mt-1 text-xs text-stone-500">No reference recorded.</p>
                )}
              </div>

              <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
                <Calendar className="h-4 w-4 text-stone-400" aria-hidden />
                <h3 className="text-xs font-bold uppercase tracking-widest text-stone-400">Payment date</h3>
              </div>
              <p className="text-sm font-semibold text-stone-900">{formatDateString(payment.payment_date)}</p>
              {payment.created_at ? (
                <p className="text-[10px] font-medium uppercase tracking-wide text-stone-400">
                  Logged {formatDateString(payment.created_at)}{" "}
                  {new Date(payment.created_at).toLocaleTimeString("en-PH", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              ) : null}

              {payment.remarks ? (
                <>
                  <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
                    <FileText className="h-4 w-4 text-stone-400" aria-hidden />
                    <h3 className="text-xs font-bold uppercase tracking-widest text-stone-400">Remarks</h3>
                  </div>
                  <p className="text-sm leading-relaxed text-stone-600">{payment.remarks}</p>
                </>
              ) : null}
            </div>

            <div className="space-y-6">
              <Card className="!p-0 overflow-hidden rounded-xl border-stone-200 shadow-none">
                <div className="flex items-center gap-2 border-b border-stone-100 bg-stone-50/50 px-5 py-3">
                  <User className="h-4 w-4 text-teal-700" aria-hidden />
                  <h3 className="hs-strip-title text-sm">Tenant</h3>
                </div>
                <div className="space-y-4 p-5">
                  <SummaryField label="Name">
                    {tenant?.tenant_id ? (
                      <Link
                        href={`/tenants/${tenant.tenant_id}`}
                        className="text-teal-700 underline decoration-teal-700/30 hover:decoration-teal-700"
                      >
                        {tenantName || "—"}
                      </Link>
                    ) : (
                      tenantName || "—"
                    )}
                  </SummaryField>
                  <SummaryField label="Contact">
                    {tenant?.email || tenant?.contact_number || "—"}
                  </SummaryField>
                </div>
              </Card>

              <Card className="!p-0 overflow-hidden rounded-xl border-stone-200 shadow-none">
                <div className="flex items-center gap-2 border-b border-stone-100 bg-stone-50/50 px-5 py-3">
                  <Building2 className="h-4 w-4 text-teal-700" aria-hidden />
                  <h3 className="hs-strip-title text-sm">Room & bed</h3>
                </div>
                <div className="p-5">
                  <SummaryField label="Room">
                    {roomId ? (
                      <Link
                        href={`/rooms/${roomId}`}
                        className="text-teal-700 underline decoration-teal-700/30 hover:decoration-teal-700"
                      >
                        {roomCode}
                      </Link>
                    ) : (
                      roomCode
                    )}
                  </SummaryField>
                  <div className="mt-4">
                    <SummaryField label="Bed space">{bedLabel || "—"}</SummaryField>
                  </div>
                </div>
              </Card>

              <Card className="!p-0 overflow-hidden rounded-xl border-stone-200 shadow-none">
                <div className="flex items-center gap-2 border-b border-stone-100 bg-stone-50/50 px-5 py-3">
                  <Receipt className="h-4 w-4 text-teal-700" aria-hidden />
                  <h3 className="hs-strip-title text-sm">Applied to billing</h3>
                </div>
                <div className="p-5">
                  <Link
                    href={`/billing/${payment.billing_id}`}
                    className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2 text-xs font-bold text-teal-800 shadow-sm transition-colors hover:bg-stone-50"
                  >
                    Billing #{payment.billing_id}
                    <span className="text-stone-300" aria-hidden>
                      →
                    </span>
                  </Link>
                  <p className="mt-3 text-xs font-medium text-stone-500">
                    Period:{" "}
                    {formatDateRange(
                      payment.billing?.billing_period_from,
                      payment.billing?.billing_period_to,
                    )}
                  </p>
                </div>
              </Card>
            </div>
          </div>

          <div className="relative flex flex-col gap-2 border-t border-stone-100 bg-stone-50/50 px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-stone-400 sm:flex-row sm:items-center sm:justify-between">
            <span>Processed by {processorLabel(payment)}</span>
            <span className="text-stone-300">HavenStay</span>
          </div>
        </Card>

        <div className="flex flex-col-reverse gap-3 print:hidden sm:flex-row sm:justify-center">
          <Button type="button" variant="secondary" onClick={() => router.push("/payments")} className="!h-11">
            Back to payments
          </Button>
          <Button type="button" variant="secondary" onClick={() => router.push(`/billing/${payment.billing_id}`)} className="!h-11">
            View billing
          </Button>
        </div>
      </motion.div>
    </AppMain>
  );
}
