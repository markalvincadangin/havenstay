"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, Calendar, CreditCard, FileText, Receipt } from "lucide-react";
import { apiRequest } from "../../../lib/api";
import { canManageBilling, canViewBilling } from "../../../lib/auth";
import { flattenApiErrors } from "../../../lib/errors";
import { useAuthGuard } from "../../../hooks/useAuthGuard";
import { formatDateString, formatPHP } from "../../../lib/formatters";
import { SkeletonDetailPage } from "../../_components/ui/Skeleton";
import Alert from "../../_components/ui/Alert";
import { AppMain } from "../../_components/ui/AppShell";
import Breadcrumbs from "../../_components/ui/Breadcrumbs";
import Button from "../../_components/ui/Button";
import { Card } from "../../_components/ui/Card";
import PageHeader from "../../_components/ui/PageHeader";
import UserRoleBadge from "../../_components/ui/UserRoleBadge";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { Table } from "../../_components/ui/Table";

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.2, ease: "easeOut" },
};

function SummaryField({ label, children }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-[10px] font-bold uppercase tracking-widest text-stone-400">{label}</div>
      <div className="text-sm font-semibold text-stone-900">{children ?? "—"}</div>
    </div>
  );
}

function FinancialRow({ label, value, valueClass = "", isTotal = false }) {
  return (
    <div
      className={`flex items-center justify-between py-2.5 text-sm ${
        isTotal ? "mt-1 border-t-2 border-stone-200 pt-3 text-base font-bold" : "border-b border-stone-50 last:border-0"
      }`}
    >
      <span className="font-medium text-stone-500">{label}</span>
      <span className={`font-mono tabular-nums font-semibold text-stone-900 ${valueClass}`}>{value}</span>
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
        setApiError("You do not have permission to view billing.");
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
  const tenantName = tenant ? `${tenant.first_name} ${tenant.last_name}`.trim() : null;
  const room = billing?.contract?.room;
  const roomCode = room?.room_code ? `Room ${room.room_code}` : "—";
  const roomId = room?.room_id;
  const totalAmount = Number(billing?.total_amount || 0);
  const totalPaid = Number(billing?.total_paid || 0);
  const balance = Number(billing?.balance || 0);
  const lineItems = billing?.line_items || [];

  const renderBalance = () => {
    if (balance < 0) {
      return (
        <span className="inline-flex items-center gap-2 font-mono tabular-nums text-emerald-800">
          <span>{formatPHP(Math.abs(balance))}</span>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800">
            Credit
          </span>
        </span>
      );
    }
    if (balance === 0) {
      return <span className="font-mono tabular-nums text-stone-500">{formatPHP(0)}</span>;
    }
    return <span className="font-mono tabular-nums font-bold text-teal-700">{formatPHP(balance)}</span>;
  };

  const payments = billing?.payments || [];

  return (
    <AppMain>
      <motion.div
        className="mx-auto mt-8 w-full max-w-4xl space-y-6"
        initial={shouldReduceMotion ? false : pageVariants.initial}
        animate={shouldReduceMotion ? false : pageVariants.animate}
        transition={shouldReduceMotion ? { duration: 0 } : pageVariants.transition}
      >
        <PageHeader
          title={`Billing #${billingId || ""}`}
          subtitle="Line items, payments, and status for this billing cycle."
          breadcrumbs={
            <Breadcrumbs items={[{ label: "Billing", href: "/billing" }, { label: `Billing #${billingId || ""}` }]} />
          }
          actions={
            <div className="flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => router.push("/billing")}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-500 transition-colors hover:bg-stone-50"
                aria-label="Back to billing"
                title="Back to billing"
              >
                <ArrowLeft size={18} aria-hidden />
              </button>
              {canPostPayments && billing && balance > 0 ? (
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => router.push(`/payments/new?billing_id=${billing.billing_id}`)}
                  className="!h-11 rounded-xl bg-teal-600 px-6 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-teal-900/10 hover:bg-teal-700"
                >
                  Pay
                </Button>
              ) : null}
              <div className="border-l border-stone-200 pl-3">
                <UserRoleBadge username={currentUser?.username} roleName={currentUser?.role?.role_name} />
              </div>
            </div>
          }
        />

        {apiError ? (
          <Alert variant="error" title="Could not load billing">
            {apiError}
          </Alert>
        ) : null}

        {!billing && !apiError ? (
          <Alert variant="warning" title="No billing record">
            The requested billing record was not found.
          </Alert>
        ) : null}

        {billing ? (
          <>
            <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
              <div className="flex items-center gap-3 border-b border-stone-100 bg-stone-50/50 px-8 py-5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                  <Receipt size={16} aria-hidden />
                </div>
                <h2 className="hs-strip-title">Cycle Overview</h2>
              </div>
              <div className="space-y-6 p-8">
                <div className="grid gap-6 sm:grid-cols-2">
                  <SummaryField label="Billing ID">
                    <span className="font-mono text-stone-700">#{billing.billing_id}</span>
                  </SummaryField>
                  <SummaryField label="Status">
                    <StatusBadge>{billing.status}</StatusBadge>
                  </SummaryField>
                  <SummaryField label="Tenant">
                    {tenant?.tenant_id ? (
                      <Link href={`/tenants/${tenant.tenant_id}`} className="text-teal-700 underline decoration-teal-700/30 hover:decoration-teal-700">
                        {tenantName || "—"}
                      </Link>
                    ) : (
                      tenantName || "—"
                    )}
                  </SummaryField>
                  <SummaryField label="Room">
                    {roomId ? (
                      <Link href={`/rooms/${roomId}`} className="text-teal-700 underline decoration-teal-700/30 hover:decoration-teal-700">
                        {roomCode}
                      </Link>
                    ) : (
                      roomCode
                    )}
                  </SummaryField>
                  <SummaryField label="Billing period">
                    <span className="inline-flex items-center gap-2 text-stone-700">
                      <Calendar className="h-3.5 w-3.5 text-stone-400" aria-hidden />
                      {formatDateString(billing.billing_period_from)} – {formatDateString(billing.billing_period_to)}
                    </span>
                  </SummaryField>
                  <SummaryField label="Due date">{formatDateString(billing.due_date)}</SummaryField>
                </div>

                <div className="rounded-xl border border-stone-100 bg-stone-50/50 px-5 py-4">
                  <FinancialRow label="Total amount" value={formatPHP(totalAmount)} />
                  <FinancialRow label="Amount paid" value={formatPHP(totalPaid)} valueClass="text-emerald-800" />
                  <FinancialRow label="Balance" value={renderBalance()} isTotal />
                </div>
              </div>
            </Card>

            <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
              <div className="flex items-center gap-3 border-b border-stone-100 bg-stone-50/50 px-8 py-5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                  <FileText size={16} aria-hidden />
                </div>
                <h2 className="hs-strip-title">Line Items</h2>
              </div>
              <div className="p-0">
                <Table
                  embedded
                  caption={`Line items for billing #${billingId}`}
                  columns={[
                    { key: "desc", label: "Description" },
                    { key: "amount", label: "Amount", className: "text-right" },
                  ]}
                  rows={lineItems.map((item) => (
                    <tr
                      key={item.billing_line_item_id}
                      className="border-t border-stone-100 transition-colors hover:bg-stone-50"
                    >
                      <td className="px-6 py-4 text-sm text-stone-900">
                        {item.item_description || item.description || "—"}
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-sm tabular-nums text-stone-900">
                        {formatPHP(item.amount)}
                      </td>
                    </tr>
                  ))}
                  emptyTitle="No line items"
                  emptyDescription="This billing record has no line items yet."
                />
                {lineItems.length > 0 ? (
                  <div className="flex items-center justify-between border-t-2 border-stone-200 bg-stone-50/80 px-6 py-4">
                    <span className="text-sm font-bold text-stone-900">Total</span>
                    <span className="font-mono text-base font-bold text-teal-800">{formatPHP(totalAmount)}</span>
                  </div>
                ) : null}
              </div>
            </Card>

            <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
              <div className="flex items-center gap-3 border-b border-stone-100 bg-stone-50/50 px-8 py-5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                  <CreditCard size={16} aria-hidden />
                </div>
                <h2 className="hs-strip-title">Payment History</h2>
              </div>
              <div className="p-0">
                <Table
                  embedded
                  caption={`Payment history for billing #${billingId}`}
                  columns={[
                    { key: "date", label: "Payment date" },
                    { key: "amount", label: "Amount", className: "text-right" },
                    { key: "ref", label: "Reference" },
                    { key: "status", label: "Status" },
                    { key: "actions", label: "" },
                  ]}
                  rows={payments.map((payment) => (
                    <tr
                      key={payment.payment_id}
                      className="border-t border-stone-100 transition-colors hover:bg-stone-50"
                    >
                      <td className="px-6 py-4 text-sm text-stone-900">
                        {formatDateString(payment.payment_date)}
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-sm tabular-nums text-emerald-800">
                        {formatPHP(payment.amount_paid)}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-stone-500">
                        {payment.reference_number || payment.payment_reference_number || "—"}
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge>{payment.status || "posted"}</StatusBadge>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/payments/${payment.payment_id}`}
                          className="text-xs font-bold uppercase tracking-wide text-teal-700 hover:underline"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                  emptyTitle="No payments recorded"
                  emptyDescription={
                    canPostPayments
                      ? "Post a payment to reduce the balance for this cycle."
                      : "Viewer role cannot record payments."
                  }
                />
                {payments.length === 0 && canPostPayments && balance > 0 ? (
                  <div className="border-t border-stone-100 px-6 py-5 text-center">
                    <Button
                      type="button"
                      variant="primary"
                      onClick={() => router.push(`/payments/new?billing_id=${billing.billing_id}`)}
                      className="!h-11 rounded-xl bg-teal-600 px-8 text-[10px] font-black uppercase tracking-widest"
                    >
                      Pay
                    </Button>
                  </div>
                ) : null}
              </div>
            </Card>

            {!canPostPayments ? (
              <Alert variant="info" title="Read-only mode">
                Viewer accounts can review this billing record but cannot record payments.
              </Alert>
            ) : null}
          </>
        ) : null}
      </motion.div>
    </AppMain>
  );
}
