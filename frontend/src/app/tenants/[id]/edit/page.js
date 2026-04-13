"use client";

import { motion, useReducedMotion } from "framer-motion";
import { User, Phone, ShieldAlert, Mail, MapPin, RefreshCw, ArrowLeft } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { apiRequest } from "../../../../lib/api";
import { canManageTenants } from "../../../../lib/auth";
import { useAuthGuard } from "../../../../hooks/useAuthGuard";
import { flattenApiErrors } from "../../../../lib/errors";
import { useUnsavedChangesWarning } from "../../../../lib/useUnsavedChangesWarning";
import Alert from "../../../_components/ui/Alert";
import { AppMain } from "../../../_components/ui/AppShell";
import Button from "../../../_components/ui/Button";
import { Card } from "../../../_components/ui/Card";
import { Field, Input, Select, Textarea } from "../../../_components/ui/Fields";
import PageHeader from "../../../_components/ui/PageHeader";
import { SkeletonDetailPage } from "../../../_components/ui/Skeleton";
import UserRoleBadge from "../../../_components/ui/UserRoleBadge";
import Breadcrumbs from "../../../_components/ui/Breadcrumbs";
import { primaryLinkCtaClass, secondaryOutlineLinkClass } from "../../../_components/ui/LinkTokens";
import { TENANT_STATUS_LABELS } from "../../../../lib/constants";
import { formatTenantDirectoryName } from "../../../../lib/formatters";

const PH_MOBILE_REGEX = /^(09\d{9}|(\+639)\d{9})$/;

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.2, ease: "easeOut" },
};

export default function EditTenantPage() {
  const params = useParams();
  const router = useRouter();
  const tenantId = params?.id;

  const { user: currentUser, authLoading } = useAuthGuard();
  const shouldReduceMotion = useReducedMotion();
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState("");
  const [tenant, setTenant] = useState(null);
  const [hasActiveContract, setHasActiveContract] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({
    defaultValues: {
      first_name: "",
      last_name: "",
      contact_number: "",
      email: "",
      emergency_contact_name: "",
      emergency_contact_number: "",
      address: "",
      status: "active",
    },
  });
  
  useUnsavedChangesWarning(isDirty && !isSubmitting);

  const loadTenantData = useCallback(async () => {
    const data = await apiRequest(`/api/tenants/${tenantId}`, { method: "GET" });
    setTenant(data);
    
    // Check for active contracts
    const contractData = await apiRequest(`/api/contracts?tenant_id=${tenantId}`, { method: "GET" }).catch(() => []);
    const active = Array.isArray(contractData) && contractData.some(c => c.status === 'active');
    setHasActiveContract(active);

    reset({
      first_name: data.first_name || "",
      last_name: data.last_name || "",
      contact_number: data.contact_number || "",
      email: data.email || "",
      emergency_contact_name: data.emergency_contact_name || "",
      emergency_contact_number: data.emergency_contact_number || "",
      address: data.address || "",
      status: data.status || "active",
    });
  }, [tenantId, reset]);

  useEffect(() => {
    if (authLoading || !currentUser) return;

    const fetchData = async () => {
      try {
        if (tenantId) await loadTenantData();
      } catch (error) {
        setApiError(error?.message || "Failed to load tenant record.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [authLoading, currentUser, tenantId, loadTenantData]);

  const onSubmit = async (values) => {
    setApiError("");

    if (!canManageTenants(currentUser)) {
      setApiError("Unauthorized.");
      return;
    }

    try {
      await apiRequest(`/api/tenants/${tenantId}`, {
        method: "PUT",
        body: JSON.stringify({
          ...values,
          email: values.email || null,
          first_name: values.first_name?.trim(),
          last_name: values.last_name?.trim(),
          contact_number: values.contact_number?.trim(),
          emergency_contact_name: values.emergency_contact_name?.trim(),
          emergency_contact_number: values.emergency_contact_number?.trim(),
          address: values.address?.trim(),
        }),
      });

      router.push(`/tenants/${tenantId}`);
    } catch (error) {
      setApiError(flattenApiErrors(error));
    }
  };

  if (authLoading || loading) {
    return (
      <AppMain>
        <SkeletonDetailPage />
      </AppMain>
    );
  }

  const readOnly = !canManageTenants(currentUser);
  const fullName = tenant ? formatTenantDirectoryName(tenant) : "Tenant";

  return (
    <AppMain>
      <motion.div
        className="mx-auto mt-8 w-full max-w-4xl space-y-6"
        initial={shouldReduceMotion ? false : pageVariants.initial}
        animate={shouldReduceMotion ? false : pageVariants.animate}
        transition={shouldReduceMotion ? { duration: 0 } : pageVariants.transition}
      >
        <PageHeader
          title="Update Details"
          subtitle={`Changes apply to ${fullName} and are used on contracts and billing.`}
          breadcrumbs={
            <Breadcrumbs
              items={[
                { label: "Tenant Directory", href: "/tenants" },
                { label: fullName, href: `/tenants/${tenantId}` },
                { label: "Update" },
              ]}
            />
          }
          actions={
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => router.push(`/tenants/${tenantId}`)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-500 transition-colors hover:bg-stone-50"
                aria-label="Back to tenant profile"
                title="Back to profile"
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
          <Alert variant="warning" title="Restricted Access">
            You do not have permission to edit tenant records.
          </Alert>
        ) : null}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Section 1: Administrative Oversight */}
            <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
              <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/50 px-8 py-5">
                <div className="flex items-center gap-3">
                   <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-stone-100 text-stone-600">
                      <RefreshCw size={14} aria-hidden />
                   </div>
                   <h2 className="hs-strip-title text-sm font-black uppercase tracking-widest text-stone-400">Basic Information</h2>
                </div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-tighter text-stone-400">
                   #TENANT-{tenantId}
                </p>
              </div>
              <div className="p-8">
                <Field
                  label="Record Status"
                  error={errors.status?.message}
                  helpText={
                    hasActiveContract
                      ? "Status cannot change while this tenant has an active lease."
                      : "Active, moved out, or archived — must match how you manage the room."
                  }
                >
                  <Select
                    disabled={readOnly || hasActiveContract}
                    className="!h-11 border-stone-200 bg-stone-50/50 font-bold"
                    {...register("status", { required: "Status is required." })}
                  >
                    <option value="active">{TENANT_STATUS_LABELS.active}</option>
                    {tenant?.status === "moved_out" && (
                      <option value="moved_out">{`${TENANT_STATUS_LABELS.moved_out} (System Managed)`}</option>
                    )}
                    <option value="archived">{TENANT_STATUS_LABELS.archived}</option>
                  </Select>
                </Field>
              </div>
            </Card>

            {/* Section 2: Basic Information */}
            <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
               <div className="flex items-center gap-3 border-b border-stone-100 bg-stone-50/50 px-8 py-5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                     <User size={14} aria-hidden />
                  </div>
                  <h2 className="hs-strip-title text-sm font-black uppercase tracking-widest text-stone-400">Basic Information</h2>
               </div>
               <div className="p-8 grid gap-6 sm:grid-cols-2">
                  <Field label="First Name" required error={errors.first_name?.message}>
                    <Input
                      disabled={readOnly}
                      className="!h-11 border-stone-200 focus:border-teal-500/50"
                      {...register("first_name", { required: "Required" })}
                    />
                  </Field>
                  <Field label="Last Name" required error={errors.last_name?.message}>
                    <Input
                      disabled={readOnly}
                      className="!h-11 border-stone-200 focus:border-teal-500/50"
                      {...register("last_name", { required: "Required" })}
                    />
                  </Field>
               </div>
            </Card>

            {/* Section 3: Contact Address */}
            <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
               <div className="flex items-center gap-3 border-b border-stone-100 bg-stone-50/50 px-8 py-5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                     <Phone size={14} aria-hidden />
                  </div>
                  <h2 className="hs-strip-title text-sm font-black uppercase tracking-widest text-stone-400">Contact Details</h2>
               </div>
               <div className="p-8 space-y-6">
                  <div className="grid gap-6 sm:grid-cols-2">
                    <Field label="Phone Number" required error={errors.contact_number?.message}>
                      <div className="relative">
                        <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-300" />
                        <Input
                          disabled={readOnly}
                          className="!h-11 border-stone-200 pl-10 font-mono"
                          {...register("contact_number", {
                            required: "Required",
                            pattern: { value: PH_MOBILE_REGEX, message: "Invalid format" }
                          })}
                        />
                      </div>
                    </Field>
                    <Field label="Email Address" required error={errors.email?.message}>
                      <div className="relative">
                        <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-300" />
                        <Input
                          disabled={readOnly}
                          type="email"
                          className="!h-11 border-stone-200 pl-10"
                          {...register("email", { required: "Email is required." })}
                        />
                      </div>
                    </Field>
                  </div>
                  <Field label="Permanent address" required error={errors.address?.message}>
                    <div className="relative">
                      <MapPin size={14} className="absolute left-3 top-3 text-stone-300" />
                      <Textarea
                        disabled={readOnly}
                        rows={2}
                        className="pl-10 pt-2 border-stone-200"
                        {...register("address", { required: "Address is required." })}
                      />
                    </div>
                  </Field>
               </div>
            </Card>

            {/* Section 4: Emergency Details */}
            <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
               <div className="flex items-center gap-3 border-b border-stone-100 bg-stone-50/50 px-8 py-5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                     <ShieldAlert size={14} aria-hidden />
                  </div>
                  <h2 className="hs-strip-title text-sm font-black uppercase tracking-widest text-stone-400">Emergency Contact</h2>
               </div>
               <div className="p-8 grid gap-6 sm:grid-cols-2">
                  <Field label="Contact name" required error={errors.emergency_contact_name?.message}>
                    <Input
                      disabled={readOnly}
                      className="!h-11 border-stone-200 focus:border-teal-500/50"
                      {...register("emergency_contact_name", { required: "Emergency contact name is required." })}
                    />
                  </Field>
                  <Field label="Contact phone" required error={errors.emergency_contact_number?.message}>
                    <Input
                      disabled={readOnly}
                      className="!h-11 border-stone-200 font-mono focus:border-teal-500/50"
                      {...register("emergency_contact_number", {
                        required: "Emergency phone is required.",
                        pattern: { value: PH_MOBILE_REGEX, message: "Invalid format" },
                      })}
                    />
                  </Field>
               </div>
            </Card>

            {apiError && <Alert variant="error" title="Could not save changes">{apiError}</Alert>}

            <div className="flex flex-col-reverse gap-3 pt-6 sm:flex-row sm:justify-end">
              <Link
                href={`/tenants/${tenantId}`}
                className={secondaryOutlineLinkClass + " px-8"}
              >
                Cancel
              </Link>
              <Button
                type="submit"
                variant="primary"
                loading={isSubmitting}
                disabled={readOnly || isSubmitting}
                className={primaryLinkCtaClass + " px-12 border-0 shadow-lg shadow-teal-900/10"}
              >
                Save Changes
              </Button>
            </div>
        </form>
      </motion.div>
    </AppMain>
  );
}
