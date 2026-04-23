"use client";
import { useState } from "react";
import { Zap, Droplet, AlertTriangle } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { Field, Input } from "@/components/ui/Fields";
import { QuickEditFormShell } from "@/components/ui/QuickEditFormShell";
export function MeterReadingForm({ meter, onSuccess, onCancel }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState("");
  const [formData, setFormData] = useState({
    reading_date: new Date().toISOString().split('T')[0],
    reading_value: "",
    is_rollover: false
  });
  const isElectric = meter?.utility?.name?.toLowerCase().includes("electric") || meter?.utility_type === "electric";
  const latestR = meter?.readings?.[0]; // Assumes readings are sorted desc
  const latestValue = latestR ? Number(latestR.reading_value) : 0;
  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError("");
    const val = parseFloat(formData.reading_value);
    if (isNaN(val)) {
      setApiError("A numerical reading value is required.");
      return;
    }
    // Monotonicity Check (BR-MET-004) vs Rollover (BR-MET-005)
    if (!formData.is_rollover && val < latestValue) {
      setApiError(`Validation failed: The new reading must be ≥ the last record (${latestValue}) unless this is a Rollover event.`);
      return;
    }
    setIsSubmitting(true);
    try {
      await apiRequest(`/api/meters/${meter.meter_id}/readings`, {
        method: "POST",
        body: JSON.stringify({
          ...formData,
          reading_value: val,
          is_rollover: formData.is_rollover
        })
      });
      onSuccess();
    } catch (err) {
      setApiError(err.message || "Failed to record reading.");
    } finally {
      setIsSubmitting(false);
    }
  };
  return (
    <QuickEditFormShell
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
      apiError={apiError}
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
        <Field label="Reading Date" required>
          <Input
            type="date"
            value={formData.reading_date}
            onChange={(e) => setFormData({ ...formData, reading_date: e.target.value })}
            className="font-bold cursor-pointer"
          />
        </Field>
        <Field label="Reading Value" required>
          <div className="relative">
            <Input
              type="number"
              step="0.0001"
              autoFocus
              placeholder={formData.is_rollover ? "Post-rollover value" : `≥ ${latestValue}`}
              value={formData.reading_value}
              onChange={(e) => setFormData({ ...formData, reading_value: e.target.value })}
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
                checked={formData.is_rollover}
                onChange={(e) => setFormData({ ...formData, is_rollover: e.target.checked })}
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
        {!formData.is_rollover && (
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
