"use client";

import { Phone, ShieldAlert, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { apiRequest } from "../../../lib/api";
import { canManageTenants } from "../../../lib/auth";
import { applyServerFieldErrors } from "../../../lib/forms";
import { useUnsavedChangesWarning } from "../../../lib/useUnsavedChangesWarning";
import Alert from "../../_components/ui/Alert";
import Button from "../../_components/ui/Button";
import { Field, Input, Textarea } from "../../_components/ui/Fields";
import Breadcrumbs from "../../_components/ui/Breadcrumbs";
import { primaryLinkCtaClass, secondaryOutlineLinkClass } from "../../_components/ui/LinkTokens";
import StandardPage from "../../_components/ui/StandardPage";
import { FormSection } from "../../_components/ui/FormSection";
import PageHeaderActions from "../../_components/ui/PageHeaderActions";
import { useAuth } from "../../_context/AuthContext";

const PH_MOBILE_REGEX = /^(09\d{9}|(\+639)\d{9})$/;

export default function NewTenantPage() {
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
         contact_number: "",
         email: "",
         emergency_contact_name: "",
         emergency_contact_number: "",
         address: "",
      },
   });

   const [submissionFlag, setSubmissionFlag] = useState("view"); // "view" or "lease"

   const onSubmit = async (values) => {
      setApiError("");
      if (!canManageTenants(currentUser)) return;

      try {
         const response = await apiRequest("/api/tenants", {
            method: "POST",
            body: JSON.stringify({
               ...values,
               first_name: values.first_name?.trim(),
               last_name: values.last_name?.trim(),
               contact_number: values.contact_number?.trim(),
               email: values.email?.trim() || null,
               emergency_contact_name: values.emergency_contact_name?.trim(),
               emergency_contact_number: values.emergency_contact_number?.trim(),
               address: values.address?.trim(),
            }),
         });

         const tenantId = response?.tenant?.tenant_id;
         if (tenantId) {
            if (submissionFlag === "lease") {
               router.push(`/contracts/new?tenant_id=${tenantId}`);
            } else {
               router.push(`/tenants/${tenantId}`);
            }
         }
      } catch (error) {
         applyServerFieldErrors(error, setError, { setApiError });
      }
   };

   const readOnly = useMemo(() => !canManageTenants(currentUser), [currentUser]);

   return (
      <StandardPage
         title="Register Tenant"
         subtitle="Enter accurate tenant information for contracts and billing."
         breadcrumbs={
            <Breadcrumbs
               items={[{ label: "Tenant Directory", href: "/tenants" }, { label: "Register Tenant" }]}
            />
         }
         actions={
            <PageHeaderActions
               backHref="/tenants"
               backLabel="Back to Tenant Directory"
               user={currentUser}
            />
         }
      >
         <div className="mx-auto w-full max-w-4xl">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
               <FormSection
                  title="Basic Information"
                  icon={RefreshCw}
                  rightElement={
                     <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Directory Core</span>
                  }
               >
                  <div className="grid gap-6 sm:grid-cols-2">
                     <Field label="First Name" required error={errors.first_name?.message}>
                        <Input
                           autoFocus
                           disabled={readOnly}
                           placeholder="Juan"
                           className="!h-11 border-stone-200 focus:border-teal-500/50"
                           {...register("first_name", { required: "First name is required." })}
                        />
                     </Field>
                     <Field label="Last Name" required error={errors.last_name?.message}>
                        <Input
                           disabled={readOnly}
                           placeholder="Dela Cruz"
                           className="!h-11 border-stone-200 focus:border-teal-500/50"
                           {...register("last_name", { required: "Last name is required." })}
                        />
                     </Field>
                  </div>
               </FormSection>

               <FormSection title="Contact Details" icon={Phone}>
                  <div className="grid gap-6 sm:grid-cols-2">
                     <Field label="Mobile Number" required error={errors.contact_number?.message}>
                        <Input
                           disabled={readOnly}
                           className="!h-11 font-mono border-stone-200"
                           {...register("contact_number", {
                              required: "Required",
                              pattern: { value: PH_MOBILE_REGEX, message: "Invalid format" }
                           })}
                        />
                     </Field>
                     <Field label="Email Address" required error={errors.email?.message}>
                        <Input
                           disabled={readOnly}
                           type="email"
                           placeholder="juan@example.ph"
                           className="!h-11 border-stone-200 focus:border-teal-500/50"
                           {...register("email", { required: "Email is required." })}
                        />
                     </Field>
                     <div className="sm:col-span-2">
                        <Field label="Home Address" required error={errors.address?.message}>
                           <Textarea
                              rows={3}
                              disabled={readOnly}
                              className="border-stone-200"
                              {...register("address", { required: "Address is required." })}
                           />
                        </Field>
                     </div>
                  </div>
               </FormSection>

               <FormSection title="Emergency Contact" icon={ShieldAlert}>
                  <div className="grid gap-6 sm:grid-cols-2">
                     <Field label="Emergency Contact Person" required error={errors.emergency_contact_name?.message}>
                        <Input
                           disabled={readOnly}
                           className="!h-11 border-stone-200"
                           {...register("emergency_contact_name", { required: "Name is required." })}
                        />
                     </Field>
                     <Field label="Emergency Contact Number" required error={errors.emergency_contact_number?.message}>
                        <Input
                           disabled={readOnly}
                           className="!h-11 font-mono border-stone-200"
                           {...register("emergency_contact_number", {
                              required: "Emergency phone is required.",
                              pattern: { value: PH_MOBILE_REGEX, message: "Invalid format" },
                           })}
                        />
                     </Field>
                  </div>
               </FormSection>

               {apiError && <Alert variant="error" title="Registration Failed">{apiError}</Alert>}

               <div className="flex flex-col-reverse gap-3 pt-8 sm:flex-row sm:justify-end">
                  <Link href="/tenants" className={secondaryOutlineLinkClass + " px-10"}>
                     Cancel
                  </Link>
                  <Button
                     type="submit"
                     variant="secondary"
                     loading={isSubmitting && submissionFlag === "lease"}
                     disabled={readOnly || isSubmitting}
                     className="!h-12 rounded-xl px-10 text-[10px] font-bold uppercase tracking-widest"
                     onClick={() => setSubmissionFlag("lease")}
                  >
                     Save & Create Lease
                  </Button>
                  <Button
                     type="submit"
                     variant="primary"
                     loading={isSubmitting && submissionFlag === "view"}
                     disabled={readOnly || isSubmitting}
                     className={primaryLinkCtaClass + " px-12 border-0"}
                     onClick={() => setSubmissionFlag("view")}
                  >
                     Register Tenant
                  </Button>
               </div>
            </form>
         </div>
      </StandardPage>
   );
}
