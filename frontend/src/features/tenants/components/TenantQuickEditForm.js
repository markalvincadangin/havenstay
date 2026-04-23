"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { Phone, ShieldAlert } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { applyServerFieldErrors } from "@/lib/forms";
import { Field, Input } from "@/components/ui/Fields";
import { QuickEditFormShell } from "@/components/ui/QuickEditFormShell";
import { useToasts } from "@/context/ToastContext";

const PH_MOBILE_REGEX = /^(09\d{9}|(\+639)\d{9})$/;

export function TenantQuickEditForm({ tenant, onSuccess, onCancel }) {
  const { showToast } = useToasts();
  const [apiError, setApiError] = useState("");

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      contact_number: tenant.contact_number || "",
      email: tenant.email || "",
      emergency_contact_name: tenant.emergency_contact_name || "",
      emergency_contact_number: tenant.emergency_contact_number || "",
    },
  });

  const onSubmit = async (values) => {
    setApiError("");
    try {
      await apiRequest(`/api/tenants/${tenant.tenant_id}`, {
        method: "PUT",
        body: JSON.stringify({
          ...values,
          contact_number: values.contact_number?.trim(),
          email: values.email?.trim() || null,
          emergency_contact_name: values.emergency_contact_name?.trim(),
          emergency_contact_number: values.emergency_contact_number?.trim(),
        }),
      });

      showToast(`Contact info updated for ${tenant.first_name}.`, "success");
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
    >
      <div>
        <h3 className="hs-strip-title text-[10px] uppercase tracking-[0.2em] text-stone-400 mb-4 flex items-center gap-2">
          <Phone size={12} /> Contact Details
        </h3>
        <div className="space-y-4">
          <Field label="Mobile Number" required error={errors.contact_number?.message}>
            <Input
              className="!h-11 font-mono tabular-nums border-stone-200"
              {...register("contact_number", {
                required: "Mobile number is required for residency records.",
                pattern: { value: PH_MOBILE_REGEX, message: "Use a valid local PH mobile format." }
              })}
            />
          </Field>
          <Field label="Email Address" error={errors.email?.message}>
            <Input
              type="email"
              className="!h-11 border-stone-200"
              {...register("email")}
            />
          </Field>
        </div>
      </div>

      <div>
        <h3 className="hs-strip-title text-[10px] uppercase tracking-[0.2em] text-stone-400 mb-4 flex items-center gap-2">
          <ShieldAlert size={12} /> Emergency Contact
        </h3>
        <div className="space-y-4">
          <Field label="Contact Person" required error={errors.emergency_contact_name?.message}>
            <Input
              className="!h-11 border-stone-200"
              {...register("emergency_contact_name", { required: "A proxy name is required for security incidents." })}
            />
          </Field>
          <Field label="Contact Number" required error={errors.emergency_contact_number?.message}>
            <Input
              className="!h-11 font-mono tabular-nums border-stone-200"
              {...register("emergency_contact_number", {
                required: "Emergency phone number is required for safety.",
                pattern: { value: PH_MOBILE_REGEX, message: "Use a valid local PH mobile format." },
              })}
            />
          </Field>
        </div>
      </div>

    </QuickEditFormShell>
  );
}
