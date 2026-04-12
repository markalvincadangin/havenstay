"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Phone, ShieldAlert, ArrowLeft, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { apiRequest } from "../../../lib/api";
import { canManageTenants } from "../../../lib/auth";
import { useAuthGuard } from "../../../hooks/useAuthGuard";
import { flattenApiErrors } from "../../../lib/errors";
import { useUnsavedChangesWarning } from "../../../lib/useUnsavedChangesWarning";
import Alert from "../../_components/ui/Alert";
import { AppMain } from "../../_components/ui/AppShell";
import Button from "../../_components/ui/Button";
import { Card } from "../../_components/ui/Card";
import { Field, Input, Textarea } from "../../_components/ui/Fields";
import PageHeader from "../../_components/ui/PageHeader";
import Spinner from "../../_components/ui/Spinner";
import UserRoleBadge from "../../_components/ui/UserRoleBadge";
import Breadcrumbs from "../../_components/ui/Breadcrumbs";
import { primaryLinkCtaClass, secondaryOutlineLinkClass } from "../../_components/ui/LinkTokens";

const PH_MOBILE_REGEX = /^(09\d{9}|(\+639)\d{9})$/;

const pageVariants = {
   initial: { opacity: 0, y: 8 },
   animate: { opacity: 1, y: 0 },
   transition: { duration: 0.2, ease: "easeOut" },
};

export default function NewTenantPage() {
   const router = useRouter();
   const { user: currentUser, authLoading } = useAuthGuard();
   const shouldReduceMotion = useReducedMotion();
   const [apiError, setApiError] = useState("");

   const {
      register,
      handleSubmit,
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

   useUnsavedChangesWarning(isDirty && !isSubmitting);

   const onSubmit = async (values) => {
      setApiError("");
      if (!canManageTenants(currentUser)) return;

      try {
         const response = await apiRequest("/api/tenants", {
            method: "POST",
            body: JSON.stringify({
               ...values,
               email: values.email || null,
               emergency_contact_name: values.emergency_contact_name?.trim(),
               emergency_contact_number: values.emergency_contact_number?.trim(),
               address: values.address?.trim(),
            }),
         });

         const tenantId = response?.tenant?.tenant_id;
         if (tenantId) router.push(`/tenants/${tenantId}`);
      } catch (error) {
         setApiError(flattenApiErrors(error));
      }
   };

   if (authLoading) {
      return (
         <AppMain>
            <Spinner label="Loading form…" />
         </AppMain>
      );
   }

   const readOnly = !canManageTenants(currentUser);

   return (
      <AppMain>
         <motion.div
            className="mx-auto mt-8 w-full max-w-4xl space-y-6"
            initial={shouldReduceMotion ? false : pageVariants.initial}
            animate={shouldReduceMotion ? false : pageVariants.animate}
            transition={shouldReduceMotion ? { duration: 0 } : pageVariants.transition}
         >
            <PageHeader
               title="Register Tenant"
               subtitle="Enter accurate tenant information for contracts and billing."
               breadcrumbs={
                  <Breadcrumbs
                     items={[{ label: "Tenant Directory", href: "/tenants" }, { label: "Register Tenant" }]}
                  />
               }
               actions={
                  <div className="flex items-center gap-3">
                     <button
                        type="button"
                        onClick={() => router.push("/tenants")}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-500 transition-colors hover:bg-stone-50"
                        aria-label="Back to Tenant Directory"
                        title="Back to Tenant Directory"
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
               {/* Section 1: Tenant Details */}
               <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
                  <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/50 px-8 py-5">
                     <div className="flex items-center gap-3">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-stone-100 text-stone-600">
                           <RefreshCw size={14} aria-hidden />
                        </div>
                        <h2 className="hs-strip-title text-sm font-black uppercase tracking-widest text-stone-400">Basic Information</h2>
                     </div>
                     <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Directory Core</span>
                  </div>

                  <div className="p-8 space-y-8">
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
                  </div>
               </Card>

               {/* Section 2: Contact Information */}
               <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
                  <div className="flex items-center gap-3 border-b border-stone-100 bg-stone-50/50 px-8 py-5">
                     <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                        <Phone size={16} aria-hidden />
                     </div>
                     <h2 className="hs-strip-title">Contact Details</h2>
                  </div>

                  <div className="p-8 space-y-8">
                     <div className="grid gap-6 sm:grid-cols-2">
                        <Field label="Phone number" required error={errors.contact_number?.message}>
                           <Input
                              disabled={readOnly}
                              className="!h-11 font-mono border-stone-200"
                              {...register("contact_number", {
                                 required: "Required",
                                 pattern: { value: PH_MOBILE_REGEX, message: "Invalid format" }
                              })}
                           />
                        </Field>
                        <Field label="Email" error={errors.email?.message}>
                           <Input
                              disabled={readOnly}
                              type="email"
                              placeholder="juan@example.ph"
                              className="!h-11 border-stone-200 focus:border-teal-500/50"
                              {...register("email")}
                           />
                        </Field>
                        <div className="sm:col-span-2">
                           <Field label="Permanent address" required error={errors.address?.message}>
                              <Textarea
                                 rows={3}
                                 disabled={readOnly}
                                 className="border-stone-200"
                                 {...register("address", { required: "Address is required." })}
                              />
                           </Field>
                        </div>
                     </div>
                  </div>
               </Card>

               {/* Section 4: Emergency Info */}
               <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
                  <div className="flex items-center gap-3 border-b border-stone-100 bg-stone-50/50 px-8 py-5">
                     <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                        <ShieldAlert size={16} aria-hidden />
                     </div>
                     <h2 className="hs-strip-title">Emergency Contact</h2>
                  </div>

                  <div className="p-8 space-y-8">
                     <div className="grid gap-6 sm:grid-cols-2">
                        <Field label="Contact name" required error={errors.emergency_contact_name?.message}>
                           <Input
                              disabled={readOnly}
                              className="!h-11 border-stone-200"
                              {...register("emergency_contact_name", { required: "Emergency contact name is required." })}
                           />
                        </Field>
                        <Field label="Contact phone" required error={errors.emergency_contact_number?.message}>
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
                  </div>
               </Card>

               {apiError && <Alert variant="error" title="Registration Failed">{apiError}</Alert>}

               <div className="flex flex-col-reverse gap-3 pt-6 sm:flex-row sm:justify-end">
                  <Link href="/tenants" className={secondaryOutlineLinkClass + " px-8"}>
                     Cancel
                  </Link>
                  <Button
                     type="submit"
                     variant="primary"
                     loading={isSubmitting}
                     disabled={readOnly || isSubmitting}
                     className={primaryLinkCtaClass + " px-12 border-0 shadow-lg shadow-teal-900/10"}
                  >
                     Register Tenant
                  </Button>
               </div>
            </form>
         </motion.div>
      </AppMain>
   );
}
