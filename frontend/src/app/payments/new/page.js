"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { motion, useReducedMotion } from "framer-motion";
import {
  CheckCircle, Building2, ShieldCheck, Receipt, CreditCard
} from "lucide-react";

import { apiRequest, fetcher } from "../../../lib/api";
import useSWR from "swr";
import { canManageBilling } from "../../../lib/auth";
import { useAuthGuard } from "../../../hooks/useAuthGuard";
import { flattenApiErrors } from "../../../lib/errors";
import { applyServerFieldErrors } from "../../../lib/forms";
import { formatPHP, formatDateRange } from "../../../lib/formatters";
import { useUnsavedChangesWarning } from "../../../lib/useUnsavedChangesWarning";
import { useFocusTrap } from "../../../hooks/useFocusTrap";
import Alert from "../../_components/ui/Alert";
import Breadcrumbs from "../../_components/ui/Breadcrumbs";
import Button from "../../_components/ui/Button";
import { Field, Input, Select, Textarea } from "../../_components/ui/Fields";
import {
  primaryLinkCtaClass,
  secondaryOutlineLinkClass,
} from "../../_components/ui/LinkTokens";
import Spinner from "../../_components/ui/Spinner";
import {
  METHOD_LABELS,
  PAYMENT_METHOD_KEYS,
  isBillingCollectibleStatus,
  isPaymentMethodCash,
} from "../../../lib/constants";
import { normalizePaginatedList } from "../../../lib/pagination";
import StandardPage from "../../_components/ui/StandardPage";
import PageHeaderActions from "../../_components/ui/PageHeaderActions";
import ResourceIdCell from "../../_components/ui/ResourceIdCell";
import SectionCard from "../../_components/ui/SectionCard";

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
      className="rounded-2xl border border-teal-600/10 bg-teal-50/30 p-6"
      aria-label="Billing summary"
    >
      <div className="flex items-center gap-2 mb-4">
         <Building2 size={16} className="text-teal-700" />
         <p className="text-xs font-black uppercase tracking-widest text-teal-900">Account Summary</p>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between text-xs">
          <span className="font-bold uppercase tracking-widest text-stone-400">Current Balance</span>
          <span className="font-mono font-black tabular-nums text-stone-900">
            {formatPHP(currentBalance)}
          </span>
        </div>
        
        {amount > 0 && (
          <div className="mt-4 pt-4 border-t border-teal-600/10">
            <div className="flex justify-between items-baseline">
              <span className="text-[10px] font-black uppercase tracking-widest text-teal-700">New Balance</span>
              <span
                className={[
                  "font-mono text-xl font-black tabular-nums",
                  isOverpayment ? "text-red-700" : newBalance <= 0 ? "text-emerald-700" : "text-teal-700",
                ].join(" ")}
              >
                {formatPHP(Math.max(newBalance, 0))}
              </span>
            </div>
            {isOverpayment && (
              <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-red-600" role="alert">
                Warning: Payment exceeds current receivable.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ConfirmPaymentModal({ selectedBilling, values, onConfirm, onCancel, loading }) {
  const modalRef = useFocusTrap(true);

  const currentBalance = Number(selectedBilling?.balance || 0);
  const amount = Number(values?.amount_paid) || 0;
  const newBalance = Math.max(currentBalance - amount, 0);

  const methodLabels = METHOD_LABELS;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-payment-title"
    >
      <div
        ref={modalRef}
        className="mx-4 w-full max-w-[480px] rounded-2xl border border-stone-200 bg-white p-8 shadow-[0_20px_48px_rgba(0,0,0,0.18)]"
      >
        <div className="flex items-start gap-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 shadow-sm">
            <CheckCircle size={22} aria-hidden />
          </div>
          <div>
            <h3 id="confirm-payment-title" className="hs-strip-title text-stone-900">
              Confirm Payment Posting
            </h3>
            <p className="mt-1 text-sm text-stone-500">This will post the collection to the billing ledger while preserving historical and audit records.</p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-stone-100 bg-stone-50/50 p-6">
          <div className="grid grid-cols-2 gap-y-4 text-xs">
            <div className="col-span-2">
              <p className="font-bold uppercase tracking-widest text-stone-400">Record</p>
              <div className="mt-1">
                <ResourceIdCell id={selectedBilling?.billing_id} prefix="BILL" />
              </div>
            </div>
            <div className="col-span-2">
              <p className="font-bold uppercase tracking-widest text-stone-400">Resident</p>
              <p className="mt-1 font-bold text-stone-900">{selectedBilling?.tenant_name || "—"}</p>
            </div>
            <div>
              <p className="font-bold uppercase tracking-widest text-stone-400">Total Amount</p>
              <p className="mt-1 font-mono font-black text-stone-900">{formatPHP(amount)}</p>
            </div>
            <div>
              <p className="font-bold uppercase tracking-widest text-stone-400">Gateway</p>
              <p className="mt-1 font-bold text-stone-900">{methodLabels[values?.payment_method] || values?.payment_method}</p>
            </div>
            <div className="col-span-2 border-t border-stone-100 pt-3">
              <div className="flex justify-between items-baseline">
                <p className="font-bold uppercase tracking-widest text-stone-400">Ledger Balance After</p>
                <p className={`font-mono font-black ${newBalance === 0 ? "text-emerald-700" : "text-teal-700"}`}>
                  {formatPHP(newBalance)}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={loading} className={secondaryOutlineLinkClass + " px-10"}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={onConfirm}
            loading={loading}
            className={primaryLinkCtaClass + " px-10 border-0"}
          >
            Record Payment
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function RecordPaymentPage() {
  const router = useRouter();
  const { user: currentUser, authLoading, isUnauthorized } = useAuthGuard();
  const shouldReduceMotion = useReducedMotion();
  const deepLinkApplied = useRef(false);

  const [apiError, setApiError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [billingOptions, setBillingOptions] = useState([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingValues, setPendingValues] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    clearErrors,
    setError,
    trigger,
    formState: { errors, isDirty },
  } = useForm({
    defaultValues: {
      billing_id: "",
      amount_paid: "",
      payment_date: new Date().toISOString().slice(0, 10),
      payment_method: "cash",
      reference_number: "",
      remarks: "",
    },
  });

  const selectedBillingId = watch("billing_id");
  const watchedAmount = watch("amount_paid");
  const watchedMethod = watch("payment_method");

  useEffect(() => {
    if (isPaymentMethodCash(watchedMethod)) {
      setValue("reference_number", "", { shouldDirty: false });
      clearErrors("reference_number");
    } else {
      void trigger("reference_number");
    }
  }, [watchedMethod, setValue, clearErrors, trigger]);

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

  const { data: billingData, error: billingError } = useSWR(
    !authLoading && currentUser && canManageBilling(currentUser) ? "/api/billing?per_page=100" : null,
    fetcher,
    { fallbackData: { data: [], meta: { total: 0 } } }
  );

  const loading = !billingData && !billingError && !authLoading && currentUser;

  useEffect(() => {
    if (billingError) {
      setApiError(flattenApiErrors(billingError) || billingError?.message || "Failed to load billing records.");
    }
  }, [billingError]);

  useEffect(() => {
    if (billingData) {
      const rows = normalizePaginatedList(billingData).rows;
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
          if (item.balance > 0) return true;
          return isBillingCollectibleStatus(item.status);
        });
      setBillingOptions(options);
    }
  }, [billingData]);

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
      setApiError("Administrative clearance required to post collections.");
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
          reference_number: isPaymentMethodCash(pendingValues.payment_method) ? null : pendingValues.reference_number || null,
          remarks: pendingValues.remarks || null,
        }),
      });
      setShowConfirmModal(false);
      setSuccessMessage("Collection posted to ledger.");
      const updatedBillingId = response?.billing?.billing_id;
      if (updatedBillingId) {
        setTimeout(() => {
          router.push(`/billing/${updatedBillingId}`);
        }, 600);
      }
    } catch (error) {
      setShowConfirmModal(false);
      applyServerFieldErrors(error, setError, { setApiError });
    } finally {
      setIsSubmitting(false);
    }
  };

  const pageTitle = "Record Payment";
  const pageSubtitle = "Record a payment against a billing cycle and update balances.";
  const pageBreadcrumbs = (
    <Breadcrumbs items={[{ label: "Payments", href: "/payments" }, { label: "Record Payment" }]} />
  );
  const pageActions = <PageHeaderActions backHref="/payments" backLabel="Back to Payments" user={currentUser} />;

  if (isUnauthorized) return null;
  if (authLoading || loading) {
    return (
      <StandardPage
        title={pageTitle}
        subtitle={pageSubtitle}
        loading
        skeleton={<Spinner label="Syncing billing data…" />}
      />
    );
  }

  if (!canManageBilling(currentUser)) {
    return (
      <StandardPage
        title={pageTitle}
        subtitle={pageSubtitle}
        breadcrumbs={pageBreadcrumbs}
        actions={pageActions}
      >
        <div className="mx-auto mt-8 w-full max-w-4xl space-y-6">
          <Alert variant="warning" title="Access restricted">
            Administrative clearance is required to post payments.
          </Alert>
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.push("/payments")}
            className="!h-11 rounded-xl px-8 text-[10px] font-bold uppercase tracking-widest"
          >
            Back to payments
          </Button>
        </div>
      </StandardPage>
    );
  }

  return (
    <StandardPage
      title={pageTitle}
      subtitle={pageSubtitle}
      breadcrumbs={pageBreadcrumbs}
      actions={pageActions}
    >
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
        transition={shouldReduceMotion ? { duration: 0.2 } : pageVariants.transition}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
          <div className="grid gap-6 lg:grid-cols-5">
            <div className="lg:col-span-3 space-y-6">
              <SectionCard
                title="Payment Information"
                icon={Receipt}
                iconClassName="bg-teal-50 text-teal-700"
                bodyClassName="space-y-6 p-8"
              >
                  <Field label="Billing Selection" required error={errors.billing_id?.message}>
                    <Select
                      autoFocus
                      hasError={Boolean(errors.billing_id)}
                      className="!h-12 border-stone-200 font-bold"
                      {...register("billing_id", { required: "Mandatory: Select target billing statement." })}
                    >
                      <option value="">Select Billing Target</option>
                      {billingOptions.map((row) => (
                        <option key={row.billing_id} value={row.billing_id}>
                          {row.tenant_name || "Unknown"} · #{row.billing_id} · [{formatPHP(row.balance)}]
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field label="Amount Paid" required error={errors.amount_paid?.message}>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      hasError={Boolean(errors.amount_paid)}
                      className="!h-12 border-stone-200 font-mono text-lg font-black tabular-nums text-teal-700"
                      {...register("amount_paid", {
                        required: "Mandatory: Enter collection amount.",
                        min: { value: 0.01, message: "Amount must be positive." },
                        validate: (value) => {
                          const num = Number(value);
                          if (selectedBilling && num > selectedBilling.balance * 2) {
                            return "Security: Payment exceeds safety limit (max 2× balance).";
                          }
                          return true;
                        },
                      })}
                    />
                  </Field>
              </SectionCard>

              <SectionCard
                title="Details"
                icon={CreditCard}
                iconClassName="bg-stone-50 text-stone-600"
                bodyClassName="space-y-6 p-8"
              >
                  <div className="grid gap-6 sm:grid-cols-2">
                    <Field label="Payment Date" required error={errors.payment_date?.message}>
                      <Input
                        type="date"
                        className="!h-12 border-stone-200 font-bold"
                        {...register("payment_date", {
                          required: "Mandatory: Date required.",
                          validate: (value) => {
                            const date = new Date(value);
                            const today = new Date();
                            today.setHours(23, 59, 59, 999);
                            if (date > today) return "Security: Future dates disallowed.";
                            return true;
                          },
                        })}
                      />
                    </Field>

                    <Field label="Payment Method" required error={errors.payment_method?.message}>
                      <Select className="!h-12 border-stone-200 font-bold uppercase tracking-widest text-[10px]" {...register("payment_method", { required: "Required." })}>
                        {PAYMENT_METHOD_KEYS.map((key) => (
                          <option key={key} value={key}>
                            {METHOD_LABELS[key]}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </div>

                  <Field
                    label="Reference No."
                    required={!isPaymentMethodCash(watchedMethod)}
                    error={errors.reference_number?.message}
                    helpText={
                      isPaymentMethodCash(watchedMethod)
                        ? "Not required for cash."
                        : "Required for GCash, bank transfer, and other methods."
                    }
                  >
                    <Input
                      type="text"
                      placeholder={isPaymentMethodCash(watchedMethod) ? "Not used for cash" : "Enter reference or transaction ID"}
                      disabled={isPaymentMethodCash(watchedMethod)}
                      hasError={Boolean(errors.reference_number)}
                      className="!h-12 border-stone-200 font-mono text-[10px]"
                      autoComplete="off"
                      {...register("reference_number", {
                        validate: (value) => {
                          if (isPaymentMethodCash(watchedMethod)) return true;
                          if (!String(value ?? "").trim()) {
                            return "Enter a reference number for this payment method.";
                          }
                          return true;
                        },
                      })}
                    />
                  </Field>

                  <Field label="Special Notes" error={errors.remarks?.message}>
                    <Textarea
                      rows={3}
                      className="border-stone-200 text-sm font-medium"
                      placeholder="Add payment notes (optional)…"
                      {...register("remarks", { maxLength: { value: 500, message: "Limit 500 chars." } })}
                    />
                  </Field>
              </SectionCard>
            </div>

            <div className="lg:col-span-2">
              <div className="space-y-6 lg:sticky lg:top-8 lg:self-start">
                <BillingSummaryPanel selectedBilling={selectedBilling} paymentAmount={watchedAmount} />

                <div className="rounded-2xl border border-stone-100 bg-stone-50 p-6 space-y-4">
                  <div className="flex items-center gap-3 text-stone-400">
                    <ShieldCheck size={20} />
                    <p className="text-[10px] font-black uppercase tracking-widest">Important Notes</p>
                  </div>
                  <p className="text-xs font-medium leading-relaxed text-stone-500">
                    Postings to the authoritative ledger are permanent. Voids are only permitted for administrative errors and are subject to audit logs.
                  </p>
                </div>

                {apiError ? (
                  <Alert variant="error" title="Post Failed">
                    {apiError}
                  </Alert>
                ) : null}
                {successMessage ? (
                  <Alert variant="success" title="Posted Success">
                    {successMessage}
                  </Alert>
                ) : null}

                <div className="flex flex-col-reverse gap-3 border-t border-stone-100 pt-8 sm:flex-row sm:items-center sm:justify-end">
                  <Link
                    href="/payments"
                    className={secondaryOutlineLinkClass + " px-10"}
                  >
                    Cancel
                  </Link>
                  <Button
                    type="submit"
                    variant="primary"
                    loading={isSubmitting}
                    className={primaryLinkCtaClass + " px-12 border-0"}
                  >
                    Record Payment
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </form>
      </motion.div>
    </StandardPage>
  );
}
