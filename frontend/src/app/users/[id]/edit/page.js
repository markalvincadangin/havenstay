"use client";

import { Shield, Key, Edit3, Activity, ShieldAlert } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import useSWR from "swr";
import { useForm } from "react-hook-form";

import { apiRequest, fetcher } from "../../../../lib/api";
import { canManageUsers } from "../../../../lib/auth";
import { USER_ROLE_FALLBACK_OPTIONS } from "../../../../lib/constants";
import { applyServerFieldErrors } from "../../../../lib/forms";
import { formatDateString } from "../../../../lib/formatters";
import { normalizePaginatedList } from "../../../../lib/pagination";
import { useUnsavedChangesWarning } from "../../../../lib/useUnsavedChangesWarning";
import Alert from "../../../_components/ui/Alert";
import Button from "../../../_components/ui/Button";
import { Card } from "../../../_components/ui/Card";
import { Field, Input, Select } from "../../../_components/ui/Fields";
import Breadcrumbs from "../../../_components/ui/Breadcrumbs";
import { Table } from "../../../_components/ui/Table";
import StandardPage from "../../../_components/ui/StandardPage";
import { StatusBadge } from "../../../_components/ui/StatusBadge";
import { FormSection } from "../../../_components/ui/FormSection";
import { primaryLinkCtaClass } from "../../../_components/ui/LinkTokens";
import PageHeaderActions from "../../../_components/ui/PageHeaderActions";
import { useAuth } from "../../../_context/AuthContext";

export default function EditUserPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params?.id;
  
  const { user: currentUser } = useAuth();
  const [apiError, setApiError] = useState("");
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setError,
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

  const canManage = useMemo(() => canManageUsers(currentUser), [currentUser]);

  const { data: uData, error: uError } = useSWR(
    currentUser && userId && canManage ? `/api/users/${userId}` : null,
    fetcher
  );

  const { data: rData } = useSWR(
    currentUser && canManage ? `/api/users/roles` : null,
    fetcher,
    {
      fallbackData: USER_ROLE_FALLBACK_OPTIONS
    }
  );

  const { data: aData } = useSWR(
    currentUser && userId && canManage ? `/api/audit-logs?user_id=${userId}&limit=10` : null,
    fetcher,
    { fallbackData: { data: [], meta: { total: 0 } } }
  );

  const loading = !uData && !uError;

  useEffect(() => {
    if (uData) {
      reset({
        first_name: uData.first_name || "",
        last_name: uData.last_name || "",
        username: uData.username || "",
        email: uData.email || "",
        role_id: uData.role_id || "",
        is_active: Boolean(uData.is_active),
        password: "",
        password_confirmation: "",
      });
    }
  }, [uData, reset]);

  const rolesList = useMemo(() => (Array.isArray(rData) ? rData : []), [rData]);
  const auditLogsList = useMemo(() => normalizePaginatedList(aData).rows, [aData]);

  const onSubmit = async (values) => {
    setApiError("");
    const pwd = values.password?.trim() ?? "";
    const pwd2 = values.password_confirmation?.trim() ?? "";
    
    if (pwd || pwd2) {
      if (pwd.length < 8) {
        setError("password", { type: "manual", message: "New password must be at least 8 characters." });
        return;
      }
      if (pwd !== pwd2) {
        setError("password_confirmation", { type: "manual", message: "Password confirmation does not match." });
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
      await apiRequest(`/api/users/${userId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      router.push("/users");
    } catch (error) {
      applyServerFieldErrors(error, setError, { setApiError });
    }
  };

  const handleArchiveUser = async () => {
    if (!userId) return;
    setApiError("");
    setIsArchiving(true);
    try {
      await apiRequest(`/api/users/${userId}/archive`, { method: "POST" });
      setShowArchiveModal(false);
      router.push("/users");
    } catch (err) {
      setApiError(err?.message || "Failed to archive user.");
    } finally {
      setIsArchiving(false);
    }
  };

  const isSelf = String(userId) === String(currentUser?.user_id);
  const title = uData ? `User Profile: ${uData.username}` : "Edit User Account";

  return (
    <StandardPage
      title={title}
      subtitle="Update staff identity, contact details, or role permissions."
      loading={loading}
      error={uError}
      breadcrumbs={
        <Breadcrumbs
          items={[
            { label: "Administration", href: "/users" },
            { label: "User Directory", href: "/users" },
            { label: uData?.username || "Edit User" }
          ]}
        />
      }
      actions={
        <PageHeaderActions
          backHref="/users"
          backLabel="Back to User Directory"
          user={currentUser}
        />
      }
    >
      <div className="mx-auto w-full max-w-4xl space-y-6">
        {!canManage && (
          <Alert variant="warning" title="Access Restricted">
            Only administrators are authorized to manage system user accounts.
          </Alert>
        )}

        {showArchiveModal ? (
          <Card className="border-rose-200 bg-rose-50/50 p-8 shadow-xl shadow-rose-900/5">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-rose-700">
                  <ShieldAlert size={20} />
                  <h3 className="font-black uppercase tracking-widest text-sm">Terminate Account</h3>
                </div>
                <p className="text-sm font-medium text-rose-600/80 leading-relaxed max-w-xl">
                  You are about to archive <span className="font-bold">@{uData?.username}</span>. This will revoke all system access while preserving their audit history.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="secondary" onClick={() => setShowArchiveModal(false)} disabled={isArchiving} className="!h-10 rounded-xl px-6">
                  Cancel
                </Button>
                <Button variant="danger" onClick={handleArchiveUser} loading={isArchiving} className="!h-10 rounded-xl px-8 shadow-lg shadow-rose-900/10">
                  Confirm Archive
                </Button>
              </div>
            </div>
          </Card>
        ) : null}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <FormSection title="Identity Details" icon={Edit3}>
            <div className="grid gap-6 sm:grid-cols-2">
              <Field label="First Name" required error={errors.first_name?.message}>
                <Input
                  className="!h-12 border-stone-200 font-bold"
                  {...register("first_name", { required: "First name is required." })}
                />
              </Field>
              <Field label="Last Name" required error={errors.last_name?.message}>
                <Input
                  className="!h-12 border-stone-200 font-bold"
                  {...register("last_name", { required: "Last name is required." })}
                />
              </Field>
              <Field label="Username" required error={errors.username?.message}>
                <Input
                  className="!h-12 border-stone-200 font-mono font-bold"
                  {...register("username", { required: "Username is required." })}
                />
              </Field>
              <Field label="Email Address" required error={errors.email?.message}>
                <Input
                  type="email"
                  className="!h-12 border-stone-200 font-bold"
                  {...register("email", { 
                    required: "Email is required.",
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: "Invalid email pattern."
                    }
                  })}
                />
              </Field>
            </div>
          </FormSection>

          <FormSection title="Access Control" icon={Shield}>
            <div className="grid gap-8 sm:grid-cols-2">
              <Field label="System Role" required error={errors.role_id?.message}>
                <Select
                  className="!h-12 border-stone-200 font-bold"
                  disabled={isSelf}
                  {...register("role_id", { required: "A system role must be assigned." })}
                >
                  <option value="">Select Role…</option>
                  {rolesList.map(r => (
                    <option key={r.role_id} value={r.role_id}>
                      {r.role_name.toUpperCase()}
                    </option>
                  ))}
                </Select>
                {isSelf && <p className="mt-2 text-[10px] text-stone-400 font-bold uppercase italic">Permission locked (Self-management)</p>}
              </Field>
              
              <div className="rounded-2xl border border-stone-100 bg-stone-50/30 p-6 flex flex-col justify-center">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    disabled={isSelf}
                    className="mt-1 h-5 w-5 rounded-lg border-stone-300 text-teal-600 focus:ring-teal-500/20 disabled:opacity-50"
                    {...register("is_active")}
                  />
                  <div>
                    <span className="block text-xs font-black uppercase tracking-widest text-stone-900">Account Active</span>
                    <span className="mt-1 block text-[10px] font-medium text-stone-400">
                      {isSelf ? "Self-account state cannot be changed." : "Uncheck to revoke all system access immediately."}
                    </span>
                  </div>
                </label>
              </div>
            </div>
          </FormSection>

          <FormSection title="Security Credentials" icon={Key} subtitle="Optional: Enter a new password to reset security credentials.">
            <div className="grid gap-6 sm:grid-cols-2">
              <Field label="New Password" error={errors.password?.message}>
                <Input
                  type="password"
                  autoComplete="new-password"
                  placeholder="Minimum 8 characters"
                  className="!h-12 border-stone-200 font-mono"
                  {...register("password")}
                />
              </Field>
              <Field label="Confirm Selection" error={errors.password_confirmation?.message}>
                <Input
                  type="password"
                  autoComplete="new-password"
                  className="!h-12 border-stone-200 font-mono"
                  {...register("password_confirmation")}
                />
              </Field>
            </div>
          </FormSection>

          {apiError && <Alert variant="error" title="Submission Error">{apiError}</Alert>}

          <div className="flex flex-col-reverse gap-3 border-t border-stone-100 pt-8 sm:flex-row sm:items-center sm:justify-end">
             {!isSelf && canManage && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowArchiveModal(true)}
                disabled={isSubmitting || isArchiving}
                className="!h-11 rounded-xl border border-rose-100 px-8 text-[10px] font-black uppercase tracking-widest text-rose-600 hover:bg-rose-50"
              >
                Archive User
              </Button>
            )}
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push("/users")}
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
              Update Profile
            </Button>
          </div>
        </form>

        <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm mt-12">
            <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/50 px-8 py-5">
                <div className="flex items-center gap-3">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 shadow-sm border border-indigo-100/50">
                        <Activity size={16} />
                    </div>
                    <h3 className="hs-strip-title uppercase tracking-widest text-[10px] font-black text-stone-400">Activity Forensic Log</h3>
                </div>
            </div>
            <Table 
                embedded
                columns={[
                    { key: 'date', label: 'Timestamp', className: "w-48" },
                    { key: 'action', label: 'Action' },
                    { key: 'entity', label: 'Reference' }
                ]}
                rows={auditLogsList.map((log) => (
                    <tr key={log.id} className="border-t border-stone-100/80 hover:bg-stone-50/50 transition-colors">
                        <td className="px-6 py-4">
                            <div className="flex flex-col">
                                <span className="font-mono text-[10px] font-bold text-stone-900 tabular-nums">
                                    {formatDateString(log.changed_at)}
                                </span>
                                <span className="text-[9px] font-medium text-stone-400 uppercase tracking-tighter">
                                    {new Date(log.changed_at).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit", second: "2-digit" })}
                                </span>
                            </div>
                        </td>
                        <td className="px-6 py-4">
                            <StatusBadge size="sm">{log.action}</StatusBadge>
                        </td>
                        <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                                <span className="text-[11px] font-black text-stone-700 capitalize tracking-tight">{log.target_table}</span>
                                <span className="font-mono text-[10px] font-bold text-stone-300">#{log.record_id}</span>
                            </div>
                        </td>
                    </tr>
                ))}
            />
            {auditLogsList.length === 0 && (
                <div className="p-12 flex flex-col items-center justify-center text-center">
                    <Activity size={32} className="text-stone-100 mb-3" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-stone-300">No forensic entry on record</p>
                </div>
            )}
        </Card>
      </div>
    </StandardPage>
  );
}
