"use client";

import { User, Phone, ShieldAlert, Mail, MapPin, RefreshCw } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { apiRequest, fetcher } from "../../../../lib/api";
import { canManageTenants } from "../../../../lib/auth";
import { applyServerFieldErrors } from "../../../../lib/forms";
import { useUnsavedChangesWarning } from "../../../../lib/useUnsavedChangesWarning";
import Alert from "../../../_components/ui/Alert";
import Button from "../../../_components/ui/Button";
import { Field, Input, Select, Textarea } from "../../../_components/ui/Fields";
import Breadcrumbs from "../../../_components/ui/Breadcrumbs";
import { TENANT_STATUS_LABELS } from "../../../../lib/constants";
import { formatTenantDirectoryName } from "../../../../lib/formatters";
import { primaryLinkCtaClass, secondaryOutlineLinkClass } from "../../../_components/ui/LinkTokens";
import StandardPage from "../../../_components/ui/StandardPage";
import { FormSection } from "../../../_components/ui/FormSection";
import ResourceIdCell from "../../../_components/ui/ResourceIdCell";
import { useAuth } from "../../../_context/AuthContext";
import PageHeaderActions from "../../../_components/ui/PageHeaderActions";
import { normalizePaginatedList } from "../../../../lib/pagination";

const PH_MOBILE_REGEX = /^(09\d{9}|(\+639)\d{9})$/;

export default function EditTenantPage() {
  const params = useParams();
  const router = useRouter();
  const tenantId = params?.id;

  const { user: currentUser } = useAuth();
  const [apiError, setApiError] = useState("");

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
      contact_number: "",
      email: "",
      emergency_contact_name: "",
      emergency_contact_number: "",
      address: "",
      status: "active",
    },
  });
  
  useUnsavedChangesWarning(isDirty && !isSubmitting);

  const { data: tenantData, error: tenantError } = useSWR(
    currentUser && tenantId ? `/api/tenants/${tenantId}` : null,
    fetcher
  );

  const { data: contractData } = useSWR(
    currentUser && tenantId ? `/api/contracts?tenant_id=${tenantId}` : null,
    fetcher
  );

  const loading = !tenantData && !tenantError;
  const tenant = tenantData ?? null;

  const hasActiveContract = useMemo(() => {
    const contractRows = normalizePaginatedList(contractData).rows;
    return contractRows.some((c) => c?.status === "active");
  }, [contractData]);

  useEffect(() => {
    if (tenantData) {
      reset({
        first_name: tenantData.first_name || "",
        last_name: tenantData.last_name || "",
        contact_number: tenantData.contact_number || "",
        email: tenantData.email || "",
        emergency_contact_name: tenantData.emergency_contact_name || "",
        emergency_contact_number: tenantData.emergency_contact_number || "",
        address: tenantData.address || "",
        status: tenantData.status || "active",
      });
    }
  }, [tenantData, reset]);

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
       applyServerFieldErrors(error, setError, { setApiError });
    }
  };

  const readOnly = !canManageTenants(currentUser);
  const fullName = tenant ? formatTenantDirectoryName(tenant) : "Tenant";

  return (
    <StandardPage
      title="Update Details"
      subtitle={
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-stone-500">
            Changes apply to {fullName} and are used on contracts and billing.
          </span>
          <div className="hidden sm:block h-3 w-[1px] bg-stone-200" />
          <ResourceIdCell id={tenantId} prefix="TENANT" />
        </div>
      }
      loading={loading}
      error={tenantError}
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
        <PageHeaderActions
          backHref={`/tenants/${tenantId}`}
          backLabel="Back to Profile"
          user={currentUser}
        />
      }
    >
      <div className="mx-auto w-full max-w-4xl space-y-6">
        {readOnly && (
          <Alert variant="warning" title="Restricted Access">
            You do not have permission to edit tenant records.
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <FormSection 
            title="Administrative Oversight" 
            icon={RefreshCw}
            rightElement={<ResourceIdCell id={tenantId} prefix="TENANT" />}
          >
            <Field
              label="Record Status"
              error={errors.status?.message}
              helpText={
                hasActiveContract
                  ? "Status is locked while an active lease exists. Process move-out from the contract ledger first."
                  : "Update status only after lease lifecycle actions are complete."
              }
            >
              <Select
                disabled={readOnly || hasActiveContract}
                className={`!h-11 border-stone-200 font-bold transition-all ${
                  hasActiveContract 
                    ? "bg-stone-50 text-stone-400 cursor-not-allowed border-dashed opacity-80 ring-0 shadow-none hover:bg-stone-50" 
                    : "bg-stone-50/50 text-stone-900 focus:border-teal-500/50"
                }`}
                {...register("status", { required: "Status is required." })}
              >
                <option value="active">{TENANT_STATUS_LABELS.active}</option>
                {tenant?.status === "moved_out" && (
                  <option value="moved_out">{TENANT_STATUS_LABELS.moved_out}</option>
                )}
                <option value="archived">{TENANT_STATUS_LABELS.archived}</option>
              </Select>
            </Field>
          </FormSection>

          <FormSection title="Basic Information" icon={User}>
            <div className="grid gap-6 sm:grid-cols-2">
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
          </FormSection>

          <FormSection title="Contact Details" icon={Phone}>
            <div className="space-y-6">
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
                    className="pl-10 pt-2 border-stone-200 focus:border-teal-500/50"
                    {...register("address", { required: "Address is required." })}
                  />
                </div>
              </Field>
            </div>
          </FormSection>

          <FormSection title="Emergency Contact" icon={ShieldAlert}>
            <div className="grid gap-6 sm:grid-cols-2">
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
          </FormSection>

          {apiError && <Alert variant="error" title="Could not save changes">{apiError}</Alert>}

          <div className="flex flex-col-reverse gap-3 pt-8 sm:flex-row sm:justify-end">
            <Link
              href={`/tenants/${tenantId}`}
              className={secondaryOutlineLinkClass + " px-10"}
            >
              Cancel
            </Link>
            <Button
              type="submit"
              variant="primary"
              loading={isSubmitting}
              disabled={readOnly || isSubmitting}
              className={primaryLinkCtaClass + " px-12 border-0"}
            >
              Save Changes
            </Button>
          </div>
        </form>
      </div>
    </StandardPage>
  );
}
