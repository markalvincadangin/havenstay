"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { motion, useReducedMotion } from "framer-motion";
import {
  CheckCircle, Building2, ShieldCheck, Receipt, CreditCard
} from "lucide-react";

import ConfirmPaymentModal from "./ConfirmPaymentModal";

import { apiRequest, fetcher } from "@/lib/api";
import useSWR from "swr";
import { canManageBilling } from "@/lib/auth";
import { flattenApiErrors } from "@/lib/errors";
import { useAction } from "@/hooks/useAction";
import { applyServerFieldErrors } from "@/lib/forms";
import { formatPHP, formatDateRange } from "@/lib/formatters";
import { useUnsavedChangesWarning } from "@/hooks/useUnsavedChangesWarning";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import CurrencyDisplay from "@/components/ui/CurrencyDisplay";
import { Field, Input, Select, Textarea } from "@/components/ui/Fields";
import ResourceIdCell from "@/components/ui/ResourceIdCell";
import { FormSection } from "@/components/ui/FormSection";
import { useToasts } from "@/context/ToastContext";
import { useAuth } from "@/context/AuthContext";
import {
  METHOD_LABELS,
  PAYMENT_METHOD_KEYS,
  isBillingCollectibleStatus,
  isPaymentMethodCash,
} from "@/lib/constants";
import { normalizePaginatedList } from "@/lib/pagination";

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.2, ease: "easeOut" },
};

/** Billing summary — nested panel inside registry card. */
function BillingSummaryPanel({ selectedBilling, paymentAmount }) {
  if (!selectedBilling) return null;

  const currentBalance = Number(selectedBilling.balance || 0);
  const amount = Number(paymentAmount) || 0;
  const newBalance = currentBalance - amount;
  const isOverpayment = amount > currentBalance && currentBalance > 0;

  return (
    <div
      className="rounded-2xl border border-teal-600/10 bg-teal-50/30 p-6 hs-glass-effect"
      aria-label="Billing summary"
    >
      <div className="flex items-center gap-2 mb-4">
        <Building2 size={16} className="text-teal-700" />
        <p className="text-xs font-black uppercase tracking-widest text-teal-900">Account Summary</p>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between text-xs">
          <span className="font-bold uppercase tracking-widest text-stone-400">Current Balance</span>
          <CurrencyDisplay amount={currentBalance} className="font-bold text-stone-900" />
        </div>

        {amount > 0 && (
          <div className="mt-4 pt-4 border-t border-teal-600/10">
            <div className="flex justify-between items-baseline">
              <span className="text-[10px] font-black uppercase tracking-widest text-teal-700">Remaining Balance</span>
              <CurrencyDisplay
                amount={Math.abs(newBalance)}
                className={`text-xl font-bold ${isOverpayment ? "text-red-700" : newBalance === 0 ? "text-stone-800" : newBalance < 0 ? "text-emerald-700" : "text-teal-700"}`}
              />
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


/**
 * PaymentWizard — Single-page flow for recording payments.
 */
export default function PaymentWizard() {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const { showToast } = useToasts();
  const searchParams = useSearchParams();
  const shouldReduceMotion = useReducedMotion();
  const deepLinkApplied = useRef(false);

  const [billingOptions, setBillingOptions] = useState([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingValues, setPendingValues] = useState(null);

  // Refund Deep Link Support
  const [isRefundMode, setIsRefundMode] = useState(false);
  const [refundTargetContract, setRefundTargetContract] = useState(null);

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
      contract_id: "",
      amount_paid: "",
      payment_date: new Date().toISOString().slice(0, 10),
      payment_method: "cash",
      reference_number: "",
      remarks: "",
      payment_category: "billing",
    },
  });

  const selectedBillingId = watch("billing_id");
  const watchedAmount = watch("amount_paid");
  const watchedMethod = watch("payment_method");
  const watchedCategory = watch("payment_category");

  const isDepositMode = watchedCategory === "deposit";

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

  const { data: billingData, error: billingError } = useSWR(
    currentUser && canManageBilling(currentUser) ? "/api/billing?per_page=100" : null,
    fetcher,
    { fallbackData: { data: [], meta: { total: 0 } } }
  );

  const loading = !billingData && !billingError;

  // Refund/Deposit Target Context
  const contractId = watch("contract_id");
  const { data: contractData } = useSWR(
    (isRefundMode || isDepositMode) && Number(contractId) > 0 ? `/api/contracts/${contractId}` : null,
    fetcher
  );

  // Fetch pending contracts for the dropdown
  const { data: pendingContractsData } = useSWR(
    isDepositMode ? "/api/contracts?status=pending_payment&per_page=100" : null,
    fetcher
  );
  const pendingContracts = useMemo(() => normalizePaginatedList(pendingContractsData).rows, [pendingContractsData]);

  const residentName = useMemo(() => {
    if ((isRefundMode || isDepositMode) && contractData) {
      const t = contractData.data?.tenant || contractData.tenant;
      if (t) return `${t.last_name}, ${t.first_name}`.trim();
    }
    return selectedBilling?.tenant_name || "";
  }, [isRefundMode, isDepositMode, contractData, selectedBilling]);

  useEffect(() => {
    if (billingError) {
      showToast(flattenApiErrors(billingError) || "Failed to load billing records.", "error");
    }
  }, [billingError, showToast]);

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
        .filter((item) => item.balance > 0 || isBillingCollectibleStatus(item.status));
      setBillingOptions(options);
    }
  }, [billingData]);

  useEffect(() => {
    if (billingOptions.length === 0 || deepLinkApplied.current) return;
    const bId = searchParams.get("billing_id");
    const cId = searchParams.get("contract_id");
    const tId = searchParams.get("tenant_id");
    const category = searchParams.get("category");
    const amount = searchParams.get("amount");

    if (category === "refund" || category === "deposit") {
      setIsRefundMode(category === "refund");
      setValue("payment_category", category);
      if (amount) setValue("amount_paid", amount);
      if (cId) setValue("contract_id", cId);
    }

    if (bId) setValue("billing_id", bId);
    else if (cId && category !== "refund") {
      const matching = billingOptions.find((b) => String(b.contract_id) === String(cId));
      if (matching) setValue("billing_id", String(matching.billing_id));
      else if (category === "deposit") {
         // If it's a deposit deep link but no bill exists, we just set the contract_id
         setValue("contract_id", cId);
      }
    } else if (tId) {
      const matching = billingOptions.find((b) => String(b.tenant_id) === String(tId));
      if (matching) setValue("billing_id", String(matching.billing_id));
    }
    deepLinkApplied.current = true;
  }, [billingOptions, setValue, searchParams]);

  const { execute: submitPayment, isPending: isSubmitting } = useAction("/api/payments", {
    method: "POST",
    successMessage: "Payment recorded successfully.",
    onSuccess: (response) => {
      setShowConfirmModal(false);
      const updatedBillingId = response?.billing?.billing_id || response?.data?.billing?.billing_id;
      router.push(updatedBillingId ? `/billing/${updatedBillingId}` : '/payments');
    },
    onError: (err) => {
      setShowConfirmModal(false);
      applyServerFieldErrors(err, setError, { showToast });
    }
  });

  const onSubmit = (values) => {
    setPendingValues(values);
    setShowConfirmModal(true);
  };

  const handleConfirmedSubmit = async () => {
    if (!pendingValues || isSubmitting) return;
    const cat = pendingValues.payment_category || (isRefundMode ? "refund" : "billing");
    const isStandalone = cat === "refund" || cat === "deposit";

    try {
      await submitPayment({
        billing_id: isStandalone ? null : Number(pendingValues.billing_id),
        contract_id: isStandalone ? Number(pendingValues.contract_id) : null,
        amount_paid: Number(pendingValues.amount_paid),
        payment_date: pendingValues.payment_date,
        payment_method: pendingValues.payment_method,
        payment_category: cat,
        reference_number: isPaymentMethodCash(pendingValues.payment_method) ? null : pendingValues.reference_number || null,
        remarks: pendingValues.remarks || null,
      });
    } catch (error) { }
  };

  useUnsavedChangesWarning(isDirty && !isSubmitting);

  if (loading) return null;

  return (
    <div className="max-w-5xl mx-auto">
      {showConfirmModal && pendingValues && (selectedBilling || isRefundMode || isDepositMode) && (
        <ConfirmPaymentModal
          selectedBilling={selectedBilling}
          residentName={residentName}
          values={pendingValues}
          onConfirm={handleConfirmedSubmit}
          onCancel={() => setShowConfirmModal(false)}
          loading={isSubmitting}
          isRefundMode={isRefundMode}
          isDepositMode={isDepositMode}
        />
      )}

      {billingOptions.length === 0 && (
        <Alert variant="info" title="No Pending Receivables" className="mb-6 hs-glass-effect">
          There are currently no active bills or pending balances across the ledger.
        </Alert>
      )}

      <motion.div
        initial={shouldReduceMotion ? false : pageVariants.initial}
        animate={shouldReduceMotion ? false : pageVariants.animate}
        transition={shouldReduceMotion ? { duration: 0.2 } : pageVariants.transition}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-5">
            <div className="lg:col-span-3 space-y-6">
              <FormSection title="Transaction Context" icon={ShieldCheck} bodyClassName="p-8" className="hs-glass-effect">
                <Field label="Payment Category" required>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => {
                        setValue("payment_category", "billing");
                        setIsRefundMode(false);
                      }}
                      className={`flex flex-col items-start p-4 rounded-2xl border-2 transition-all ${watchedCategory === "billing" ? "border-teal-600 bg-teal-50/30" : "border-stone-100 bg-white hover:border-stone-200"}`}
                    >
                      <Receipt size={20} className={watchedCategory === "billing" ? "text-teal-600" : "text-stone-400"} />
                      <span className={`mt-2 text-xs font-black uppercase tracking-widest ${watchedCategory === "billing" ? "text-teal-900" : "text-stone-600"}`}>Rent / Utilities</span>
                      <span className="text-[10px] text-stone-500 font-medium">Standard monthly collection</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setValue("payment_category", "deposit");
                        setIsRefundMode(false);
                      }}
                      className={`flex flex-col items-start p-4 rounded-2xl border-2 transition-all ${watchedCategory === "deposit" ? "border-amber-600 bg-amber-50/30" : "border-stone-100 bg-white hover:border-stone-200"}`}
                    >
                      <ShieldCheck size={20} className={watchedCategory === "deposit" ? "text-amber-600" : "text-stone-400"} />
                      <span className={`mt-2 text-xs font-black uppercase tracking-widest ${watchedCategory === "deposit" ? "text-amber-900" : "text-stone-600"}`}>Security Deposit</span>
                      <span className="text-[10px] text-stone-500 font-medium">Initial lease collateral</span>
                    </button>
                  </div>
                </Field>
              </FormSection>

              <FormSection 
                title={isRefundMode ? "Refund Authorization" : isDepositMode ? "Deposit Registration" : "Payment Information"} 
                icon={isRefundMode || isDepositMode ? ShieldCheck : Receipt} 
                bodyClassName="space-y-6 p-8" 
                className="hs-glass-effect"
              >
                <Field label={isRefundMode || isDepositMode ? "Target Contract" : "Target Bill"} required error={errors.billing_id?.message || errors.contract_id?.message}>
                  {isRefundMode || isDepositMode ? (
                    <div className={`rounded-xl border p-4 flex flex-col gap-3 ${isDepositMode ? 'border-amber-200 bg-amber-50/50' : 'border-amber-200 bg-amber-50/50'}`}>
                       <div className="flex items-center justify-between">
                          <span className={`text-[10px] font-black uppercase tracking-widest ${isDepositMode ? 'text-amber-600' : 'text-amber-600'}`}>
                            {isDepositMode ? 'Deposit Target' : 'Refund Target'}
                          </span>
                          <ShieldCheck className="text-amber-600" size={20} />
                       </div>
                       
                       {/* Show editable dropdown/input if not provided via deep link, otherwise show read-only */}
                       {searchParams.get("contract_id") ? (
                          <div className="flex flex-col">
                             <span className="text-sm font-bold text-stone-900">Contract #{watch("contract_id")}</span>
                             <input type="hidden" {...register("contract_id", { required: "Contract ID is required." })} />
                          </div>
                       ) : isDepositMode ? (
                          <Select 
                            className="!h-11 border-amber-200 font-bold focus:ring-amber-500"
                            {...register("contract_id", { 
                              required: "Select a contract.",
                              onChange: (e) => {
                                const selected = pendingContracts.find(c => String(c.contract_id) === String(e.target.value));
                                if (selected) {
                                  setValue("amount_paid", selected.deposit_amount, { shouldDirty: true });
                                }
                              }
                            })}
                          >
                            <option value="">Select pending contract</option>
                            {pendingContracts.map(c => (
                              <option key={c.contract_id} value={c.contract_id}>
                                #{c.contract_id} · {c.tenant?.last_name}, {c.tenant?.first_name} · [{formatPHP(c.deposit_amount)}]
                              </option>
                            ))}
                          </Select>
                       ) : (
                          <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 font-bold">#</span>
                            <Input 
                              type="number" 
                              placeholder="Enter Contract ID" 
                              className="!pl-8 !h-11 border-amber-200 font-bold focus:ring-amber-500"
                              {...register("contract_id", { required: "Contract ID is required." })}
                            />
                          </div>
                       )}
                    </div>
                  ) : (
                    <Select hasError={Boolean(errors.billing_id)} className="!h-11 border-stone-200 font-bold" {...register("billing_id", { required: "Select an active ledger item." })}>
                      <option value="">Select ledger record</option>
                      {billingOptions.map((bill) => (
                        <option key={bill.billing_id} value={bill.billing_id}>
                          {bill.tenant_name} · #BILL-{String(bill.billing_id).padStart(6, '0')} · [{formatPHP(bill.balance)}]
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field label={isRefundMode ? "Refund Amount" : isDepositMode ? "Deposit Amount" : "Amount Paid"} required error={errors.amount_paid?.message}>
                  <Input type="number" step="0.01" prefix="₱" hasError={Boolean(errors.amount_paid)} className={`!h-12 border-stone-200 font-mono text-lg font-black tabular-nums ${isRefundMode || isDepositMode ? 'text-amber-700' : 'text-teal-700'}`} {...register("amount_paid", { required: "Required.", min: { value: 0.01, message: "Must be positive." } })} />
                </Field>
              </FormSection>

              <FormSection title="Transaction Details" icon={CreditCard} bodyClassName="space-y-6 p-8" className="hs-glass-effect">
                <div className="grid gap-6 sm:grid-cols-2">
                  <Field label="Payment Date" required error={errors.payment_date?.message}>
                    <Input type="date" className="!h-12 border-stone-200 font-bold" {...register("payment_date", { required: "Required." })} />
                  </Field>
                  <Field label="Method" required error={errors.payment_method?.message}>
                    <Select className="!h-12 border-stone-200 font-bold" {...register("payment_method", { required: "Required." })}>
                      {PAYMENT_METHOD_KEYS.map((key) => <option key={key} value={key}>{METHOD_LABELS[key]}</option>)}
                    </Select>
                  </Field>
                </div>
                <Field label="Reference No." required={!isPaymentMethodCash(watchedMethod)} error={errors.reference_number?.message}>
                  <Input
                    type="text"
                    placeholder={
                      isPaymentMethodCash(watchedMethod)
                        ? "Not required for cash"
                        : watchedMethod === "gcash"
                          ? "GCash Reference No. (e.g. 102938475)"
                          : watchedMethod === "bank_transfer"
                            ? "Bank Reference / Confirmation #"
                            : "Enter transaction reference number"
                    }
                    disabled={isPaymentMethodCash(watchedMethod)}
                    className="!h-12 border-stone-200 font-mono"
                    {...register("reference_number", { validate: (v) => isPaymentMethodCash(watchedMethod) || !!v || "Required." })}
                  />
                </Field>
                <Field label="Notes" error={errors.remarks?.message}>
                  <Textarea rows={3} className="border-stone-200" placeholder="Optional remarks..." {...register("remarks")} />
                </Field>
              </FormSection>
            </div>

            <div className="lg:col-span-2 space-y-6">
              <BillingSummaryPanel selectedBilling={selectedBilling} paymentAmount={watchedAmount} />

              <div className="rounded-2xl border border-stone-100 bg-stone-50 p-6 space-y-3">
                <div className="flex items-center gap-3 text-stone-400">
                  <ShieldCheck size={18} />
                  <p className="text-[10px] font-black uppercase tracking-widest">Policy Verification</p>
                </div>
                <p className="text-xs font-medium text-stone-500 leading-relaxed">
                  Collections are final and legally binding once recorded. Audit trails are maintained for all ledger mutations.
                </p>
              </div>

              <div className="flex flex-col gap-3 pt-6">
                <Button
                  type="submit"
                  variant={isRefundMode || isDepositMode ? "primary" : "primary"}
                  loading={isSubmitting}
                  className={`w-full !h-12 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl ${isRefundMode || isDepositMode ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-900/10' : 'shadow-teal-900/10'}`}
                >
                  {isRefundMode ? "Confirm Refund Disbursement" : isDepositMode ? "Confirm Deposit Receipt" : "Record Payment"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => router.push("/payments")}
                  className="w-full !h-10 text-[9px] font-bold text-stone-400 hover:text-stone-600"
                >
                  Cancel Transaction
                </Button>
              </div>
            </div>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
