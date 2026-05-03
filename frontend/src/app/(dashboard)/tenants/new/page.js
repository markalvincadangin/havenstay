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

const PH_MOBILE_REGEX = /^(09\d{9}|(\+639)\d{9})$/;

export default function NewTenantPage() {
   const router = useRouter();
   const { user: currentUser } = useAuth();
   const { showToast } = useToasts();

   const [currentStepIndex, setCurrentStepIndex] = useState(0);
   const [scannedDuplicates, setScannedDuplicates] = useState({ email: null, phone: null, name: null });
   const [isScanning, setIsScanning] = useState(false);

   const {
      register,
      trigger,
      setError,
      getValues,
      formState: { errors, isSubmitting, isDirty },
   } = useForm({
      mode: "onChange",
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

   const checkUniqueness = async (field, value) => {
      if (!value || value.length < 3) return null;
      setIsScanning(true);
      try {
         const results = await apiRequest(`/api/tenants/search?q=${encodeURIComponent(value.trim())}`);
         const rows = results?.data || results || [];

         if (field === 'email') {
            const match = rows.find(t => t.email?.toLowerCase() === value.trim().toLowerCase());
            const matchId = match ? match.tenant_id : null;
            setScannedDuplicates(prev => ({ ...prev, email: matchId }));
            return matchId;
         } else if (field === 'contact_number') {
            const match = rows.find(t => t.contact_number === value.trim());
            const matchId = match ? match.tenant_id : null;
            setScannedDuplicates(prev => ({ ...prev, phone: matchId }));
            return matchId;
         }
         return null;
      } catch (e) {
         console.error("Scanning failed", e);
         return null;
      } finally {
         setIsScanning(false);
      }
   };

   const checkNameCollision = async () => {
      const { first_name, last_name } = getValues();
      if (!first_name || !last_name) {
         setScannedDuplicates(prev => ({ ...prev, name: null }));
         return null;
      }

      setIsScanning(true);
      try {
         const fullName = `${first_name.trim()} ${last_name.trim()}`;
         const results = await apiRequest(`/api/tenants/search?q=${encodeURIComponent(fullName)}`);
         const rows = results?.data || results || [];
         const match = rows.find(t =>
            t.first_name?.toLowerCase().trim() === first_name.trim().toLowerCase() &&
            t.last_name?.toLowerCase().trim() === last_name.trim().toLowerCase()
         );
         const matchId = match ? match.tenant_id : null;
         setScannedDuplicates(prev => ({ ...prev, name: matchId }));
         return matchId;
      } catch (e) {
         return null;
      } finally {
         setIsScanning(false);
      }
   };

   const validateStep = async (index) => {
      if (index === 0) {
         const ok = await trigger(["first_name", "last_name", "address"]);
         if (ok) {
            await checkNameCollision();
         }
         return ok;
      }
      if (index === 1) {
         const ok = await trigger(["contact_number", "email"]);
         if (ok) {
            const vals = getValues();
            const emailDup = await checkUniqueness('email', vals.email);
            await checkUniqueness('contact_number', vals.contact_number);
            
            if (emailDup) return false;
            return ok;
         }
         return ok;
      }
      return true;
   };

   const isStepInvalid = useMemo(() => {
      if (currentStepIndex === 0) {
         return !!(errors.first_name || errors.last_name || errors.address);
      }
      if (currentStepIndex === 1) {
         return !!(errors.email || errors.contact_number || scannedDuplicates.email);
      }
      if (currentStepIndex === 2) {
         return !!(errors.emergency_contact_name || errors.emergency_contact_number);
      }
      return false;
   }, [currentStepIndex, errors, scannedDuplicates.email]);

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
            onSubmit={() => onSubmitTenant("lease")}
            isSubmitting={isSubmitting}
            isNextDisabled={isStepInvalid || isScanning || readOnly}
            isSubmitDisabled={isStepInvalid || isScanning || readOnly}
            nextLabel="Next Step"
            submitLabel="Register & Create Lease"
            cancelLabel="Discard Changes"
            extraActions={
               currentStepIndex === 2 && (
                  <Button
                     variant="outline"
                     size="lg"
                     onClick={() => onSubmitTenant("view")}
                     disabled={readOnly || isSubmitting || isStepInvalid || isScanning}
                     className="rounded-xl text-xs font-black uppercase tracking-widest text-stone-500"
                  >
                     Register Tenant Only
                  </Button>
               )
            }
         >
            <div className="space-y-6">
               {currentStepIndex === 0 && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                     <div className="grid gap-6 sm:grid-cols-2">
                        <Field
                           label="First Name"
                           required
                           error={errors.first_name?.message}
                           warning={scannedDuplicates.name ? "A tenant with this name already exists in the registry." : null}
                        >
                           <Input
                              autoFocus
                              disabled={readOnly}
                              hasError={Boolean(errors.first_name)}
                              placeholder="Juan"
                              className="!h-11 border-stone-200"
                              {...register("first_name", { required: "First name is required." })}
                              onBlur={checkNameCollision}
                           />
                        </Field>
                        <Field label="Last Name" required error={errors.last_name?.message}>
                           <Input
                              disabled={readOnly}
                              hasError={Boolean(errors.last_name)}
                              placeholder="Dela Cruz"
                              className="!h-11 border-stone-200"
                              {...register("last_name", { required: "Last name is required." })}
                              onBlur={checkNameCollision}
                           />
                        </Field>
                     </div>
                     <Field label="Home Address" required error={errors.address?.message}>
                        <Textarea
                           rows={3}
                           disabled={readOnly}
                           hasError={Boolean(errors.address)}
                           className="border-stone-200"
                           {...register("address", { required: "Please provide a home address." })}
                        />
                     </Field>
                  </div>
               )}

               {currentStepIndex === 1 && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                     <div className="grid gap-6 sm:grid-cols-2">
                        <Field
                           label="Contact Number"
                           required
                           error={errors.contact_number?.message}
                           warning={scannedDuplicates.phone ? "This number is already registered to another profile." : null}
                        >
                           <Input
                              autoFocus
                              disabled={readOnly}
                              hasError={Boolean(errors.contact_number)}
                              className="!h-11 font-mono tabular-nums border-stone-200"
                              {...register("contact_number", {
                                 required: "Contact number is required.",
                                 pattern: { value: PH_MOBILE_REGEX, message: "Please enter a valid PH mobile number." }
                              })}
                              onBlur={(e) => checkUniqueness('contact_number', e.target.value)}
                           />
                        </Field>
                        <Field
                           label="Email Address"
                           required
                           error={errors.email?.message || (scannedDuplicates.email ? "This email is already associated with an active tenant." : null)}
                        >
                           <Input
                              disabled={readOnly}
                              hasError={Boolean(errors.email || scannedDuplicates.email)}
                              type="email"
                              placeholder="juan@example.ph"
                              className="!h-11 border-stone-200 gap-x-6"
                              {...register("email", {
                                 required: "Email address is required.",
                                 pattern: {
                                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                                    message: "Please enter a valid email address."
                                 }
                              })}
                              onBlur={(e) => checkUniqueness('email', e.target.value)}
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
                              hasError={Boolean(errors.emergency_contact_name)}
                              className="!h-11 border-stone-200"
                              {...register("emergency_contact_name", { required: "Emergency contact name is required." })}
                           />
                        </Field>
                        <Field label="Emergency Number" required error={errors.emergency_contact_number?.message}>
                           <Input
                              disabled={readOnly}
                              hasError={Boolean(errors.emergency_contact_number)}
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
