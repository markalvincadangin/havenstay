"use client";

import { User, Shield, Key, UserPlus } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import useSWR from "swr";

import { apiRequest, fetcher } from "../../../../lib/api";
import { canManageUsers } from "../../../../lib/auth";
import { USER_ROLE_FALLBACK_OPTIONS } from "../../../../lib/constants";
import { applyServerFieldErrors } from "../../../../lib/forms";
import { useUnsavedChangesWarning } from "../../../../hooks/useUnsavedChangesWarning";
import Alert from "../../../_components/ui/Alert";
import Button from "../../../_components/ui/Button";
import { Field, Input, Select } from "../../../_components/ui/Fields";
import Breadcrumbs from "../../../_components/ui/Breadcrumbs";
import StandardPage from "../../../_components/ui/StandardPage";
import { FormSection } from "../../../_components/ui/FormSection";
import { primaryLinkCtaClass } from "../../../_components/ui/LinkTokens";
import PageHeaderActions from "../../../_components/ui/PageHeaderActions";
import { useAuth } from "../../../_context/AuthContext";

export default function NewUserPage() {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const [apiError, setApiError] = useState("");

  const {
    register,
    handleSubmit,
    setError,
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

  const canManage = canManageUsers(currentUser);

  const { data: rolesData, isLoading: loadingRoles } = useSWR(
    currentUser && canManage ? "/api/users/roles" : null,
    fetcher,
    {
      fallbackData: USER_ROLE_FALLBACK_OPTIONS
    }
  );

  const roles = Array.isArray(rolesData) ? rolesData : [];

  const onSubmit = async (values) => {
    setApiError("");
    try {
      await apiRequest("/api/users", {
        method: "POST",
        body: JSON.stringify({
          ...values,
          role_id: Number(values.role_id),
        }),
      });
      router.push("/admin/users");
    } catch (error) {
      applyServerFieldErrors(error, setError, { setApiError });
    }
  };

  return (
    <StandardPage
      title="Register User Account"
      subtitle="Create a new staff identity with role-based access controls."
      loading={loadingRoles}
      breadcrumbs={
        <Breadcrumbs
          items={[
            { label: "Administration", href: "/admin/users" },
            { label: "User Directory", href: "/admin/users" },
            { label: "New User" }
          ]}
        />
      }
      actions={
        <PageHeaderActions
          backHref="/admin/users"
          backLabel="Back to User Directory"
          user={currentUser}
        />
      }
    >
      <div className="mx-auto w-full max-w-4xl space-y-6">
        {!canManage && (
          <Alert variant="warning" title="Access Restricted">
            Only administrators are authorized to register new system users.
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <FormSection title="Identity Details" icon={User}>
            <div className="grid gap-6 sm:grid-cols-2">
              <Field label="First Name" required error={errors.first_name?.message}>
                <Input
                  autoFocus
                  placeholder="e.g. Juan"
                  className="!h-12 border-stone-200 font-bold"
                  {...register("first_name", { required: "First name is required." })}
                />
              </Field>
              <Field label="Last Name" required error={errors.last_name?.message}>
                <Input
                  placeholder="e.g. Dela Cruz"
                  className="!h-12 border-stone-200 font-bold"
                  {...register("last_name", { required: "Last name is required." })}
                />
              </Field>
              <Field label="Username" required error={errors.username?.message}>
                <Input
                  placeholder="jdelacruz"
                  className="!h-12 border-stone-200 font-mono font-bold"
                  {...register("username", { 
                    required: "Username is required.",
                    minLength: { value: 4, message: "Use at least 4 characters." }
                  })}
                />
              </Field>
              <Field label="Email Address" required error={errors.email?.message}>
                <Input
                  type="email"
                  placeholder="juan@havenstay.ph"
                  className="!h-12 border-stone-200 font-bold"
                  {...register("email", { 
                    required: "Email is required.",
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: "Invalid email format."
                    }
                  })}
                />
              </Field>
            </div>
          </FormSection>

          <FormSection title="System Access" icon={Shield}>
            <div className="grid gap-6 sm:grid-cols-2">
              <Field label="System Role" required error={errors.role_id?.message}>
                <Select
                  className="!h-12 border-stone-200 font-bold"
                  {...register("role_id", { required: "Assign a role." })}
                >
                  <option value="">Select a role…</option>
                  {roles.map(r => (
                    <option key={r.role_id} value={r.role_id}>
                      {r.role_name.toUpperCase()}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Temporary Password" required error={errors.password?.message}>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-300" size={18} />
                  <Input
                    type="password"
                    placeholder="Minimum 8 characters"
                    className="!h-12 border-stone-200 pl-11 font-mono"
                    {...register("password", { 
                      required: "Initial password is required.",
                      minLength: { value: 8, message: "Use at least 8 characters." }
                    })}
                  />
                </div>
              </Field>
            </div>
          </FormSection>

          {apiError && <Alert variant="error" title="Submission Error">{apiError}</Alert>}

          <div className="flex flex-col-reverse gap-3 border-t border-stone-100 pt-8 sm:flex-row sm:items-center sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push("/admin/users")}
              className="!h-11 rounded-xl px-10 text-[10px] font-bold uppercase tracking-widest"
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={isSubmitting}
              className={primaryLinkCtaClass + " px-12 border-0"}
              disabled={isSubmitting || !canManage}
            >
              <UserPlus size={14} className="mr-2" />
              Register Account
            </Button>
          </div>
        </form>
      </div>
    </StandardPage>
  );
}
