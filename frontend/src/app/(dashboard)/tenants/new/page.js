"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { apiRequest } from "@/lib/api";
import { canManageTenants } from "@/lib/auth";
import { applyServerFieldErrors } from "@/lib/forms";
import { useUnsavedChangesWarning } from "@/hooks/useUnsavedChangesWarning";
import { useAuth } from "@/context/AuthContext";
import { useToasts } from "@/context/ToastContext";

import Alert from "@/components/ui/Alert";
import { Field, Input, Textarea } from "@/components/ui/Fields";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import StandardPage from "@/components/ui/StandardPage";
import { SkeletonDetailPage } from "@/components/ui/Skeleton";
import { WizardFrame } from "@/components/ui/WizardFrame";
import Button from "@/components/ui/Button";
import { Zap } from "lucide-react";

const PH_MOBILE_REGEX = /^(09\d{9}|(\+639)\d{9})$/;

export default function NewTenantPage() {
   const router = useRouter();
   const { user: currentUser } = useAuth();
   const { showToast } = useToasts();

   const [currentStepIndex, setCurrentStepIndex] = useState(0);

   const {
      register,
      trigger,
      setError,
      getValues,
      formState: { errors, isSubmitting, isDirty },
   } = useForm({
      defaultValues: {
         first_name: "",
         last_name: "",
         address: "",
         contact_number: "",
         email: "",
         emergency_contact_name: "",
         emergency_contact_number: "",
      },
   });

   useUnsavedChangesWarning(isDirty && !isSubmitting);

   const validateStep = async (index) => {
      if (index === 0) {
         return await trigger(["first_name", "last_name", "address"]);
      }
      if (index === 1) {
         return await trigger(["contact_number", "email"]);
      }
      return true;
   };

   const onNext = async () => {
      const isValid = await validateStep(currentStepIndex);
      if (isValid) {
         setCurrentStepIndex((prev) => Math.min(prev + 1, 2));
      }
   };

   const onBack = () => {
      setCurrentStepIndex((prev) => Math.max(prev - 1, 0));
   };

   const onSubmitTenant = async (shouldCreateLease) => {
      const isValid = await trigger();
      if (!isValid) return;

      if (!canManageTenants(currentUser)) return;

      const values = getValues();
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

         const tenantId = response?.tenant?.tenant_id || response?.tenant_id;
         if (tenantId) {
            showToast(`Tenant ${values.first_name} registered successfully.`, "success");
            if (shouldCreateLease === "lease") {
               router.push(`/contracts/new?tenant_id=${tenantId}`);
            } else {
               router.push(`/tenants/${tenantId}`);
            }
         }
      } catch (error) {
         applyServerFieldErrors(error, setError, { showToast });
      }
   };

   const readOnly = useMemo(() => !canManageTenants(currentUser), [currentUser]);

   const wizardSteps = [
      { label: "Identity Profile" },
      { label: "Communications" },
      { label: "Emergency & Save" }
   ];

   return (
      <StandardPage
         title="Register Tenant"
         subtitle="Step-by-step registration for new tenants."
         skeleton={<SkeletonDetailPage />}
         breadcrumbs={
            <Breadcrumbs
               items={[{ label: "Tenant Directory", href: "/tenants" }, { label: "Register Tenant" }]}
            />
         }
      >
         {readOnly && <Alert variant="warning" title="Restricted" className="max-w-4xl mx-auto mb-6">Read-only mode. Registration is disabled.</Alert>}

         <WizardFrame
            title="Tenant Onboarding"
            steps={wizardSteps}
            currentStepIndex={currentStepIndex}
            onNext={onNext}
            onBack={onBack}
            onCancel={() => router.push("/tenants")}
            onSubmit={() => onSubmitTenant("view")}
            isSubmitting={isSubmitting}
            nextLabel="Next Step"
            submitLabel="Register Tenant"
            cancelLabel="Discard Changes"
            extraActions={
               currentStepIndex === 2 && (
                  <Button
                     variant="ghost"
                     onClick={() => onSubmitTenant("lease")}
                     disabled={readOnly || isSubmitting}
                     className="text-stone-500 hover:text-teal-700 hover:bg-teal-50"
                  >
                     <Zap size={16} className="mr-2" />
                     Save & Generate Lease
                  </Button>
               )
            }
         >
            <div className="space-y-6">
               {currentStepIndex === 0 && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                     <div className="grid gap-6 sm:grid-cols-2">
                        <Field label="First Name" required error={errors.first_name?.message}>
                           <Input
                              autoFocus
                              disabled={readOnly}
                              placeholder="Juan"
                              className="!h-11 border-stone-200"
                              {...register("first_name", { required: "First name is required." })}
                           />
                        </Field>
                        <Field label="Last Name" required error={errors.last_name?.message}>
                           <Input
                              disabled={readOnly}
                              placeholder="Dela Cruz"
                              className="!h-11 border-stone-200"
                              {...register("last_name", { required: "Last name is required." })}
                           />
                        </Field>
                     </div>
                     <Field label="Home Address" required error={errors.address?.message}>
                        <Textarea
                           rows={3}
                           disabled={readOnly}
                           className="border-stone-200"
                           {...register("address", { required: "Please provide a home address." })}
                        />
                     </Field>
                  </div>
               )}

               {currentStepIndex === 1 && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                     <div className="grid gap-6 sm:grid-cols-2">
                        <Field label="Contact Number" required error={errors.contact_number?.message}>
                           <Input
                              autoFocus
                              disabled={readOnly}
                              className="!h-11 font-mono tabular-nums border-stone-200"
                              {...register("contact_number", {
                                 required: "Contact number is required.",
                                 pattern: { value: PH_MOBILE_REGEX, message: "Please enter a valid PH mobile number." }
                              })}
                           />
                        </Field>
                        <Field label="Email Address" required error={errors.email?.message}>
                           <Input
                              disabled={readOnly}
                              type="email"
                              placeholder="juan@example.ph"
                              className="!h-11 border-stone-200 gap-x-6"
                              {...register("email", { required: "Email address is required." })}
                           />
                        </Field>
                     </div>
                  </div>
               )}

               {currentStepIndex === 2 && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                     <div className="grid gap-6 sm:grid-cols-2">
                        <Field label="Emergency Contact Name" required error={errors.emergency_contact_name?.message}>
                           <Input
                              autoFocus
                              disabled={readOnly}
                              className="!h-11 border-stone-200"
                              {...register("emergency_contact_name", { required: "Emergency contact name is required." })}
                           />
                        </Field>
                        <Field label="Emergency Number" required error={errors.emergency_contact_number?.message}>
                           <Input
                              disabled={readOnly}
                              className="!h-11 font-mono tabular-nums border-stone-200"
                              {...register("emergency_contact_number", {
                                 required: "Please provide a valid emergency contact number.",
                                 pattern: { value: PH_MOBILE_REGEX, message: "Invalid format" },
                              })}
                           />
                        </Field>
                     </div>
                  </div>
               )}
            </div>
         </WizardFrame>
      </StandardPage>
   );
}
