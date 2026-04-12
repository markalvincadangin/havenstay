"use client";

import { motion, useReducedMotion } from "framer-motion";
import { User, Shield, ArrowLeft, Key, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { apiRequest } from "../../../lib/api";
import { canManageUsers } from "../../../lib/auth";
import { useAuthGuard } from "../../../hooks/useAuthGuard";
import { flattenApiErrors } from "../../../lib/errors";
import { useUnsavedChangesWarning } from "../../../lib/useUnsavedChangesWarning";
import Alert from "../../_components/ui/Alert";
import { AppMain } from "../../_components/ui/AppShell";
import Button from "../../_components/ui/Button";
import { Card } from "../../_components/ui/Card";
import { Field, Input, Select } from "../../_components/ui/Fields";
import PageHeader from "../../_components/ui/PageHeader";
import Spinner from "../../_components/ui/Spinner";
import UserRoleBadge from "../../_components/ui/UserRoleBadge";
import Breadcrumbs from "../../_components/ui/Breadcrumbs";

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.2, ease: "easeOut" },
};

export default function NewUserPage() {
  const router = useRouter();
  const { user: currentUser, authLoading } = useAuthGuard();
  const shouldReduceMotion = useReducedMotion();
  const [apiError, setApiError] = useState("");
  const [roles, setRoles] = useState([]);
  const [loadingRoles, setLoadingRoles] = useState(true);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({
    defaultValues: {
      first_name: "",
      last_name: "",
      username: "",
      email: "",
      password: "",
      role_id: "",
    },
  });

  useUnsavedChangesWarning(isDirty && !isSubmitting);

  useEffect(() => {
    async function fetchRoles() {
      try {
        const data = await apiRequest("/api/users/roles", { method: "GET" });
        setRoles(
          Array.isArray(data)
            ? data
            : [
                { role_id: 1, role_name: "admin" },
                { role_id: 2, role_name: "staff" },
                { role_id: 3, role_name: "viewer" },
              ],
        );
      } catch {
        setRoles([
          { role_id: 1, role_name: "admin" },
          { role_id: 2, role_name: "staff" },
          { role_id: 3, role_name: "viewer" },
        ]);
      } finally {
        setLoadingRoles(false);
      }
    }
    fetchRoles();
  }, []);

  const onSubmit = async (values) => {
    setApiError("");
    if (!canManageUsers(currentUser)) return;

    try {
      await apiRequest("/api/users", {
        method: "POST",
        body: JSON.stringify({
          ...values,
          role_id: Number(values.role_id),
        }),
      });

      router.push("/users");
    } catch (error) {
      setApiError(flattenApiErrors(error));
    }
  };

  if (authLoading || loadingRoles) {
    return (
      <AppMain>
        <Spinner label="Initializing form…" />
      </AppMain>
    );
  }

  const readOnly = !canManageUsers(currentUser);

  return (
    <AppMain>
      <motion.div
        className="mx-auto mt-8 w-full max-w-4xl space-y-6"
        initial={shouldReduceMotion ? false : pageVariants.initial}
        animate={shouldReduceMotion ? false : pageVariants.animate}
        transition={shouldReduceMotion ? { duration: 0 } : pageVariants.transition}
      >
        <PageHeader
          title="Register Account"
          subtitle="Create a new system account with specific role-based permissions."
          breadcrumbs={
            <Breadcrumbs
              items={[{ label: "User Directory", href: "/users" }, { label: "Register account" }]}
            />
          }
          actions={
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => router.push("/users")}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-500 transition-colors hover:bg-stone-50"
                aria-label="Back to User Directory"
                title="Back to User Directory"
              >
                <ArrowLeft size={18} aria-hidden />
              </button>
              <div className="border-l border-stone-200 pl-3">
                <UserRoleBadge username={currentUser?.username} roleName={currentUser?.role?.role_name} />
              </div>
            </div>
          }
        />

        {readOnly ? (
          <Alert variant="warning" title="Access Denied">
            Only administrators are authorized to register new system users.
          </Alert>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
              <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/50 px-8 py-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-600 shadow-sm border border-teal-100/50">
                    <User size={16} aria-hidden />
                  </div>
                  <h2 className="hs-strip-title uppercase tracking-widest text-xs font-black text-stone-900">Identity Details</h2>
                </div>
              </div>

              <div className="p-8">
                <div className="grid gap-6 sm:grid-cols-2">
                  <Field label="First Name" required error={errors.first_name?.message}>
                    <Input
                      autoFocus
                      placeholder="e.g. Juan"
                      className="!h-11 border-stone-200"
                      {...register("first_name", { required: "First name is required." })}
                    />
                  </Field>
                  <Field label="Last Name" required error={errors.last_name?.message}>
                    <Input
                      placeholder="e.g. Dela Cruz"
                      className="!h-11 border-stone-200"
                      {...register("last_name", { required: "Last name is required." })}
                    />
                  </Field>
                  <Field label="Username" required error={errors.username?.message}>
                    <Input
                      placeholder="jdelacruz"
                      className="!h-11 border-stone-200 font-mono text-sm"
                      {...register("username", { 
                        required: "Username is required.",
                        minLength: { value: 4, message: "Minimum 4 characters." }
                      })}
                    />
                  </Field>
                  <Field label="Email Address" required error={errors.email?.message}>
                    <Input
                      type="email"
                      placeholder="juan@havenstay.ph"
                      className="!h-11 border-stone-200"
                      {...register("email", { 
                        required: "Email is required.",
                        pattern: {
                          value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                          message: "Invalid email address."
                        }
                      })}
                    />
                  </Field>
                </div>
              </div>
            </Card>

            <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
              <div className="flex items-center gap-3 border-b border-stone-100 bg-stone-50/50 px-8 py-5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-700 shadow-sm border border-amber-100/50">
                  <Shield size={16} aria-hidden />
                </div>
                <h2 className="hs-strip-title uppercase tracking-widest text-xs font-black text-stone-900">System Access</h2>
              </div>

              <div className="p-8">
                <div className="grid gap-6 sm:grid-cols-2">
                  <Field label="System Role" required error={errors.role_id?.message}>
                    <Select
                      className="!h-11 border-stone-200"
                      {...register("role_id", { required: "Select a role." })}
                    >
                      <option value="">Select a role…</option>
                      {roles.map(r => (
                        <option key={r.role_id} value={r.role_id}>
                          {r.role_name.charAt(0).toUpperCase() + r.role_name.slice(1)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Temporary Password" required error={errors.password?.message}>
                    <div className="relative">
                      <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-300" size={16} />
                      <Input
                        type="password"
                        className="!h-11 border-stone-200 pl-10"
                        {...register("password", { 
                          required: "Password is required.",
                          minLength: { value: 8, message: "Use at least 8 characters." }
                        })}
                      />
                    </div>
                  </Field>
                </div>
              </div>
            </Card>

            {apiError && <Alert variant="error" title="Submission Error">{apiError}</Alert>}

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
                <UserPlus size={14} className="mr-2" />
                Register Account
              </Button>
            </div>
          </form>
        )}
      </motion.div>
    </AppMain>
  );
}
