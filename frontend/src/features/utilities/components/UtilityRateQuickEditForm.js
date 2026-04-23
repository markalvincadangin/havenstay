"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { apiRequest } from "@/lib/api";
import { applyServerFieldErrors } from "@/lib/forms";
import { Field, Input } from "@/components/ui/Fields";
import { QuickEditFormShell } from "@/components/ui/QuickEditFormShell";
import { Clock } from "lucide-react";

export function UtilityRateQuickEditForm({ preselectedUtilityId, onSuccess, onCancel }) {
  const [apiError, setApiError] = useState(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      utility_id: preselectedUtilityId || "",
      base_rate: "",
      effective_from: new Date().toISOString().split("T")[0],
    },
  });

  const onSubmit = async (values) => {
    setApiError(null);
    try {
      await apiRequest("/api/utilities/rates", {
        method: "POST",
        body: JSON.stringify({
          utility_id: Number(values.utility_id),
          base_rate: parseFloat(values.base_rate),
          effective_from: values.effective_from,
        }),
      });
      onSuccess();
    } catch (err) {
      applyServerFieldErrors(err, setError, { setApiError });
    }
  };

  return (
    <QuickEditFormShell
      title="Add Rate Schedule"
      description="Define a new future or current metrology rate. Previous active rates will be superseded automatically once the effective date arrives."
      icon={Clock}
      onSubmit={handleSubmit(onSubmit)}
      isSubmitting={isSubmitting}
      apiError={apiError}
      onCancel={onCancel}
      submitLabel="Publish Rate"
    >
      <div className="space-y-5">
        <input type="hidden" {...register("utility_id", { required: true })} />

        <Field label="Base Rate (PHP)" required error={errors.base_rate?.message}>
          <Input
            type="number"
            step="0.01"
            placeholder="0.00"
            className="!h-12 border-stone-200 font-mono focus:border-teal-500/50 tabular-nums"
            hasError={Boolean(errors.base_rate)}
            {...register("base_rate", { required: "Value is required." })}
          />
        </Field>

        <Field 
          label="Effective From Date" 
          required 
          error={errors.effective_from?.message}
        >
          <Input
            type="date"
            className="!h-12 border-stone-200 font-bold focus:border-teal-500/50"
            hasError={Boolean(errors.effective_from)}
            {...register("effective_from", { required: "Effective date is required." })}
          />
        </Field>
      </div>
    </QuickEditFormShell>
  );
}
