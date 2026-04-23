"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { apiRequest } from "@/lib/api";
import { applyServerFieldErrors } from "@/lib/forms";
import { Field, Input } from "@/components/ui/Fields";
import { QuickEditFormShell } from "@/components/ui/QuickEditFormShell";
import { Edit2 } from "lucide-react";

export function UtilityQuickEditForm({ utility, onSuccess, onCancel }) {
  const [apiError, setApiError] = useState(null);

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
    setApiError(null);
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
      applyServerFieldErrors(err, setError, { setApiError });
    }
  };

  return (
    <QuickEditFormShell
      title="Update Service"
      description="Modify the identity or metric unit of this service."
      icon={Edit2}
      onSubmit={handleSubmit(onSubmit)}
      isSubmitting={isSubmitting}
      apiError={apiError}
      onCancel={onCancel}
      submitLabel="Update Service"
    >
      <div className="space-y-6">
        <div className="space-y-5">
          <Field label="System Label" required error={errors.name?.message}>
            <Input
              placeholder="e.g. Internet, Parking"
              className="!h-12 border-stone-200 font-bold focus:border-teal-500/50"
              hasError={Boolean(errors.name)}
              {...register("name", { required: "Service name is required." })}
            />
          </Field>

          <Field 
            label="Unit of Measurement" 
            required 
            error={errors.unit_of_measurement?.message}
            description="Warning: Changing the unit does not retroactively convert past readings."
          >
            <Input
              placeholder="e.g. Month"
              className="!h-12 border-stone-200 font-bold focus:border-teal-500/50"
              hasError={Boolean(errors.unit_of_measurement)}
              {...register("unit_of_measurement", { required: "Unit is required." })}
            />
          </Field>
        </div>
      </div>
    </QuickEditFormShell>
  );
}
