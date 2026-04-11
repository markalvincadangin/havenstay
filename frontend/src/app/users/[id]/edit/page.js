"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Shield, ArrowLeft, Key, Edit3 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { apiRequest } from "../../../../lib/api";
import { canManageUsers } from "../../../../lib/auth";
import { useAuthGuard } from "../../../../hooks/useAuthGuard";
import { flattenApiErrors } from "../../../../lib/errors";
import { useUnsavedChangesWarning } from "../../../../lib/useUnsavedChangesWarning";
import Alert from "../../../_components/ui/Alert";
import { AppMain } from "../../../_components/ui/AppShell";
import Button from "../../../_components/ui/Button";
import { Card } from "../../../_components/ui/Card";
import { Field, Input, Select } from "../../../_components/ui/Fields";
import PageHeader from "../../../_components/ui/PageHeader";
import Spinner from "../../../_components/ui/Spinner";
import UserRoleBadge from "../../../_components/ui/UserRoleBadge";
import Breadcrumbs from "../../../_components/ui/Breadcrumbs";

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.2, ease: "easeOut" },
};

export default function EditUserPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params?.id;
  
  const { user: currentUser, authLoading } = useAuthGuard();
  const shouldReduceMotion = useReducedMotion();
  const [apiError, setApiError] = useState("");
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewDenied, setViewDenied] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({
    defaultValues: {
      first_name: "",
      last_name: "",
      username: "",
      email: "",
      role_id: "",
      is_active: true,
      password: "",
      password_confirmation: "",
    },
  });

  useUnsavedChangesWarning(isDirty && !isSubmitting);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setViewDenied(false);
    try {
      const [uData, rData] = await Promise.all([
        apiRequest(`/api/users/${userId}`, { method: "GET" }),
        apiRequest("/api/users/roles", { method: "GET" }).catch(() => [
          { role_id: 1, role_name: "admin" },
          { role_id: 2, role_name: "staff" },
          { role_id: 3, role_name: "viewer" },
        ]),
      ]);

      setRoles(Array.isArray(rData) ? rData : []);
      reset({
        first_name: uData.first_name,
        last_name: uData.last_name,
        username: uData.username,
        email: uData.email || "",
        role_id: uData.role_id,
        is_active: Boolean(uData.is_active),
        password: "",
        password_confirmation: "",
      });
    } catch (error) {
      if (error?.status === 403) {
        setViewDenied(true);
      } else {
        setApiError(flattenApiErrors(error));
      }
    } finally {
      setLoading(false);
    }
  }, [userId, reset]);

  useEffect(() => {
    if (authLoading || !currentUser || !userId) return;
    if (!canManageUsers(currentUser)) {
      setViewDenied(true);
      setLoading(false);
      return;
    }
    fetchData();
  }, [authLoading, currentUser, userId, fetchData]);

  const onSubmit = async (values) => {
    setApiError("");
    if (!canManageUsers(currentUser)) return;

    const pwd = values.password?.trim() ?? "";
    const pwd2 = values.password_confirmation?.trim() ?? "";
    if (pwd || pwd2) {
      if (pwd.length < 8) {
        setApiError("New password must be at least 8 characters.");
        return;
      }
      if (pwd !== pwd2) {
        setApiError("Password confirmation does not match.");
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
    };
    if (pwd) {
      payload.password = pwd;
    }

    try {
      await apiRequest(`/api/users/${userId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      router.push("/users");
    } catch (error) {
      setApiError(flattenApiErrors(error));
    }
  };

  if (authLoading || loading) {
    return (
      <AppMain>
        <Spinner label="Loading account details…" />
      </AppMain>
    );
  }

  const readOnly = !canManageUsers(currentUser);
  const isSelf = String(userId) === String(currentUser?.user_id);

  if (viewDenied || readOnly) {
    return (
      <AppMain>
        <motion.div
          className="mx-auto mt-8 w-full max-w-4xl space-y-6"
          initial={shouldReduceMotion ? false : pageVariants.initial}
          animate={shouldReduceMotion ? false : pageVariants.animate}
          transition={shouldReduceMotion ? { duration: 0 } : pageVariants.transition}
        >
          <PageHeader
            title="Edit User Account"
            subtitle="Update staff identity, contact details, or role permissions."
            breadcrumbs={
              <Breadcrumbs
                items={[{ label: "User Management", href: "/users" }, { label: "Edit user" }]}
              />
            }
            actions={
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => router.push("/users")}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-500 transition-colors hover:bg-stone-50"
                  aria-label="Back to User Registry"
                >
                  <ArrowLeft size={18} aria-hidden />
                </button>
                <div className="border-l border-stone-200 pl-3">
                  <UserRoleBadge username={currentUser?.username} roleName={currentUser?.role?.role_name} />
                </div>
              </div>
            }
          />
          <Alert variant="warning" title="Access restricted">
            Only administrators can view or edit system user accounts.
          </Alert>
        </motion.div>
      </AppMain>
    );
  }

  return (
    <AppMain>
      <motion.div
        className="mx-auto mt-8 w-full max-w-4xl space-y-6"
        initial={shouldReduceMotion ? false : pageVariants.initial}
        animate={shouldReduceMotion ? false : pageVariants.animate}
        transition={shouldReduceMotion ? { duration: 0 } : pageVariants.transition}
      >
        <PageHeader
          title="Edit User Account"
          subtitle="Update staff identity, contact details, or role permissions."
          breadcrumbs={
            <Breadcrumbs
              items={[{ label: "User Management", href: "/users" }, { label: "Edit user" }]}
            />
          }
          actions={
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => router.push("/users")}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-500 transition-colors hover:bg-stone-50"
                aria-label="Back to User Registry"
              >
                <ArrowLeft size={18} aria-hidden />
              </button>
              <div className="border-l border-stone-200 pl-3">
                <UserRoleBadge username={currentUser?.username} roleName={currentUser?.role?.role_name} />
              </div>
            </div>
          }
        />

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
            <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/50 px-8 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                  <Edit3 size={16} aria-hidden />
                </div>
                <h2 className="hs-strip-title">Account Identity</h2>
              </div>
            </div>

            <div className="p-8">
              <div className="grid gap-6 sm:grid-cols-2">
                <Field label="First Name" required error={errors.first_name?.message}>
                  <Input
                    className="!h-11 border-stone-200"
                    {...register("first_name", { required: "First name is required." })}
                  />
                </Field>
                <Field label="Last Name" required error={errors.last_name?.message}>
                  <Input
                    className="!h-11 border-stone-200"
                    {...register("last_name", { required: "Last name is required." })}
                  />
                </Field>
                <Field label="Username" required error={errors.username?.message}>
                  <Input
                    className="!h-11 border-stone-200 font-mono"
                    {...register("username", { required: "Username is required." })}
                  />
                </Field>
                <Field label="Email Address" required error={errors.email?.message}>
                  <Input
                    type="email"
                    className="!h-11 border-stone-200"
                    {...register("email", { 
                      required: "Email is required.",
                      pattern: {
                        value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                        message: "Invalid email."
                      }
                    })}
                  />
                </Field>
              </div>
            </div>
          </Card>

          <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
            <div className="flex items-center gap-3 border-b border-stone-100 bg-stone-50/50 px-8 py-5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                <Shield size={16} aria-hidden />
              </div>
              <h2 className="hs-strip-title">Access & Status</h2>
            </div>

            <div className="p-8">
              <div className="grid gap-6 sm:grid-cols-2">
                <Field label="System Role" required error={errors.role_id?.message}>
                  <Select
                    className="!h-11 border-stone-200"
                    disabled={isSelf}
                    {...register("role_id", { required: "Role is required." })}
                  >
                    {roles.map(r => (
                      <option key={r.role_id} value={r.role_id}>
                        {r.role_name.charAt(0).toUpperCase() + r.role_name.slice(1)}
                      </option>
                    ))}
                  </Select>
                  {isSelf && <p className="mt-2 text-[10px] text-stone-500">You cannot change your own role to prevent lockouts.</p>}
                </Field>
                <div className="flex items-end pb-2">
                   <div className="flex items-center gap-3 rounded-xl border border-stone-100 bg-stone-50/30 px-5 py-3 h-11 w-full">
                      <input
                        type="checkbox"
                        id="is_active"
                        disabled={isSelf}
                        className="h-4 w-4 rounded border-stone-300 text-teal-600 focus:ring-teal-500"
                        {...register("is_active", { valueAsBoolean: true })}
                      />
                      <label htmlFor="is_active" className="text-sm font-semibold text-stone-700">
                        Account is active
                      </label>
                   </div>
                </div>
              </div>
            </div>
          </Card>

          <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
            <div className="flex items-center gap-3 border-b border-stone-100 bg-stone-50/50 px-8 py-5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-100 text-stone-600">
                <Key size={16} aria-hidden />
              </div>
              <div>
                <h2 className="hs-strip-title">Change password</h2>
                <p className="mt-0.5 text-xs font-medium text-stone-500">Leave blank to keep the current password.</p>
              </div>
            </div>
            <div className="p-8">
              <div className="grid gap-6 sm:grid-cols-2">
                <Field label="New password" error={errors.password?.message}>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    className="!h-11 border-stone-200"
                    {...register("password")}
                  />
                </Field>
                <Field label="Confirm new password" error={errors.password_confirmation?.message}>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    className="!h-11 border-stone-200"
                    {...register("password_confirmation")}
                  />
                </Field>
              </div>
            </div>
          </Card>

          {apiError && (
            <Alert variant="error" title={loading ? "Failed to load user" : "Update Failed"}>
              {apiError}
            </Alert>
          )}

          <div className="flex items-center justify-end gap-3 pt-6">
            <Button type="button" variant="secondary" onClick={() => router.push("/users")} className="!h-11 rounded-xl px-8 text-[10px] font-bold uppercase tracking-widest">
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={isSubmitting}
              className="!h-11 rounded-xl bg-teal-600 px-12 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-teal-900/10 hover:bg-teal-700"
            >
              Save Changes
            </Button>
          </div>
        </form>
      </motion.div>
    </AppMain>
  );
}
