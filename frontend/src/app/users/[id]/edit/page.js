"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Shield, ArrowLeft, Key, Edit3, Activity, AlertCircle } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { apiRequest } from "../../../../lib/api";
import { canManageUsers } from "../../../../lib/auth";
import { useAuthGuard } from "../../../../hooks/useAuthGuard";
import { flattenApiErrors } from "../../../../lib/errors";
import { formatDateString } from "../../../../lib/formatters";
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
import { Table } from "../../../_components/ui/Table";

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
  const [auditLogs, setAuditLogs] = useState([]);
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
      const [uData, rData, aData] = await Promise.all([
        apiRequest(`/api/users/${userId}`, { method: "GET" }),
        apiRequest("/api/users/roles", { method: "GET" }).catch(() => [
          { role_id: 1, role_name: "admin" },
          { role_id: 2, role_name: "staff" },
          { role_id: 3, role_name: "viewer" },
        ]),
        apiRequest(`/api/audit-logs?user_id=${userId}&limit=10`, { method: "GET" }).catch(() => ({ logs: [] }))
      ]);

      setRoles(Array.isArray(rData) ? rData : []);
      setAuditLogs(Array.isArray(aData?.logs) ? aData.logs : []);
      
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
                items={[{ label: "User Directory", href: "/users" }, { label: "Edit user" }]}
              />
            }
            actions={
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => router.push("/users")}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-500 transition-colors hover:bg-stone-50"
                  aria-label="Back to User Directory"
                >
                  <ArrowLeft size={18} aria-hidden />
                </button>
                <div className="border-l border-stone-200 pl-3">
                  <UserRoleBadge username={currentUser?.username} roleName={currentUser?.role?.role_name} />
                </div>
              </div>
            }
          />
          <Alert variant="warning" title="Access Denied">
            Only administrators are authorized to view or edit system user accounts.
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
              items={[{ label: "User Directory", href: "/users" }, { label: "Edit user" }]}
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

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
            <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/50 px-8 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-600 shadow-sm border border-teal-100/50">
                  <Edit3 size={16} aria-hidden />
                </div>
                <h2 className="hs-strip-title uppercase tracking-widest text-xs font-black text-stone-900">Identity Details</h2>
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
                    className="!h-11 border-stone-200 font-mono text-sm"
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
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-700 shadow-sm border border-amber-100/50">
                <Shield size={16} aria-hidden />
              </div>
              <h2 className="hs-strip-title uppercase tracking-widest text-xs font-black text-stone-900">Access Control</h2>
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
                  {isSelf && <p className="mt-2 text-[10px] text-stone-500 font-medium italic">Self-protection: Role cannot be modified while logged in.</p>}
                </Field>
                
                <div className="flex flex-col justify-end">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-2">Account Status</label>
                    <div className="flex items-center gap-3 rounded-xl border border-stone-100 bg-stone-50/50 px-5 py-3 h-11 shrink-0">
                       <input
                         type="checkbox"
                         id="is_active"
                         disabled={isSelf}
                         className="h-4 w-4 rounded border-stone-300 text-teal-600 focus:ring-teal-500 transition-all"
                         {...register("is_active", { valueAsBoolean: true })}
                       />
                       <div className="flex flex-col">
                           <label htmlFor="is_active" className="text-sm font-semibold text-stone-700 leading-none">
                             Account is active
                           </label>
                           {!isSelf && (
                               <span className="text-[10px] text-stone-400 mt-1">Uncheck to revoke all system access immediately.</span>
                           )}
                           {isSelf && (
                               <span className="text-[10px] text-stone-400 mt-1">Self-protection: Activation state is locked.</span>
                           )}
                       </div>
                    </div>
                </div>
              </div>
            </div>
          </Card>

          <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
            <div className="flex items-center gap-3 border-b border-stone-100 bg-stone-50/50 px-8 py-5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-100 text-stone-600 shadow-sm border border-stone-200/50">
                <Key size={16} aria-hidden />
              </div>
              <div>
                <h2 className="hs-strip-title uppercase tracking-widest text-xs font-black text-stone-900">Security Credentials</h2>
                <p className="mt-0.5 text-[10px] font-medium text-stone-400 uppercase tracking-tight">Optional: Leave blank to retain current password.</p>
              </div>
            </div>
            <div className="p-8">
              <div className="grid gap-6 sm:grid-cols-2">
                <Field label="New Password" error={errors.password?.message}>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    className="!h-11 border-stone-200"
                    {...register("password")}
                  />
                </Field>
                <Field label="Confirm Selection" error={errors.password_confirmation?.message}>
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
            <Alert variant="error" title={loading ? "Failed to load account" : "Submission Error"}>
              {apiError}
            </Alert>
          )}

          <div className="flex items-center justify-end gap-3 pt-6 pb-12">
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

        <Card className="mt-8 overflow-hidden rounded-2xl border-stone-200 shadow-sm !p-0">
            <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/50 px-8 py-5">
                <div className="flex items-center gap-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 shadow-sm border border-indigo-100/50">
                        <Activity size={14} />
                    </div>
                    <h3 className="hs-strip-title uppercase tracking-widest text-xs font-black text-stone-900">Recent Activity</h3>
                </div>
                <Button type="button" variant="ghost" onClick={() => (window.location.href = '/audit-logs')} className="!h-8 px-3 text-[10px] font-bold uppercase tracking-widest text-stone-400 hover:text-teal-600">
                    View Full Audit
                </Button>
            </div>
            {auditLogs.length > 0 ? (
                <Table 
                    embedded={true}
                    columns={[
                        { key: 'date', label: 'Timestamp' },
                        { key: 'action', label: 'Action' },
                        { key: 'entity', label: 'Reference' }
                    ]}
                    rows={auditLogs.map((log) => (
                        <tr key={log.audit_log_id} className="border-t border-stone-100/80 hover:bg-stone-50/50">
                            <td className="px-6 py-4 font-mono text-[10px] text-stone-400 tabular-nums">{formatDateString(log.created_at)}</td>
                            <td className="px-6 py-4">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-tight ${
                                    log.action === 'login' ? 'bg-teal-50 text-teal-700' :
                                    log.action === 'access_denied' ? 'bg-rose-50 text-rose-700' :
                                    'bg-stone-100 text-stone-600'
                                }`}>
                                    {log.action}
                                </span>
                            </td>
                            <td className="px-6 py-4">
                                <span className="text-[11px] font-medium text-stone-700 capitalize">{log.entity_name}</span>
                                <span className="ml-1 font-mono text-[10px] text-stone-400">#{log.entity_id}</span>
                            </td>
                        </tr>
                    ))}
                />
            ) : (
                <div className="p-12 flex flex-col items-center justify-center text-center">
                    <div className="h-12 w-12 rounded-full bg-stone-50 flex items-center justify-center text-stone-200 mb-4">
                        <AlertCircle size={24} />
                    </div>
                    <p className="text-[11px] font-medium text-stone-400 uppercase tracking-widest font-mono">No recent activity detected</p>
                </div>
            )}
        </Card>
      </motion.div>
    </AppMain>
  );
}
