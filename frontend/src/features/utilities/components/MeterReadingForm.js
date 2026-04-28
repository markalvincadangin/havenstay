"use client";
import { useState, useMemo } from "react";
import { useToasts } from "@/context/ToastContext";
import { Zap, Droplet, AlertTriangle } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { applyServerFieldErrors } from "@/lib/forms";
import { Field, Input } from "@/components/ui/Fields";
import { QuickEditFormShell } from "@/components/ui/QuickEditFormShell";
import { useForm } from "react-hook-form";
export function MeterReadingForm({ meter, onSuccess, onCancel }) {
  const { register, handleSubmit, formState: { errors }, setError, watch } = useForm({
    defaultValues: {
      reading_date: new Date().toISOString().split('T')[0],
      reading_value: "",
      is_rollover: false
    }
  });
  const { showToast } = useToasts();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isElectric = meter?.utility?.name?.toLowerCase().includes("electric") || meter?.utility_type === "electric";
  const latestR = meter?.readings?.[0]; // Assumes readings are sorted desc
  const latestValue = latestR ? Number(latestR.reading_value) : 0;
  const onFormSubmit = async (data) => {
    const val = parseFloat(data.reading_value);
    
    // Monotonicity Check (BR-MET-004) vs Rollover (BR-MET-005)
    if (!data.is_rollover && val < latestValue) {
      showToast(`Reading must be ≥ the last recorded value (${latestValue}) unless this is a rollover event.`, "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await apiRequest(`/api/meters/${meter.meter_id}/readings`, {
        method: "POST",
        body: JSON.stringify({
          ...data,
          reading_value: val,
        })
      });
      // Pass the new reading back for auto-selection in the wizard
      onSuccess(response);
    } catch (err) {
      applyServerFieldErrors(err, setError, { showToast });
    } finally {
      setIsSubmitting(false);
    }
  };
  return (
    <QuickEditFormShell
      onSubmit={handleSubmit(onFormSubmit)}
      isSubmitting={isSubmitting}
      onCancel={onCancel}
      submitLabel="Confirm Reading"
    >
      <div className="space-y-6">
        <div className="flex items-start gap-4 p-6 bg-stone-50 rounded-2xl border border-stone-100">
          <div className={`flex size-12 shrink-0 items-center justify-center rounded-2xl shadow-sm ${isElectric ? 'bg-amber-50 text-amber-600' : 'bg-sky-50 text-sky-600'}`}>
            {isElectric ? <Zap size={24} strokeWidth={2.5} /> : <Droplet size={24} strokeWidth={2.5} />}
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Last Recorded</p>
            <p className="text-xl font-black text-stone-900 font-mono tabular-nums tracking-tight">
              {latestValue} <span className="text-xs font-bold text-stone-400">{isElectric ? 'kWh' : 'm³'}</span>
            </p>
          </div>
        </div>
        <Field label="Reading Date" required error={errors.reading_date?.message}>
          <Input
            type="date"
            {...register("reading_date", { required: "Date is required." })}
            className="font-bold cursor-pointer"
          />
        </Field>
        <Field label="Reading Value" required error={errors.reading_value?.message}>
          <div className="relative">
            <Input
              type="number"
              step="0.0001"
              autoFocus
              placeholder={latestValue ? `≥ ${latestValue}` : "Current reading"}
              {...register("reading_value", { 
                required: "Reading value is required.",
                min: { value: 0, message: "Reading cannot be negative." }
              })}
              className="!h-16 px-8 text-xl font-black tabular-nums border-stone-200 focus:border-teal-500"
            />
            <div className="absolute right-6 top-1/2 -translate-y-1/2 text-xs font-black uppercase tracking-widest text-stone-300 pointer-events-none">
              {isElectric ? 'kWh' : 'm³'}
            </div>
          </div>
        </Field>
        <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200">
          <label className="flex items-center gap-4 cursor-pointer group">
            <div className="relative flex items-center">
              <input
                type="checkbox"
                {...register("is_rollover")}
                className="size-5 rounded border-stone-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
              />
            </div>
            <div className="flex-1">
              <p className="text-xs font-black uppercase tracking-wider text-stone-900 group-hover:text-teal-700 transition-colors">
                Dial Rollover Event
              </p>
              <p className="text-[10px] font-medium text-stone-400 mt-1 uppercase leading-tight">
                Check this if the meter has reached its maximum capacity (9,999.9999) and reset to zero.
              </p>
            </div>
          </label>
        </div>
        {!watch("is_rollover") && (
          <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-100 flex gap-3">
            <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[10px] font-medium text-amber-800 leading-relaxed uppercase">
              Meter readings must be monotonic. Dropping below the last record will cause forensic reconciliation failure.
            </p>
          </div>
        )}
      </div>
    </QuickEditFormShell>
  );
}
