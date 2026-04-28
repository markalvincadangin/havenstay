"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { apiRequest } from "@/lib/api";
import { applyServerFieldErrors } from "@/lib/forms";
import { Field, Input } from "@/components/ui/Fields";
import { QuickEditFormShell } from "@/components/ui/QuickEditFormShell";
import { Edit2 } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToasts } from "@/context/ToastContext";

export function UtilityQuickEditForm({ utility, onSuccess, onCancel }) {
  const { showToast } = useToasts();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      name: utility?.name || "",
      unit_of_measurement: utility?.unit_of_measurement || "",
    },
  });

  const onSubmit = async (values) => {
    try {
      await apiRequest(`/api/utilities/${utility.utility_id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: values.name,
          unit_of_measurement: values.unit_of_measurement,
        }),
      });
      onSuccess();
    } catch (err) {
      applyServerFieldErrors(err, setError, { showToast });
    }
  };

  return (
    <QuickEditFormShell
      title="Utility Details"
      description="Modify the identity or metric unit of this utility."
      icon={Edit2}
      onSubmit={handleSubmit(onSubmit)}
      isSubmitting={isSubmitting}
      onCancel={onCancel}
      submitLabel="Update Utility"
    >
      <div className="space-y-8">
        {/* Forensic Identity Header */}
        <div className="flex items-center justify-between border-b border-stone-100 pb-6">
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Contextual Label</p>
            <h4 className="text-lg font-black text-stone-900">{utility?.name}</h4>
          </div>
          <div className="flex flex-col items-end gap-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Status</p>
            <StatusBadge size="sm">Active</StatusBadge>
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-5">
            <Field label="Utility Name" required error={errors.name?.message}>
              <Input
                placeholder="e.g. Internet, Parking"
                className="!h-12 border-stone-200 font-bold focus:border-teal-500/50"
                hasError={Boolean(errors.name)}
                {...register("name", { required: "Utility name is required." })}
              />
            </Field>

            <Field
              label="Unit of Measurement"
              required
              error={errors.unit_of_measurement?.message}
              description="Warning: Changing the unit does not retroactively convert past readings."
            >
              <Input
                placeholder="e.g. kWh, m³, Month"
                className="!h-12 border-stone-200 font-bold focus:border-teal-500/50"
                hasError={Boolean(errors.unit_of_measurement)}
                {...register("unit_of_measurement", { required: "Unit is required." })}
              />
            </Field>
          </div>
        </div>
      </div>
    </QuickEditFormShell>
  );
}
