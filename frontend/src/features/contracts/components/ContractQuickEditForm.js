"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { Calendar, Wallet, FileText } from "lucide-react";

import { apiRequest } from "@/lib/api";
import { canManageContracts } from "@/lib/auth";
import { applyServerFieldErrors } from "@/lib/forms";
import { parseMoneyInput } from "@/lib/formatters";
import { isContractActive, isContractEditable, isContractFinanciallyLocked } from "@/lib/constants";
import { Field, Input, Textarea } from "@/components/ui/Fields";
import { QuickEditFormShell } from "@/components/ui/QuickEditFormShell";
import RecordStateAlert from '@/components/ui/RecordStateAlert';
import { useToasts } from "@/context/ToastContext";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatPHP } from "@/lib/formatters";

export function ContractQuickEditForm({ contract, currentUser, onSuccess, onCancel }) {
  const { showToast } = useToasts();
  const [apiError, setApiError] = useState("");
  const readOnly = !canManageContracts(currentUser);

  const {
    register,
    handleSubmit,
    setError,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      move_in_date: contract.move_in_date?.split("T")[0] || "",
      expected_move_out: contract.expected_move_out_date?.split("T")[0] || "",
      actual_move_out: contract.actual_move_out_date?.split("T")[0] || "",
      deposit_amount: contract.deposit_amount ?? "",
      monthly_rent: contract.monthly_rate_override ?? contract.monthly_rate ?? "",
      notes: contract.notes || "",
    },
  });

  const watchMonthlyRent = watch("monthly_rent");

  const onSubmit = async (values) => {
    setApiError("");
    if (readOnly) return;

    try {
      const depositParsed = parseMoneyInput(values.deposit_amount);
      const rentParsed = parseMoneyInput(values.monthly_rent);

      if (Number.isNaN(depositParsed) || Number.isNaN(rentParsed)) {
        setApiError("Enter valid amounts.");
        return;
      }

      const isActiveContract = isContractActive(contract?.status);
      const isFinanciallyLocked = isContractFinanciallyLocked(contract?.status);

      // HCI Smart Logic: If the entered rent matches the base rate, clear the override.
      const isOverridden = Number(rentParsed).toFixed(2) !== Number(contract.monthly_rate).toFixed(2);

      const payload = {
        expected_move_out: values.expected_move_out || null,
        notes: values.notes || null,
        ...(isFinanciallyLocked ? {} : {
          deposit_amount: depositParsed,
          monthly_rate_override: isOverridden ? rentParsed : null
        }),
        ...(isActiveContract ? {} : { actual_move_out: values.actual_move_out || null }),
      };

      await apiRequest(`/api/contracts/${contract.contract_id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      showToast(`Contract #${contract.contract_id} updated.`, "success");
      onSuccess();
    } catch (error) {
      applyServerFieldErrors(error, setError, { setApiError });
    }
  };

  const isActive = isContractActive(contract?.status);
  const isLocked = !isContractEditable(contract?.status);
  const isFinanciallyLocked = isContractFinanciallyLocked(contract?.status);
  const isCustomRate = Number(watchMonthlyRent).toFixed(2) !== Number(contract.monthly_rate).toFixed(2);

  return (
    <QuickEditFormShell
      onSubmit={handleSubmit(onSubmit)}
      isSubmitting={isSubmitting}
      apiError={apiError}
      onCancel={onCancel}
      submitLabel="Update Contract"
    >
      {/* Forensic Header: Establishes Global Context (HCI Primacy Principle) */}
      <div className="mb-6 pb-4 border-b border-stone-100 flex items-center justify-between">
        <div>
          <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest block mb-1">Status</span>
          <StatusBadge>{contract.status}</StatusBadge>
        </div>
        <div className="text-right">
          <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest block mb-1">Contract ID</span>
          <span className="font-mono text-xs font-bold text-stone-600">#{String(contract.contract_id).padStart(6, '0')}</span>
        </div>
      </div>

      {isLocked && (
        <RecordStateAlert variant="info" className="mb-6">
          This contract has ended. Only notes can be updated to preserve forensic history (BR-CON-010).
        </RecordStateAlert>
      )}

      {isFinanciallyLocked && !isLocked && (
        <RecordStateAlert variant="info" className="mb-6">
          Core financial terms are locked after contract activation (BR-CON-005).
        </RecordStateAlert>
      )}

      <div>
        <div className="flex items-center justify-between mb-2 pb-2 border-b border-stone-50">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-500 flex items-center gap-2">
            <Calendar size={12} /> Schedule
          </h3>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 pt-2">
          <Field label="End Date" error={errors.expected_move_out?.message}>
            <Input type="date" disabled={readOnly} className="!h-10 border-stone-200" {...register("expected_move_out")} />
          </Field>
          {!isActive && (
            <Field label="Move-out Date" error={errors.actual_move_out?.message}>
              <Input type="date" disabled={readOnly} className="!h-10 border-stone-200" {...register("actual_move_out")} />
            </Field>
          )}
        </div>
      </div>

      <div>
        <div className="mb-2 pb-2 border-b border-stone-50">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-500 mb-0 flex items-center gap-2">
            <Wallet size={12} /> Rent & Deposits
          </h3>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 pt-2">
          <Field
            label="Monthly Rent"
            required
            error={errors.monthly_rent?.message}
            hint={
              <div className="flex items-center justify-between mt-1 px-0.5">
                <span className="text-[10px] font-medium text-stone-500">Standard: {formatPHP(contract.monthly_rate)}</span>
                {isCustomRate && !isFinanciallyLocked && (
                  <button
                    type="button"
                    onClick={() => setValue("monthly_rent", contract.monthly_rate)}
                    className="text-[10px] font-black text-teal-700 hover:text-teal-800 transition-colors"
                  >
                    Reset
                  </button>
                )}
              </div>
            }
          >
            <div className="relative">
              <Input
                type="number"
                step="0.01"
                disabled={readOnly || isFinanciallyLocked || isLocked}
                className={`!h-10 border-stone-200 font-mono font-bold transition-all ${isCustomRate ? "text-teal-700 bg-teal-50/30 pr-16" : ""}`}
                {...register("monthly_rent", { required: "Required" })}
              />
              {isCustomRate && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <span className="text-[8px] font-black bg-teal-600 text-white px-1.5 py-0.5 rounded uppercase tracking-tighter shadow-sm">Custom</span>
                </div>
              )}
            </div>
          </Field>
          <Field label="Security Deposit" required error={errors.deposit_amount?.message}>
            <Input type="number" step="0.01" disabled={readOnly || isFinanciallyLocked || isLocked} className="!h-10 border-stone-200 font-mono font-bold" {...register("deposit_amount", { required: "Required" })} />
          </Field>
        </div>
      </div>

      <div>
        <div className="mb-2 pb-2 border-b border-stone-50">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-500 mb-0 flex items-center gap-2">
            <FileText size={12} /> Administrative Notes
          </h3>
        </div>
        <div className="pt-2">
          <Field label="...">
            <Textarea rows={3} disabled={readOnly} className="border-stone-200" {...register("notes")} />
          </Field>
        </div>
      </div>
    </QuickEditFormShell>
  );
}
