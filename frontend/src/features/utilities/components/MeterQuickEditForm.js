"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import useSWR from "swr";
import { Settings, Info } from "lucide-react";
import { apiRequest, fetcher } from "@/lib/api";
import { canManageMeters } from "@/lib/auth";
import { applyServerFieldErrors } from "@/lib/forms";
import { useToasts } from "@/context/ToastContext";
import { Field, Input, Select, Textarea } from "@/components/ui/Fields";
import { QuickEditFormShell } from "@/components/ui/QuickEditFormShell";
import RecordStateAlert from '@/components/ui/RecordStateAlert';

export function MeterQuickEditForm({ meter, currentUser, onSuccess, onCancel }) {
  const { showToast } = useToasts();
  const [apiError, setApiError] = useState("");
  const isEditing = !!meter?.meter_id;
  const readOnly = isEditing && !canManageMeters(currentUser);

  const { data: utilitiesData } = useSWR("/api/utilities", fetcher);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      serial_number: meter?.serial_number || "",
      utility_id: meter?.utility_id ? String(meter.utility_id) : "",
      status: meter?.status || "active",
      location: meter?.location || "",
      remarks: meter?.remarks || "",
    },
  });

  const onSubmit = async (values) => {
    setApiError("");
    if (readOnly) return;
    try {
      if (isEditing) {
        await apiRequest(`/api/meters/${meter.meter_id}`, {
          method: "PUT",
          body: JSON.stringify({
            ...values,
            utility_id: Number(values.utility_id),
          }),
        });
        showToast(`Hardware record ${values.serial_number} updated.`, "success");
      } else {
        await apiRequest("/api/meters", {
          method: "POST",
          body: JSON.stringify({
            ...values,
            utility_id: Number(values.utility_id),
          }),
        });
        showToast(`New meter ${values.serial_number} registered.`, "success");
      }

      onSuccess();
    } catch (error) {
      applyServerFieldErrors(error, setError, { setApiError });
    }
  };

  return (
    <QuickEditFormShell
      onSubmit={handleSubmit(onSubmit)}
      isSubmitting={isSubmitting}
      apiError={apiError}
      onCancel={onCancel}
      submitLabel={isEditing ? "Update Meter" : "Register Hardware"}
    >
      {isEditing && (
        <RecordStateAlert variant="info" className="mb-6">
          Serial number and utility type are immutable after registration to preserve reading history integrity (BR-MET-001).
        </RecordStateAlert>
      )}
      <div>
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400 mb-4 flex items-center gap-2">
          <Settings size={12} /> Hardware ID
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Serial Number" required error={errors.serial_number?.message}>
            <Input className="!h-10 border-stone-200 font-bold font-mono tracking-wider" disabled={readOnly || isEditing} {...register("serial_number", { required: "Required" })} />
          </Field>
          <Field label="Utility Type" required error={errors.utility_id?.message}>
            <Select className="!h-10 border-stone-200" disabled={readOnly || isEditing} {...register("utility_id", { required: "Required" })}>
              <option value="">Select utility...</option>
              {(utilitiesData || []).map(u => <option key={u.utility_id} value={u.utility_id}>{u.name}</option>)}
            </Select>
          </Field>
          <Field label="Operational Status" required>
            <Select className="!h-10 border-stone-200" disabled={readOnly} {...register("status")}>
              <option value="active">Active</option>
              <option value="maintenance">Maintenance</option>
              <option value="archived">Archived</option>
            </Select>
          </Field>
          <Field label="Physical Location" error={errors.location?.message}>
            <Input placeholder="Panel A" className="!h-10 border-stone-200 font-medium" disabled={readOnly} {...register("location")} />
          </Field>
        </div>
      </div>

      <div>
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400 mb-4 flex items-center gap-2">
          <Info size={12} /> Notes
        </h3>
        <Field label="Remarks">
          <Textarea rows={3} placeholder="Internal metrology notes..." className="border-stone-200" disabled={readOnly} {...register("remarks")} />
        </Field>
      </div>
    </QuickEditFormShell>
  );
}
