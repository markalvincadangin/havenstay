"use client";

import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import useSWR from "swr";
import { Shield, Key, Edit3 } from "lucide-react";

import { apiRequest, fetcher } from "@/lib/api";
import { applyServerFieldErrors } from "@/lib/forms";
import { USER_ROLE_FALLBACK_OPTIONS } from "@/lib/constants";
import { Field, Input, Select } from "@/components/ui/Fields";
import { QuickEditFormShell } from "@/components/ui/QuickEditFormShell";
import { useToasts } from "@/context/ToastContext";
import { useAuth } from "@/context/AuthContext";

export function UserQuickEditForm({ user, onSuccess, onCancel }) {
  const { showToast } = useToasts();
  const { user: currentUser } = useAuth();
  const [apiError, setApiError] = useState("");
  const isEditing = !!user?.user_id;

  const { data: rData } = useSWR("/api/users/roles", fetcher, {
    fallbackData: USER_ROLE_FALLBACK_OPTIONS
  });
  const rolesList = useMemo(() => (Array.isArray(rData) ? rData : []), [rData]);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      first_name: user?.first_name || "",
      last_name: user?.last_name || "",
      username: user?.username || "",
      email: user?.email || "",
      role_id: user?.role_id || "",
      is_active: user ? Boolean(user.is_active) : true,
      password: "",
      password_confirmation: "",
    },
  });

  const isSelf = isEditing && String(user.user_id) === String(currentUser?.user_id);

  const onSubmit = async (values) => {
    setApiError("");
    const pwd = values.password?.trim() ?? "";
    const pwd2 = values.password_confirmation?.trim() ?? "";
    
    if (pwd || pwd2 || !isEditing) {
      if (pwd.length < 8) {
        setError("password", { type: "manual", message: "Minimum 8 characters." });
        return;
      }
      if (pwd !== pwd2) {
        setError("password_confirmation", { type: "manual", message: "Confirmation does not match." });
        return;
      }
    }

    const payload = {
      first_name: values.first_name,
      last_name: values.last_name,
      username: values.username,
      email: values.email,
      role_id: Number(values.role_id),
      is_active: Boolean(values.is_active),
      ...(pwd ? { password: pwd } : {})
    };

    try {
      if (isEditing) {
        await apiRequest(`/api/users/${user.user_id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        showToast(`User @${user.username} updated.`, "success");
      } else {
        await apiRequest("/api/users", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        showToast(`User @${values.username} registered.`, "success");
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
      submitLabel={isEditing ? "Update User" : "Register Staff"}
    >
      <div>
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400 mb-4 flex items-center gap-2">
          <Edit3 size={12} /> Identity Details
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First Name" required error={errors.first_name?.message}>
            <Input className="!h-10 border-stone-200" {...register("first_name", { required: "Required" })} />
          </Field>
          <Field label="Last Name" required error={errors.last_name?.message}>
            <Input className="!h-10 border-stone-200" {...register("last_name", { required: "Required" })} />
          </Field>
          <Field label="Username" required error={errors.username?.message}>
            <Input className="!h-10 border-stone-200 font-mono" {...register("username", { required: "Required" })} />
          </Field>
          <Field label="Email Address" required error={errors.email?.message}>
            <Input type="email" className="!h-10 border-stone-200" {...register("email", { required: "Required" })} />
          </Field>
        </div>
      </div>

      <div>
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400 mb-4 flex items-center gap-2">
          <Shield size={12} /> Access Control
        </h3>
        <div className="space-y-4">
          <Field label="System Role" required error={errors.role_id?.message}>
            <Select disabled={isSelf} className="!h-10 border-stone-200 font-bold" {...register("role_id", { required: "Role required" })}>
              <option value="">Select Role…</option>
              {rolesList.map(r => <option key={r.role_id} value={r.role_id}>{r.role_name.toUpperCase()}</option>)}
            </Select>
          </Field>
          
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-stone-100 bg-stone-50/50 p-4">
            <input
              type="checkbox"
              disabled={isSelf}
              className="mt-0.5 h-4 w-4 rounded border-stone-300 text-teal-600 focus:ring-teal-500/20 disabled:opacity-50"
              {...register("is_active")}
            />
            <div>
              <span className="block text-xs font-black uppercase tracking-widest text-stone-900">Account Active</span>
              <span className="mt-1 block text-[10px] font-medium text-stone-400">
                {isSelf ? "Self-account state cannot be changed." : "Uncheck to revoke system access."}
              </span>
            </div>
          </label>
        </div>
      </div>

      <div>
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400 mb-4 flex items-center gap-2">
          <Key size={12} /> Security Credentials
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="New Password (Optional)" error={errors.password?.message}>
            <Input type="password" placeholder="Min 8 characters" className="!h-10 border-stone-200 font-mono" autoComplete="new-password" {...register("password")} />
          </Field>
          <Field label="Confirm Selection" error={errors.password_confirmation?.message}>
            <Input type="password" placeholder="Confirm" className="!h-10 border-stone-200 font-mono" autoComplete="new-password" {...register("password_confirmation")} />
          </Field>
        </div>
      </div>
    </QuickEditFormShell>
  );
}
