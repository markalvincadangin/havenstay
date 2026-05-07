"use client";

import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Alert from "@/components/ui/Alert";
import { Field, Input, Textarea } from "@/components/ui/Fields";
import CurrencyDisplay from "@/components/ui/CurrencyDisplay";
import Button from "@/components/ui/Button";
import { formatTenantDirectoryName } from "@/lib/formatters";

/**
 * MoveOutModal — Specialized workflow for closing agreements.
 * Encapsulated in features/contracts per modular architecture.
 */
export default function MoveOutModal({ open, contract, onClose, onConfirm, isSubmitting, balance }) {
  const cancelBtnId = "moveout-cancel-btn";
  const tenant = contract?.tenant;
  const room = contract?.room;
  const hasBalance = balance > 0;

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
    reset,
  } = useForm({ defaultValues: { actual_move_out: "", status: "completed", notes: "" } });

  const selectedStatus = useWatch({ control, name: "status" });
  const actualDate = useWatch({ control, name: "actual_move_out" });

  // Automation Rule: Detect Early Termination based on dates
  useEffect(() => {
    if (!contract || !actualDate) return;

    let newStatus = "completed";
    if (contract.contract_type === "fixed_term" && contract.expected_move_out_date) {
      // Compare dates (YYYY-MM-DD)
      if (actualDate < contract.expected_move_out_date) {
        newStatus = "terminated";
      }
    }
    setValue("status", newStatus);
  }, [actualDate, contract, setValue]);

  useEffect(() => {
    if (open) {
      const today = new Date().toISOString().split("T")[0];
      const expected = contract?.expected_move_out_date;

      reset({
        actual_move_out: expected || today,
        status: "completed",
        notes: ""
      });
      setTimeout(() => document.getElementById(cancelBtnId)?.focus(), 50);
    }
  }, [open, reset, contract]);

  return (
    <Modal isOpen={open} onClose={onClose} maxWidth="520px" className="!p-0 overflow-hidden">
      <div className={`p-8 pb-6 border-b transition-colors duration-500 ${hasBalance ? "bg-rose-50/30 border-rose-100" :
          selectedStatus === "terminated" ? "bg-amber-50/30 border-amber-100" :
            "bg-teal-50/30 border-teal-100"
        }`}>
        <div className="flex items-start gap-5">
          <div className={`flex size-14 shrink-0 items-center justify-center rounded-2xl shadow-xl transition-all duration-500 ${hasBalance ? "bg-rose-50 text-rose-600 shadow-rose-900/10" :
              selectedStatus === "terminated" ? "bg-amber-50 text-amber-600 shadow-amber-900/10" :
                "bg-teal-50 text-teal-600 shadow-teal-900/10"
            }`}>
            {hasBalance ? <AlertTriangle className="size-7" /> : <ShieldCheck className="size-7" />}
          </div>
          <div className="flex-1">
            <h2 id="moveout-modal-title" className="text-2xl font-black tracking-tight text-stone-900 uppercase leading-none mb-1">
              {hasBalance ? "Outstanding Balance" : selectedStatus === "terminated" ? "Early Termination" : "Standard Move-Out"}
            </h2>
            <div className="flex items-center gap-2">
              <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                contract?.expected_move_out_date ? 'bg-stone-200 text-stone-600' : 'bg-blue-100 text-blue-700'
              }`}>
                {contract?.expected_move_out_date ? 'Fixed Term' : 'Open Ended'}
              </span>
              <p className="text-[11px] font-bold text-stone-400 uppercase tracking-tight">
                {hasBalance ? "Please clear the outstanding balance before proceeding." : "Account in good standing."}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-8 space-y-6">
        <div className={`rounded-2xl border p-6 transition-all duration-500 ${hasBalance ? "bg-rose-50/50 border-rose-100" : "bg-teal-50/50 border-teal-100"
          }`}>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">Account Status</span>
              {hasBalance ? (
                <div className="text-right">
                  <span className="text-[10px] font-black uppercase text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-100 mb-1 inline-block">Balance Due</span>
                  <CurrencyDisplay amount={balance} className="block text-xl font-black text-rose-700" />
                </div>
              ) : (
                <span className="text-lg font-black text-teal-700 uppercase tracking-tight">Cleared</span>
              )}
            </div>

            <div className="h-px bg-stone-200/50 my-1"></div>

            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">Tenant</span>
              <span className="text-sm font-bold text-stone-900">{tenant ? formatTenantDirectoryName(tenant) : "—"}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">Room / Bed</span>
              <span className="text-sm font-mono font-bold text-stone-900">
                {room ? room.room_code : "—"}{contract?.bed_space?.bed_label ? ` · ${contract.bed_space.bed_label}` : ""}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">Agreement Type</span>
              <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${
                contract?.expected_move_out_date ? 'bg-stone-100 text-stone-600' : 'bg-blue-50 text-blue-600'
              }`}>
                {contract?.expected_move_out_date ? 'Fixed Term' : 'Month-to-Month (Open)'}
              </span>
            </div>
          </div>
        </div>

        {/* Departure Type Automation Feedback */}
        {!hasBalance && (
          <div className={`p-4 rounded-2xl border transition-all duration-500 flex items-center gap-4 ${selectedStatus === 'terminated'
              ? "bg-amber-50 border-amber-100 text-amber-900"
              : "bg-teal-50 border-teal-100 text-teal-900"
            }`}>
            <div className={`size-8 shrink-0 rounded-lg flex items-center justify-center ${selectedStatus === 'terminated' ? "bg-amber-500 text-white" : "bg-teal-600 text-white"
              }`}>
              {selectedStatus === 'terminated' ? <AlertTriangle size={16} /> : <ShieldCheck size={16} />}
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-black uppercase tracking-widest leading-none mb-1">
                Detected Lifecycle State
              </p>
              <p className="text-xs font-bold leading-tight">
                {selectedStatus === 'terminated'
                  ? "This move-out is before the lease end date and will be recorded as an early termination."
                  : !contract?.expected_move_out_date
                    ? "This concludes the open-ended agreement. Bed inventory will be released immediately."
                    : "This move-out concludes the fixed-term lease at its scheduled end."
                }
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit(onConfirm)} className="space-y-5">

          <Field label="Final Move-out Date" required error={errors.actual_move_out?.message}>
            <Input
              type="date"
              hasError={Boolean(errors.actual_move_out)}
              className="!h-10 border-stone-200 font-bold"
              disabled={hasBalance}
              {...register("actual_move_out", {
                required: "Required.",
              })}
            />
          </Field>

          <Field label={selectedStatus === "terminated" ? "Termination Reason" : "Departure Notes"} error={errors.notes?.message}>
            <Textarea
              rows={3}
              placeholder={selectedStatus === "terminated" ? "Why is the lease ending early? (Required)" : "Final inspection details..."}
              className="border-stone-200"
              disabled={hasBalance}
              {...register("notes", {
                required: selectedStatus === "terminated" ? "A reason for termination is required." : false
              })}
            />
          </Field>

          <div className="flex flex-col gap-2 pt-1">
            <Button
              type="submit"
              variant={selectedStatus === "terminated" ? "warning" : "primary"}
              className="!h-12 w-full rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-stone-900/5"
              loading={isSubmitting}
              disabled={hasBalance}
            >
              Confirm Move-Out
            </Button>
            <Button
              id={cancelBtnId}
              type="button"
              variant="ghost"
              className="!h-9 w-full text-[9px] font-black uppercase tracking-widest text-stone-400 hover:text-stone-600"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
