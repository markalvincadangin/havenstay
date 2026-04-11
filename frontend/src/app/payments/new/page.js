"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, CheckCircle, CreditCard, Receipt } from "lucide-react";
import { apiRequest } from "../../../lib/api";
import { canManageBilling } from "../../../lib/auth";
import { useAuthGuard } from "../../../hooks/useAuthGuard";
import { flattenApiErrors } from "../../../lib/errors";
import { formatPHP, formatDateRange } from "../../../lib/formatters";
import { useUnsavedChangesWarning } from "../../../lib/useUnsavedChangesWarning";
import { useFocusTrap } from "../../../hooks/useFocusTrap";
import Alert from "../../_components/ui/Alert";
import { AppMain } from "../../_components/ui/AppShell";
import Breadcrumbs from "../../_components/ui/Breadcrumbs";
import Button from "../../_components/ui/Button";
import { Card } from "../../_components/ui/Card";
import { Field, Input, Select, Textarea } from "../../_components/ui/Fields";
import PageHeader from "../../_components/ui/PageHeader";
import Spinner from "../../_components/ui/Spinner";
import UserRoleBadge from "../../_components/ui/UserRoleBadge";

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.2, ease: "easeOut" },
};

/** Billing summary — nested panel inside registry card (MASTER §5.3 tone). */
function BillingSummaryPanel({ selectedBilling, paymentAmount }) {
  if (!selectedBilling) return null;

  const currentBalance = Number(selectedBilling.balance || 0);
  const amount = Number(paymentAmount) || 0;
  const newBalance = currentBalance - amount;
  const isOverpayment = amount > currentBalance && currentBalance > 0;

  return (
    <div
      className="rounded-xl border border-teal-600/10 bg-[var(--color-bg)] p-4"
      aria-label="Billing summary"
    >
      <p className="mb-3 text-sm font-semibold text-stone-900">Billing Summary</p>

      <div className="space-y-1">
        <div className="flex justify-between py-1.5 text-sm">
          <span className="text-stone-600">Total billed</span>
          <span className="font-mono font-medium tabular-nums text-stone-900">
            {formatPHP(selectedBilling.total_amount ?? 0)}
          </span>
        </div>
        <div className="flex justify-between py-1.5 text-sm">
          <span className="text-stone-600">Current balance</span>
          <span className="font-mono font-medium tabular-nums text-stone-900">{formatPHP(currentBalance)}</span>
        </div>
        {amount > 0 ? (
          <div className="mt-3 border-t-2 border-stone-200 pt-3 text-base font-semibold">
            <div className="flex justify-between">
              <span className="text-stone-600">Balance after payment</span>
              <span
                className={[
                  "font-mono tabular-nums",
                  isOverpayment ? "text-red-800" : newBalance <= 0 ? "text-emerald-800" : "text-teal-700",
                ].join(" ")}
              >
                {formatPHP(Math.max(newBalance, 0))}
              </span>
            </div>
          </div>
        ) : null}
      </div>

      {isOverpayment ? (
        <p className="mt-3 text-xs font-semibold text-red-800" role="alert">
          Payment amount exceeds the current balance. Please verify the amount.
        </p>
      ) : null}
    </div>
  );
}

function ConfirmPaymentModal({ selectedBilling, values, onConfirm, onCancel, loading }) {
  const modalRef = useFocusTrap(true);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && !loading) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [loading, onCancel]);

  const currentBalance = Number(selectedBilling?.balance || 0);
  const amount = Number(values?.amount_paid) || 0;
  const newBalance = Math.max(currentBalance - amount, 0);

  const methodLabels = {
    cash: "Cash",
    gcash: "GCash",
    bank_transfer: "Bank Transfer",
    other: "Other",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-payment-title"
    >
      <div
        ref={modalRef}
        className="mx-4 w-full max-w-[480px] rounded-2xl border border-stone-200 bg-white p-8 shadow-[0_20px_48px_rgba(0,0,0,0.18)]"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50">
            <CheckCircle className="h-5 w-5 text-emerald-800" aria-hidden="true" />
          </div>
          <div>
            <h3 id="confirm-payment-title" className="hs-strip-title text-base text-stone-900">
              Confirm Payment
            </h3>
            <p className="mt-0.5 text-sm text-stone-600">Review the payment details before posting.</p>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50/80 px-4 py-3">
          <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <span className="font-medium text-stone-800">Tenant</span>
            <span className="text-stone-900">{selectedBilling?.tenant_name || "—"}</span>

            <span className="font-medium text-stone-800">Billing period</span>
            <span className="text-stone-900">{selectedBilling?.period || "—"}</span>

            <span className="font-medium text-stone-800">Amount</span>
            <span className="font-mono font-semibold text-stone-900">{formatPHP(amount)}</span>

            <span className="font-medium text-stone-800">Method</span>
            <span className="text-stone-900">{methodLabels[values?.payment_method] || values?.payment_method}</span>

            <span className="font-medium text-stone-800">Balance before</span>
            <span className="font-mono text-stone-900">{formatPHP(currentBalance)}</span>

            <span className="font-medium text-stone-800">Balance after</span>
            <span className={`font-mono font-semibold ${newBalance === 0 ? "text-emerald-800" : "text-teal-700"}`}>
              {formatPHP(newBalance)}
            </span>
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={loading} className="!h-11">
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={onConfirm}
            loading={loading}
            className="!h-11 rounded-xl bg-teal-600 px-8 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-teal-900/10 hover:bg-teal-700"
          >
            Record payment
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function RecordPaymentPage() {
  const router = useRouter();
  const { user: currentUser, authLoading } = useAuthGuard();
  const shouldReduceMotion = useReducedMotion();
  const deepLinkApplied = useRef(false);

  const [apiError, setApiError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [billingOptions, setBillingOptions] = useState([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingValues, setPendingValues] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isDirty },
  } = useForm({
    defaultValues: {
      billing_id: "",
      amount_paid: "",
      payment_date: new Date().toLocaleDateString("en-CA"),
      payment_method: "cash",
      reference_number: "",
      remarks: "",
    },
  });

  const selectedBillingId = watch("billing_id");
  const watchedAmount = watch("amount_paid");
  const watchedMethod = watch("payment_method");

  const selectedBilling = useMemo(
    () => billingOptions.find((b) => String(b.billing_id) === String(selectedBillingId)) || null,
    [selectedBillingId, billingOptions],
  );

  const lastSelectedIdRef = useRef("");

  useEffect(() => {
    if (selectedBillingId && billingOptions.length > 0) {
      if (selectedBillingId !== lastSelectedIdRef.current) {
        const found = billingOptions.find((b) => String(b.billing_id) === String(selectedBillingId));
        if (found && found.balance > 0) {
          setValue("amount_paid", found.balance, { shouldDirty: true });
        }
        lastSelectedIdRef.current = selectedBillingId;
      }
    } else if (!selectedBillingId) {
      lastSelectedIdRef.current = "";
    }
  }, [selectedBillingId, billingOptions, setValue]);

  useUnsavedChangesWarning(isDirty && !isSubmitting);

  useEffect(() => {
    if (authLoading || !currentUser) return;

    let cancelled = false;
    (async () => {
      try {
        const billingData = await apiRequest("/api/billing", { method: "GET" }).catch(() => []);
        if (cancelled) return;
        const rows = Array.isArray(billingData) ? billingData : [];
        const options = rows
          .map((row) => {
            const amountDue = Number(row.amount_due || row.total_amount || 0);
            const amountPaid = Number(row.amount_paid || row.total_paid || 0);
            const balance = Number(row.balance ?? (amountDue - amountPaid));
            const tenant = row?.contract?.tenant;
            return {
              billing_id: row.billing_id,
              contract_id: row.contract_id,
              tenant_id: tenant?.tenant_id,
              status: row.status,
              tenant_name: tenant ? `${tenant.last_name || ""}, ${tenant.first_name || ""}`.trim() : "",
              period: formatDateRange(row.billing_period_from, row.billing_period_to),
              balance,
              total_amount: amountDue,
            };
          })
          .filter((item) => {
            // Balance covers past-due receivables (including partial+past due); do not key off status==="overdue" alone (BR-004 / billingReceivables).
            if (item.balance > 0) return true;
            return item.status === "unpaid" || item.status === "partial";
          });
        setBillingOptions(options);
      } catch (error) {
        if (!cancelled) setApiError(flattenApiErrors(error) || error.message || "Failed to load billing records.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, currentUser]);

  useEffect(() => {
    if (typeof window === "undefined" || billingOptions.length === 0 || deepLinkApplied.current) return;
    const params = new URLSearchParams(window.location.search);
    const billingId = params.get("billing_id");
    const contractId = params.get("contract_id");
    const tenantIdParam = params.get("tenant_id");

    if (billingId) {
      setValue("billing_id", billingId);
    } else if (contractId) {
      const matching = billingOptions.find((b) => String(b.contract_id) === String(contractId));
      if (matching) setValue("billing_id", String(matching.billing_id));
    } else if (tenantIdParam) {
      const matching = billingOptions.find((b) => String(b.tenant_id) === String(tenantIdParam));
      if (matching) setValue("billing_id", String(matching.billing_id));
    }
    deepLinkApplied.current = true;
  }, [billingOptions, setValue]);

  const onSubmit = (values) => {
    setApiError("");
    setSuccessMessage("");

    if (!canManageBilling(currentUser)) {
      setApiError("Unauthorized: only Admin or Staff can record payments.");
      return;
    }

    setPendingValues(values);
    setShowConfirmModal(true);
  };

  const handleConfirmedSubmit = async () => {
    if (!pendingValues) return;
    setIsSubmitting(true);
    setApiError("");

    try {
      const response = await apiRequest("/api/payments", {
        method: "POST",
        body: JSON.stringify({
          billing_id: Number(pendingValues.billing_id),
          amount_paid: Number(pendingValues.amount_paid),
          payment_date: pendingValues.payment_date,
          payment_method: pendingValues.payment_method,
          reference_number: pendingValues.payment_method === "cash" ? null : pendingValues.reference_number || null,
          remarks: pendingValues.remarks || null,
        }),
      });

      setShowConfirmModal(false);
      setSuccessMessage("Payment recorded successfully.");

      const updatedBillingId = response?.billing?.billing_id;
      if (updatedBillingId) {
        setTimeout(() => {
          router.push(`/billing/${updatedBillingId}`);
        }, 600);
      }
    } catch (error) {
      setShowConfirmModal(false);
      setApiError(flattenApiErrors(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <AppMain>
        <Spinner label="Loading…" />
      </AppMain>
    );
  }

  if (!canManageBilling(currentUser)) {
    return (
      <AppMain>
        <div className="mx-auto mt-8 w-full max-w-4xl space-y-6">
          <Alert variant="warning" title="View-only access">
            You do not have permission to record payments.
          </Alert>
          <Link
            href="/payments"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-stone-300 px-5 text-sm font-medium text-stone-800 hover:bg-stone-50"
          >
            Back to payments
          </Link>
        </div>
      </AppMain>
    );
  }

  if (loading) {
    return (
      <AppMain>
        <Spinner label="Loading billing records…" />
      </AppMain>
    );
  }

  return (
    <AppMain>
      {showConfirmModal && pendingValues && selectedBilling ? (
        <ConfirmPaymentModal
          selectedBilling={selectedBilling}
          values={pendingValues}
          onConfirm={handleConfirmedSubmit}
          onCancel={() => setShowConfirmModal(false)}
          loading={isSubmitting}
        />
      ) : null}

      <motion.div
        className="mx-auto mt-8 w-full max-w-4xl space-y-6"
        initial={shouldReduceMotion ? false : pageVariants.initial}
        animate={shouldReduceMotion ? false : pageVariants.animate}
        transition={shouldReduceMotion ? { duration: 0 } : pageVariants.transition}
      >
        <PageHeader
          title="Pay"
          subtitle="Apply a collection to an open billing cycle. Amounts update balances immediately."
          breadcrumbs={
            <Breadcrumbs items={[{ label: "Payments", href: "/payments" }, { label: "Pay" }]} />
          }
          actions={
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => router.push("/payments")}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-500 transition-colors hover:bg-stone-50"
                aria-label="Back to payments"
                title="Back to payments"
              >
                <ArrowLeft size={18} aria-hidden />
              </button>
              <div className="border-l border-stone-200 pl-3">
                <UserRoleBadge username={currentUser?.username} roleName={currentUser?.role?.role_name} />
              </div>
            </div>
          }
        />

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
          <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
            <div className="flex items-center gap-3 border-b border-stone-100 bg-stone-50/50 px-8 py-5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                <Receipt size={16} aria-hidden />
              </div>
              <div>
                <h2 className="hs-strip-title">Billing Selection</h2>
                <p className="mt-0.5 text-xs font-medium text-stone-500">Choose the open cycle this collection applies to.</p>
              </div>
            </div>
            <div className="space-y-6 p-8">
              <p className="text-xs font-medium text-stone-500">Fields marked * are required.</p>

              <Field label="Billing record" required error={errors.billing_id?.message}>
                <Select
                  autoFocus
                  hasError={Boolean(errors.billing_id)}
                  aria-describedby={errors.billing_id ? "billing_id-error" : undefined}
                  className="!h-11 border-stone-200"
                  {...register("billing_id", { required: "Billing record is required." })}
                >
                  <option value="">Select billing record</option>
                  {billingOptions.map((row) => (
                    <option key={row.billing_id} value={row.billing_id}>
                      Billing {row.billing_id}
                      {row.tenant_name ? ` — ${row.tenant_name}` : ""} | {row.period} | Balance {formatPHP(row.balance)}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Amount paid" required error={errors.amount_paid?.message}>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  hasError={Boolean(errors.amount_paid)}
                  className="!h-11 border-stone-200 font-mono tabular-nums"
                  aria-describedby={errors.amount_paid ? "amount_paid-error" : undefined}
                  {...register("amount_paid", {
                    required: "Payment amount is required.",
                    min: { value: 0.01, message: "Amount must be greater than zero." },
                    validate: (value) => {
                      const num = Number(value);
                      if (isNaN(num) || num <= 0) return "Amount must be a positive number.";
                      if (selectedBilling && num > selectedBilling.balance * 2) {
                        return "Payment exceeds safety limit (max 2× balance).";
                      }
                      return true;
                    },
                  })}
                />
              </Field>

              <BillingSummaryPanel selectedBilling={selectedBilling} paymentAmount={watchedAmount} />
            </div>
          </Card>

          <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
            <div className="flex items-center gap-3 border-b border-stone-100 bg-stone-50/50 px-8 py-5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                <CreditCard size={16} aria-hidden />
              </div>
              <div>
                <h2 className="hs-strip-title">Payment Entry</h2>
                <p className="mt-0.5 text-xs font-medium text-stone-500">Method, date, and optional reference for the ledger.</p>
              </div>
            </div>
            <div className="space-y-6 p-8">
              <Field label="Payment date" required error={errors.payment_date?.message}>
                <Input
                  type="date"
                  hasError={Boolean(errors.payment_date)}
                  className="!h-11 border-stone-200"
                  aria-describedby={errors.payment_date ? "payment_date-error" : undefined}
                  {...register("payment_date", {
                    required: "Payment date is required.",
                    validate: (value) => {
                      if (!value) return "Payment date is required.";
                      const date = new Date(value);
                      if (isNaN(date.getTime())) return "Invalid date format.";
                      const today = new Date();
                      today.setHours(23, 59, 59, 999);
                      if (date > today) return "Payment date cannot be in the future.";
                      return true;
                    },
                  })}
                />
              </Field>

              <Field label="Payment method" required error={errors.payment_method?.message}>
                <Select className="!h-11 border-stone-200" {...register("payment_method", { required: "Required." })}>
                  <option value="cash">Cash</option>
                  <option value="gcash">GCash</option>
                  <option value="bank_transfer">Bank transfer</option>
                  <option value="other">Other</option>
                </Select>
              </Field>

              <Field label="Reference number">
                <Input
                  type="text"
                  placeholder={watchedMethod === "cash" ? "Not required for cash" : "Transaction reference (required)"}
                  disabled={watchedMethod === "cash"}
                  className="!h-11 border-stone-200"
                  hasError={Boolean(errors.reference_number)}
                  {...register("reference_number", {
                    validate: (value) => {
                      if (watchedMethod !== "cash" && !value) {
                        return "Reference number is required for non-cash payments.";
                      }
                      return true;
                    },
                  })}
                />
              </Field>

              <Field label="Remarks" error={errors.remarks?.message}>
                <Textarea
                  rows={3}
                  className="border-stone-200"
                  {...register("remarks", {
                    maxLength: { value: 500, message: "Max 500 characters" },
                  })}
                />
              </Field>
            </div>
          </Card>

          {apiError ? (
            <Alert variant="error" title="Payment failed">
              {apiError}
            </Alert>
          ) : null}
          {successMessage ? (
            <Alert variant="success" title="Payment posted">
              {successMessage}
            </Alert>
          ) : null}

          <div className="flex flex-col-reverse gap-3 border-t border-stone-200 pt-6 sm:flex-row sm:items-center sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push("/payments")}
              className="!h-11 rounded-xl px-8 text-[10px] font-bold uppercase tracking-widest"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={isSubmitting}
              disabled={isSubmitting}
              className="!h-11 rounded-xl bg-teal-600 px-12 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-teal-900/10 hover:bg-teal-700"
            >
              Record payment
            </Button>
          </div>
        </form>
      </motion.div>
    </AppMain>
  );
}
