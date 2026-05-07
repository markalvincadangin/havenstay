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
import ResourceIdCell from "@/components/ui/ResourceIdCell";
import { StatusBadge } from "@/components/ui/StatusBadge";

export function UserQuickEditForm({ user, onSuccess, onCancel }) {
  const { showToast } = useToasts();
  const { user: currentUser } = useAuth();
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
      password: "",
      password_confirmation: "",
    },
  });

  const isSelf = isEditing && String(user.user_id) === String(currentUser?.user_id);

  const onSubmit = async (values) => {
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
      applyServerFieldErrors(error, setError, { showToast });
    }
  };

  return (
    <QuickEditFormShell
      onSubmit={handleSubmit(onSubmit)}
      isSubmitting={isSubmitting}
      onCancel={onCancel}
      submitLabel={isEditing ? "Update User" : "Register Staff"}
    >
      <div className="space-y-8">
        {isEditing && (
          <div className="flex items-center justify-between border-b border-stone-100 pb-6">
            <div className="space-y-1">
              <h4 className="text-lg font-black text-stone-900 line-clamp-1">
                {user?.last_name}, {user?.first_name}
              </h4>
            </div>
            <div className="flex flex-col items-end gap-2">
              <ResourceIdCell type="user" id={user?.user_id} />
              <StatusBadge size="sm" variant={user?.is_active ? "success" : "neutral"}>
                {user?.is_active ? "active" : "inactive"}
              </StatusBadge>
            </div>
          </div>
        )}

        <div className="space-y-6">
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
          </div>
        </div>

        <div>
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400 mb-4 flex items-center gap-2">
            <Key size={12} /> Password
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="New Password" error={errors.password?.message}>
              <Input type="password" placeholder="Min 8 characters" className="!h-10 border-stone-200 font-mono" autoComplete="new-password" {...register("password")} />
            </Field>
            <Field label="Confirm Password" error={errors.password_confirmation?.message}>
              <Input type="password" placeholder="Confirm" className="!h-10 border-stone-200 font-mono" autoComplete="new-password" {...register("password_confirmation")} />
            </Field>
          </div>
        </div>
      </div>
    </QuickEditFormShell>
  );
}
