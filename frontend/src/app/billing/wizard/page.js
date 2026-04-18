"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { 
  Calendar, 
  FileText, 
  Wallet, 
  ShieldCheck, 
  TrendingUp, 
  Plus, 
  Trash2, 
  ArrowRight,
  Calculator,
  AlertCircle
} from "lucide-react";

import { apiRequest } from "../../../lib/api";
import { canManageBilling } from "../../../lib/auth";
import { applyServerFieldErrors } from "../../../lib/forms";
import { formatPHP, formatDateString, formatTenantFullName } from "../../../lib/formatters";
import { useUnsavedChangesWarning } from "../../../hooks/useUnsavedChangesWarning";
import Alert from "../../_components/ui/Alert";
import Button from "../../_components/ui/Button";
import { Field, Input, Select } from "../../_components/ui/Fields";
import Breadcrumbs from "../../_components/ui/Breadcrumbs";
import { normalizePaginatedList } from "../../../lib/pagination";
import StandardPage from "../../_components/ui/StandardPage";
import ConfirmationDialog from "../../_components/ui/ConfirmationDialog";
import { FormSection } from "../../_components/ui/FormSection";
import { useAuth } from "../../_context/AuthContext";
import PageHeaderActions from "../../_components/ui/PageHeaderActions";
import { StatusBadge } from "../../_components/ui/StatusBadge";
import { Card } from "../../_components/ui/Card";
import StepIndicator from "../../_components/ui/StepIndicator";



function contractDisplayLabel(c) {
  const tenant = formatTenantFullName(c.tenant);
  const room = c.room?.room_code ?? c.room_id ?? "—";
  const bedLabel = c.bed_space?.bed_label || c.bedSpace?.bed_label || "";
  const start = formatDateString(c.move_in_date);
  return `${tenant} — Room ${room}${bedLabel ? ` / ${bedLabel}` : ""} (Start: ${start})`;
}

export default function BillingWizardPage() {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const [activeContracts, setActiveContracts] = useState([]);
  const [loadingContracts, setLoadingContracts] = useState(true);
  const [contractsError, setContractsError] = useState("");
  const [apiError, setApiError] = useState("");
  const [step, setStep] = useState(1);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isFinalIZING, setIsFinalIZING] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({
    defaultValues: {
      contract_id: "",
      billing_period_from: "",
      billing_period_to: "",
      due_date: "",
      base_rent_amount: 0,
      include_base_rent: true,
      utility_amount: 0,
      add_on_amount: 0,
      penalty_amount: 0,
      adjustment_amount: 0,
      reading_ids: [],
    },
  });

  useUnsavedChangesWarning(isDirty && !isSubmitting);

  const watchAll = watch();
  const includeBaseRent = watch("include_base_rent");
  const baseRentAmount = Number(watch("base_rent_amount") || 0);
  const watchedReadingIds = watch("reading_ids") || [];

  const selectedContractId = watch("contract_id");
  const activeContract = useMemo(() => {
    return activeContracts.find(c => String(c.contract_id) === String(selectedContractId));
  }, [selectedContractId, activeContracts]);

  const unbilledReadings = activeContract?.unbilled_readings || [];
  const activeAddOns = activeContract?.add_ons || activeContract?.contract_add_ons || [];

  const utilityAmount = useMemo(() => {
     return unbilledReadings
       .filter((r) => watchedReadingIds.map(String).includes(String(r.reading_id)))
       .reduce((sum, r) => sum + Number(r.calculated_amount || 0), 0);
  }, [unbilledReadings, watchedReadingIds]);

  const addOnAmount = useMemo(() => {
     return activeAddOns.reduce((sum, a) => sum + Number(a.rate || a.monthly_rate || 0), 0);
  }, [activeAddOns]);

  const penaltyAmount = Number(watch("penalty_amount") || 0);
  const adjustmentAmount = Number(watch("adjustment_amount") || 0);

  useEffect(() => {
    setValue("utility_amount", utilityAmount);
    setValue("add_on_amount", addOnAmount);
  }, [utilityAmount, addOnAmount, setValue]);

  const totalDue = useMemo(() => {
    let total = 0;
    if (includeBaseRent) total += baseRentAmount;
    total += utilityAmount;
    total += addOnAmount;
    total += penaltyAmount;
    total += adjustmentAmount;
    return total;
  }, [
    includeBaseRent,
    baseRentAmount,
    utilityAmount,
    addOnAmount,
    penaltyAmount,
    adjustmentAmount,
  ]);

  useEffect(() => {
    if (!currentUser) return;
    if (!canManageBilling(currentUser)) {
      setLoadingContracts(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const data = await apiRequest("/api/contracts?status=active&per_page=100", { method: "GET" });
        if (cancelled) return;
        setActiveContracts(normalizePaginatedList(data).rows);
      } catch (e) {
        if (!cancelled) setContractsError(e?.message || "Failed to load contracts.");
      } finally {
        if (!cancelled) setLoadingContracts(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  // activeContract tracking moved up to prevent reference initialization error.

  useEffect(() => {
    if (!activeContract) return;

    const toLocalIso = (d) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    let startDate;
    if (activeContract.latest_billing?.billing_period_to) {
      const latestTo = new Date(activeContract.latest_billing.billing_period_to);
      startDate = new Date(latestTo.getFullYear(), latestTo.getMonth() + 1, 1);
    } else {
      const moveIn = new Date(activeContract.move_in_date);
      startDate = new Date(moveIn.getFullYear(), moveIn.getMonth(), 1);
    }

    const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
    const dueDate = new Date(startDate.getFullYear(), startDate.getMonth(), 6);

    setValue("billing_period_from", toLocalIso(startDate));
    setValue("billing_period_to", toLocalIso(endDate));
    setValue("due_date", toLocalIso(dueDate));
    const rent = parseFloat(activeContract.monthly_rate) || parseFloat(activeContract.rent_amount) || parseFloat(activeContract.room?.base_price) || parseFloat(activeContract.room?.monthly_rate) || 0;
    setValue("base_rent_amount", rent);
  }, [activeContract, setValue]);

  const onSubmit = () => {
    if (step < 4) {
        setStep(step + 1);
        return;
    }

    setShowConfirmModal(true);
  };

  const handleFinalSubmit = async () => {
    const data = getValues();
    setShowConfirmModal(false);
    setIsFinalIZING(true);
    const lineItems = [];
    const pushIfPositive = (amountValue, itemType, description) => {
      const n = parseFloat(amountValue);
      if (Number.isFinite(n) && n !== 0) {
        lineItems.push({
          item_type: itemType,
          item_description: description,
          amount: n,
        });
      }
    };

    if (data.include_base_rent) {
      const br = parseFloat(data.base_rent_amount);
      if (Number.isFinite(br) && br > 0) {
        lineItems.push({
          item_type: "base_rent",
          item_description: "MONTHLY BASE RENT",
          amount: br,
        });
      }
    }
    pushIfPositive(data.utility_amount, "utility", "UTILITY CHARGES");
    pushIfPositive(data.add_on_amount, "add_on", "SERVICE ADD-ONS");
    pushIfPositive(data.penalty_amount, "penalty", "LATE FEE / PENALTY");
    pushIfPositive(data.adjustment_amount, "adjustment", "FORENSIC ADJUSTMENT");

    if (lineItems.length === 0) {
      setApiError("ADD AT LEAST ONE NON-ZERO CHARGE BEFORE POSTING TO LEDGER.");
      return;
    }

    try {
      const payload = {
        contract_id: parseInt(data.contract_id, 10),
        billing_period_from: data.billing_period_from,
        billing_period_to: data.billing_period_to,
        due_date: data.due_date,
        line_items: lineItems,
        reading_ids: (data.reading_ids || []).map(id => parseInt(id, 10)),
      };

      const result = await apiRequest("/api/billing", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const id = result?.data?.billing_id;
      if (id) {
          router.push(`/billing/${id}`);
      } else {
          // Fallback if ID is missing but request succeeded
          router.push("/billing");
      }
    } catch (e) {
      applyServerFieldErrors(e, setError, { setApiError });
    } finally {
      setIsFinalIZING(false);
    }
  };

  const readOnly = !canManageBilling(currentUser);

  return (
    <StandardPage
      title="Billing Wizard"
      subtitle="OPERATIONAL REVENUE & COMPLIANCE GENERATION"
      loading={loadingContracts}
      breadcrumbs={
        <Breadcrumbs
          items={[
            { label: "Billing", href: "/billing" },
            { label: "Wizard" },
          ]}
        />
      }
      actions={
        <PageHeaderActions
          backHref="/billing"
          backLabel="EXIT WIZARD"
          user={currentUser}
        />
      }
    >
      <div className="mx-auto w-full max-w-4xl">
        <StepIndicator 
            currentStep={step}
            steps={[
                { step: 1, label: "CONTRACT SELECTION", icon: FileText },
                { step: 2, label: "UTILITIES", icon: TrendingUp },
                { step: 3, label: "FEES & ADD-ONS", icon: Calculator },
                { step: 4, label: "SUMMARY", icon: ShieldCheck }
            ]}
        />

        {readOnly ? (
          <Alert variant="warning" title="ACCESS DENIED">
            ADMINISTRATIVE PRIVILEGES REQUIRED FOR LEDGER MODIFICATION.
          </Alert>
        ) : contractsError ? (
           <Alert variant="error" title="CONTRACT RETRIEVAL FAILURE">{contractsError}</Alert>
        ) : activeContracts.length === 0 && !loadingContracts ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
             <div className="h-20 w-20 rounded-full bg-amber-50 flex items-center justify-center text-amber-500 mb-6">
                <AlertCircle size={40} />
             </div>
             <h3 className="text-xl font-black uppercase tracking-tight text-stone-900 mb-2">No Active Contracts</h3>
             <p className="text-stone-400 text-sm max-w-sm mb-8">
                A billing cycle requires an active tenant contract. Please initialize a contract before proceeding.
             </p>
             <Button variant="secondary" onClick={() => router.push("/contracts")} className="!h-11 px-8 rounded-xl text-[10px] font-bold uppercase tracking-widest">
               GO TO CONTRACTS
             </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            
            {step === 1 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                <FormSection title="CONTRACT DETAILS" icon={FileText}>
                    <Field label="Active Lease Selection" required error={errors.contract_id?.message}>
                        <Select
                            id="contract_id"
                            className="!h-14 border-stone-200 font-bold text-stone-900"
                            {...register("contract_id", { required: "A VALID CONTRACT MUST BE SELECTED." })}
                        >
                            <option value="">SELECT CONTRACT…</option>
                            {activeContracts.map((c) => (
                                <option key={c.contract_id} value={c.contract_id}>
                                    {contractDisplayLabel(c)}
                                </option>
                            ))}
                        </Select>
                    </Field>
                </FormSection>

                {activeContract && (
                    <FormSection title="BILLING PERIOD" icon={Calendar}>
                        <div className="grid gap-6 sm:grid-cols-3">
                            <Field label="CYCLE START" required error={errors.billing_period_from?.message}>
                                <Input type="date" className="!h-12 border-stone-200 font-bold" {...register("billing_period_from")} />
                            </Field>
                            <Field label="CYCLE END" required error={errors.billing_period_to?.message}>
                                <Input type="date" className="!h-12 border-stone-200 font-bold" {...register("billing_period_to")} />
                            </Field>
                            <Field label="REMITTANCE DUE" required error={errors.due_date?.message}>
                                <Input type="date" className="!h-12 border-stone-200 font-bold" {...register("due_date")} />
                            </Field>
                        </div>
                    </FormSection>
                )}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                <Card className="bg-white border-stone-200 p-8 relative overflow-hidden">
                    <div className="relative z-10">
                         <span className="text-[10px] font-black tracking-[0.3em] uppercase opacity-50 mb-4 block text-stone-900">TENANT SUMMARY</span>
                         <h3 className="text-2xl font-black tracking-tight text-stone-900">{formatTenantFullName(activeContract?.tenant)}</h3>
                         <div className="mt-4 flex flex-wrap gap-4">
                            <div className="bg-stone-50 px-3 py-1.5 rounded-lg border border-stone-200">
                                <span className="text-[9px] font-bold block text-stone-500 uppercase tracking-widest">ROOM</span>
                                <span className="text-xs font-mono font-black text-stone-900">{activeContract?.room?.room_code || "—"}</span>
                            </div>
                            <div className="bg-stone-50 px-3 py-1.5 rounded-lg border border-stone-200">
                                <span className="text-[9px] font-bold block text-stone-500 uppercase tracking-widest">MONTHLY RATE</span>
                                <span className="text-xs font-mono font-black text-stone-900">{formatPHP(activeContract?.monthly_rate || activeContract?.rent_amount || activeContract?.room?.base_price || activeContract?.room?.monthly_rate)}</span>
                            </div>
                         </div>
                    </div>
                </Card>

                <FormSection title="UTILITIES" icon={Calculator}>
                    <div className="space-y-8">
                        <div className="grid gap-6 sm:grid-cols-2">
                             <div className="bg-stone-50 rounded-2xl p-6 border border-stone-100">
                                <label className="flex cursor-pointer items-start gap-3">
                                    <input
                                        type="checkbox"
                                        className="mt-1 h-5 w-5 rounded-lg border-stone-300 text-teal-600 focus:ring-teal-500/20"
                                        {...register("include_base_rent")}
                                    />
                                    <div>
                                        <span className="block text-xs font-black uppercase tracking-widest text-stone-900">Include Base Rent</span>
                                        <span className="mt-1 block text-[10px] font-medium text-stone-400">
                                            Post the contractual monthly rent.
                                        </span>
                                    </div>
                                </label>
                                {includeBaseRent && (
                                    <div className="mt-4 animate-in fade-in zoom-in-95">
                                         <Input 
                                            type="number" 
                                            className="!h-10 border-stone-200 font-mono font-bold text-center" 
                                            {...register("base_rent_amount")} 
                                        />
                                    </div>
                                )}
                             </div>

                             <div className="bg-stone-50 rounded-2xl p-6 border border-stone-100 flex flex-col h-full max-h-[440px]">
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-stone-900 block">Utility Readings</span>
                                    {watchedReadingIds.length > 0 && (
                                        <span className="px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 text-[8px] font-black uppercase tracking-tighter">
                                            {watchedReadingIds.length} SELECTED
                                        </span>
                                    )}
                                </div>
                                {unbilledReadings.length === 0 ? (
                                    <div className="flex-1 flex flex-col justify-center items-center text-center opacity-50 relative py-4">
                                        <AlertCircle size={20} className="mb-2" />
                                        <span className="text-[9px] font-bold uppercase tracking-widest">No unbilled readings</span>
                                    </div>
                                ) : (
                                    <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3">
                                        {unbilledReadings.map((reading) => (
                                            <label key={reading.reading_id} className="flex cursor-pointer items-start gap-3 bg-white p-3 rounded-xl border border-stone-200 hover:border-teal-400 transition-colors">
                                                <input
                                                    type="checkbox"
                                                    value={reading.reading_id}
                                                    className="mt-1 h-4 w-4 rounded border-stone-300 text-teal-600 focus:ring-teal-500/20"
                                                    {...register("reading_ids")}
                                                />
                                                 <div className="flex-1">
                                                    <span className="block text-[10px] font-black uppercase tracking-widest text-stone-900 group-hover:text-teal-600 transition-colors">
                                                        {reading.utility_type === "electric" ? "⚡ Electricity Supply" : "💧 Water Supply"} ({formatDateString(reading.reading_date)})
                                                    </span>
                                                    <span className="mt-0.5 block text-xs font-mono font-bold text-stone-500">
                                                        {reading.consumption_delta || 0} {reading.utility_type === "electric" ? "kWh" : "m³"}
                                                    </span>
                                                </div>
                                                <div className="text-right">
                                                    <span className="font-mono text-sm font-black text-teal-700">{formatPHP(reading.calculated_amount)}</span>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                )}
                             </div>
                        </div>
                    </div>
                </FormSection>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                <FormSection title="FEES & ADD-ONS" icon={Plus}>
                    <div className="space-y-8">
                        <div className="grid gap-6 sm:grid-cols-2">
                             <div className="bg-stone-50 rounded-2xl p-6 border border-stone-100 flex flex-col h-full">
                                <span className="text-[10px] font-black uppercase tracking-widest text-stone-900 mb-4 block">Active Add-ons</span>
                                {activeAddOns.length === 0 ? (
                                    <div className="flex-1 flex flex-col justify-center items-center text-center opacity-50 relative py-8">
                                        <AlertCircle size={24} className="mb-2 text-stone-300" />
                                        <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-stone-400">NO ACTIVE APPLIANCES</span>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {activeAddOns.map((addon, idx) => (
                                            <div key={idx} className="flex items-center justify-between bg-white p-3 rounded-xl border border-stone-200">
                                                <div>
                                                    <span className="block text-[10px] font-black uppercase tracking-widest text-stone-900">
                                                        {addon.item_name || "ASSIGNED APPLIANCE"}
                                                    </span>
                                                </div>
                                                <div className="text-right">
                                                    <span className="font-mono text-sm font-black text-teal-700">{formatPHP(addon.rate || addon.monthly_rate)}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                             </div>
                             <div className="space-y-6">
                                 <Field label="LATE FEES (₱)">
                                    <Input type="number" step="0.01" className="!h-12 border-stone-200 font-mono font-bold text-rose-600" {...register("penalty_amount")} />
                                 </Field>
                                 <Field label="ADJUSTMENT (₱)">
                                    <Input type="number" step="0.01" className="!h-12 border-stone-200 font-mono font-bold text-amber-600" {...register("adjustment_amount")} />
                                 </Field>
                             </div>
                        </div>
                    </div>
                </FormSection>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                 <div className="p-8 rounded-3xl border border-teal-600/10 bg-teal-50/20 text-center">
                    <div className="mx-auto h-16 w-16 bg-teal-600 text-white rounded-2xl flex items-center justify-center shadow-xl mb-6">
                        <ShieldCheck size={32} />
                    </div>
                    <h3 className="text-2xl font-black text-stone-900 uppercase tracking-tight mb-2">Billing Summary</h3>
                    <p className="text-stone-500 text-sm max-w-md mx-auto">
                        Review the generated breakdown before saving the billing record.
                    </p>
                 </div>

                 <div className="grid gap-6 lg:grid-cols-12">
                    <div className="lg:col-span-12">
                        <Card className="!p-0 overflow-hidden border-stone-200">
                            <div className="bg-stone-50 px-8 py-4 border-b border-stone-100 flex justify-between items-center">
                                <span className="hs-strip-title uppercase tracking-[0.2em] text-[10px] font-black text-stone-400">REMITTANCE BREAKDOWN</span>
                                <span className="font-mono text-[9px] font-bold text-stone-300">#BILL-PROJECTION</span>
                            </div>
                            <div className="p-8 space-y-4">
                                <div className="flex justify-between items-center py-2 border-b border-stone-50">
                                    <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">BILLING PERIOD</span>
                                    <span className="text-xs font-bold text-stone-900">{formatDateString(watch("billing_period_from"))} — {formatDateString(watch("billing_period_to"))}</span>
                                </div>
                                {includeBaseRent && (
                                    <div className="flex justify-between items-center py-2 border-b border-stone-50">
                                        <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Base Rent</span>
                                        <span className="font-mono text-sm font-black text-stone-900">{formatPHP(baseRentAmount)}</span>
                                    </div>
                                )}
                                {utilityAmount !== 0 && (
                                    <div className="flex justify-between items-center py-2 border-b border-stone-50">
                                        <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Utilities</span>
                                        <span className="font-mono text-sm font-black text-stone-900">{formatPHP(utilityAmount)}</span>
                                    </div>
                                )}
                                {addOnAmount !== 0 && (
                                    <div className="flex justify-between items-center py-2 border-b border-stone-50">
                                        <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Add-ons</span>
                                        <span className="font-mono text-sm font-black text-stone-900">{formatPHP(addOnAmount)}</span>
                                    </div>
                                )}
                                {penaltyAmount !== 0 && (
                                    <div className="flex justify-between items-center py-2 border-b border-stone-50">
                                        <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Penalties</span>
                                        <span className="font-mono text-sm font-black text-rose-600">{formatPHP(penaltyAmount)}</span>
                                    </div>
                                )}
                                {adjustmentAmount !== 0 && (
                                    <div className="flex justify-between items-center py-2 border-b border-stone-50">
                                        <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Adjustment</span>
                                        <span className="font-mono text-sm font-black text-amber-600">{formatPHP(adjustmentAmount)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between items-center pt-6">
                                    <span className="text-sm font-black text-stone-900 uppercase tracking-tighter">TOTAL REMITTANCE</span>
                                    <span className="font-mono text-3xl font-black text-emerald-700">{formatPHP(totalDue)}</span>
                                </div>
                            </div>
                        </Card>
                    </div>
                 </div>

              </div>
            )}

            {apiError && <Alert variant="error" title="LEDGER SYNCHRONIZATION ERROR">{apiError}</Alert>}

            <div className="flex flex-col-reverse gap-3 border-t border-stone-100 pt-8 sm:flex-row sm:items-center sm:justify-end">
              {step > 1 && (
                <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setStep(step - 1)}
                    className="rounded-xl !h-12 px-10 font-bold text-[10px] uppercase tracking-widest"
                >
                    BACK
                </Button>
              )}
              {step < 4 ? (
                <Button
                    type="submit"
                    variant="primary"
                    disabled={!selectedContractId || isSubmitting}
                    className="rounded-xl !h-12 px-12 font-bold text-[10px] uppercase tracking-widest border-0 shadow-lg"
                >
                    <span>NEXT STEP</span>
                    <ArrowRight size={14} className="ml-2" />
                </Button>
              ) : (
                <Button
                    type="submit"
                    variant="primary"
                    loading={isFinalIZING || isSubmitting}
                    disabled={totalDue <= 0 || isSubmitting || isFinalIZING || readOnly}
                    className="rounded-xl !h-12 px-12 font-bold text-[10px] uppercase tracking-widest bg-teal-700 hover:bg-teal-800 border-0 shadow-lg shadow-teal-500/20"
                >
                    POST TO LEDGER
                </Button>
              )}
            </div>
          </form>
        )}
      </div>

      <ConfirmationDialog
        open={showConfirmModal}
        title="Initialize Billing?"
        message={`You are about to post a total of ${formatPHP(totalDue)} to the tenant's ledger. This action will initiate a new collection cycle.`}
        confirmLabel="Confirm & Post Ledger"
        cancelLabel="Review Breakdown"
        onConfirm={handleFinalSubmit}
        onCancel={() => setShowConfirmModal(false)}
        isLoading={isFinalIZING}
      />
    </StandardPage>
  );
}
