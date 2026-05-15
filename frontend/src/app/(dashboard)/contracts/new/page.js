"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm, useWatch } from "react-hook-form";
import { CheckCircle2, Wallet, ArrowRight, ReceiptText, ShieldCheck } from "lucide-react";
import { apiRequest, fetcher } from "@/lib/api";
import useSWR from "swr";
import { canManageContracts } from "@/lib/auth";
import { applyServerFieldErrors } from "@/lib/forms";
import { useUnsavedChangesWarning } from "@/hooks/useUnsavedChangesWarning";
import { formatTenantDirectoryName, parseMoneyInput } from "@/lib/formatters";
import { useAction } from "@/hooks/useAction";
import CurrencyDisplay from "@/components/ui/CurrencyDisplay";
import Alert from "@/components/ui/Alert";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import { Field, Input, Select, Textarea } from "@/components/ui/Fields";
import { ACTIVE_CONTRACT_STATUS_KEYS } from "@/lib/constants";
import { normalizePaginatedList } from "@/lib/pagination";
import StandardPage from "@/components/ui/StandardPage";
import { SkeletonDetailPage } from "@/components/ui/Skeleton";
import { useAuth } from "@/context/AuthContext";
import { useToasts } from "@/context/ToastContext";
import { WizardFrame } from "@/components/ui/WizardFrame";
import Button from "@/components/ui/Button";
import { SideSheetOverlay } from "@/components/ui/SideSheetOverlay";
import PaymentWizard from "@/features/payments/components/PaymentWizard";

export default function NewContractPage() {
   const router = useRouter();
   const searchParams = useSearchParams();
   const renewContractId = searchParams.get("renew_contract_id");
   const { user: currentUser } = useAuth();
   const { showToast } = useToasts();
   const [bedSpaceOptions, setBedSpaceOptions] = useState([]);
   const [currentStepIndex, setCurrentStepIndex] = useState(0);
   const [createdContract, setCreatedContract] = useState(null);
   const [showPaymentSheet, setShowPaymentSheet] = useState(false);
   const [isFullySettled, setIsFullySettled] = useState(false);
   const totalSteps = 3; // Steps 0, 1, 2 are navigational. Step 3 is Success/Settlement.

   const {
      register,
      control,
      getValues,
      setValue,
      trigger,
      setError,
      formState: { errors, isDirty },
   } = useForm({
      mode: "onChange",
      defaultValues: {
         tenant_id: "",
         room_id: "",
         bed_space_id: "",
         contract_type: "month_to_month",
         move_in_date: new Date().toISOString().split("T")[0],
         expected_move_out: "",
         deposit_amount: "",
         monthly_rate: "",
         monthly_rate_override: "",
         notes: "",
      },
   });

   const { execute: submitContract, isPending: isActionPending } = useAction("/api/contracts", {
      method: "POST",
      successMessage: "Contract record created successfully.",
      onSuccess: (response) => {
         // apiRequest already unwraps the Laravel 'data' envelope
         setCreatedContract(response);
         setCurrentStepIndex(3); // Transition to Settlement Step
      },
      onError: (err) => {
         applyServerFieldErrors(err, setError, { showToast });

         // Logic to jump to the step with the first error
         const errors = err.info?.errors || err.errors;
         if (errors) {
            const firstErrorField = Object.keys(errors)[0];
            if (["room_id", "bed_space_id", "tenant_id"].includes(firstErrorField)) {
               setCurrentStepIndex(0);
            } else if (
               [
                  "monthly_rate",
                  "deposit_amount",
                  "contract_type",
                  "move_in_date",
                  "expected_move_out",
               ].includes(firstErrorField)
            ) {
               setCurrentStepIndex(1);
            }
         }
      },
   });

   useUnsavedChangesWarning(isDirty && !isActionPending);
   const { data: tenantData } = useSWR(
      currentUser ? "/api/tenants?per_page=100" : null,
      fetcher
   );
   const { data: roomData } = useSWR(
      currentUser ? "/api/rooms?per_page=100" : null,
      fetcher
   );
   const { data: contractData } = useSWR(
      currentUser ? "/api/contracts?per_page=100" : null,
      fetcher
   );
   const tenants = useMemo(
      () => (tenantData ? normalizePaginatedList(tenantData).rows : []),
      [tenantData]
   );
   const rooms = useMemo(
      () => (roomData ? normalizePaginatedList(roomData).rows : []),
      [roomData]
   );
   const contracts = useMemo(
      () => (contractData ? normalizePaginatedList(contractData).rows : []),
      [contractData]
   );
   const loading = !tenantData || !roomData || !contractData;
   const lastRoomIdForRentRef = useRef(null);
   const watchedTenantId = useWatch({ control, name: "tenant_id" });
   const selectedRoomId = useWatch({ control, name: "room_id" });
   const contractType = useWatch({ control, name: "contract_type" });
   const isFixedTerm = contractType === "fixed_term";
   const selectedRoom = rooms.find((room) => String(room.room_id) === String(selectedRoomId));
   const isSharedRoom = selectedRoom?.room_type === "shared";
   const eligibleTenants = useMemo(() => {
      const activeContractTenantIds = new Set(
         contracts
            .filter((c) => ACTIVE_CONTRACT_STATUS_KEYS.includes(c.status))
            .map((c) => Number(c.tenant_id)),
      );
      return tenants.filter(
         (t) =>
            t.status !== "archived" &&
            (!activeContractTenantIds.has(Number(t.tenant_id)) || (renewContractId && Number(t.tenant_id) === Number(watchedTenantId))),
      );
   }, [tenants, contracts, renewContractId, watchedTenantId]);

   const hasNoTenants = !loading && tenants.length === 0;
   const hasNoEligibleTenants = !loading && tenants.length > 0 && eligibleTenants.length === 0;
   const hasNoRooms = !loading && rooms.length === 0;
   // Handle Renewal Pre-filling
   useEffect(() => {
      if (!renewContractId || loading) return;

      const loadRenewalSource = async () => {
         try {
            const res = await apiRequest(`/api/contracts/${renewContractId}`);
            const source = res.data || res;

            if (source) {
               // Pre-fill values for renewal
               setValue("tenant_id", source.tenant_id);
               setValue("room_id", source.room_id);
               setValue("bed_space_id", source.bed_space_id);
               setValue("contract_type", source.contract_type);
               setValue("monthly_rate", source.monthly_rate_override || source.monthly_rate);
               setValue("deposit_amount", source.deposit_amount);

               // BR-CON-011: New move-in is expected_move_out + 1 day
               if (source.expected_move_out_date) {
                  const nextDate = new Date(source.expected_move_out_date);
                  nextDate.setDate(nextDate.getDate() + 1);
                  setValue("move_in_date", nextDate.toISOString().split("T")[0]);
               }

               showToast("Previous contract terms pre-filled. Please review before submitting.", "info");
            }
         } catch (err) {
            showToast("Could not load previous contract details. Please fill in the form manually.", "warning");
         }
      };

      loadRenewalSource();
   }, [renewContractId, loading, setValue, showToast]);

   useEffect(() => {
      const loadBedSpaces = async () => {
         if (!selectedRoomId || (!isSharedRoom && !renewContractId)) {
            setBedSpaceOptions([]);
            return;
         }
         try {
            const room = await apiRequest(`/api/rooms/${selectedRoomId}`, { method: "GET" });
            const candidates = Array.isArray(room?.bed_spaces)
               ? room.bed_spaces
               : Array.isArray(room?.bedSpaces)
                  ? room.bedSpaces
                  : [];
            setBedSpaceOptions(candidates);
         } catch {
            setBedSpaceOptions([]);
         }
      };
      loadBedSpaces();
   }, [selectedRoomId, isSharedRoom, renewContractId]);
   useEffect(() => {
      if (!selectedRoomId) {
         lastRoomIdForRentRef.current = null;
         setValue("monthly_rate", "");
         setValue("deposit_amount", "");
         return;
      }
      const id = String(selectedRoomId);
      if (lastRoomIdForRentRef.current === id) return;
      const roomData = rooms.find((r) => String(r.room_id) === id);
      if (!roomData) {
         setValue("monthly_rate", "");
         setValue("deposit_amount", "");
         return;
      }
      lastRoomIdForRentRef.current = id;
      const roomRate = parseMoneyInput(roomData.monthly_rate ?? 0);
      const suggestedRate = roomRate.toFixed(2);
      setValue("monthly_rate", suggestedRate, { shouldDirty: true });
      // Default deposit to 1 month rent (Standard 1+1 rule)
      setValue("deposit_amount", suggestedRate, { shouldDirty: true });
   }, [selectedRoomId, rooms, setValue]);
   const validateStep = async (stepIndex) => {
      if (stepIndex === 0) {
         const isBaseValid = await trigger(["tenant_id", "room_id", "bed_space_id"]);
         if (!isBaseValid) return false;

         // BR-MET-002: Check for active meter assignments if room is metered
         if (selectedRoom?.is_metered && (selectedRoom?.active_meters_count ?? 0) === 0) {
            setError("room_id", {
               type: "manual",
               message: "NO ACTIVE METERS: This room is metered but lacks an active meter assignment."
            });
            return false;
         }
         return true;
      }

      if (stepIndex === 1) {
         const fieldsToValidate = ["contract_type", "move_in_date", "deposit_amount", "monthly_rate"];
         // BR-CON-004: only validate expected_move_out as required when fixed_term
         if (isFixedTerm) fieldsToValidate.push("expected_move_out");

         const isBaseValid = await trigger(fieldsToValidate);
         if (!isBaseValid) return false;

         // Extra safety check for empty numeric strings or invalid numbers that might bypass trigger
         const rate = getValues("monthly_rate");
         const parsedRate = parseMoneyInput(rate);
         if (!rate || isNaN(parsedRate) || parsedRate <= 0) {
            setError("monthly_rate", { type: "manual", message: "Valid monthly rent is required." });
            return false;
         }

         const deposit = getValues("deposit_amount");
         const parsedDeposit = parseMoneyInput(deposit);
         if (deposit === "" || isNaN(parsedDeposit) || parsedDeposit < 0) {
            setError("deposit_amount", { type: "manual", message: "Valid security deposit is required." });
            return false;
         }

         return true;
      }
      return true;
   };
   const onNext = async () => {
      const isValid = await validateStep(currentStepIndex);
      if (isValid) setCurrentStepIndex((prev) => Math.min(prev + 1, totalSteps - 1));
   };
   const onBack = () => setCurrentStepIndex((prev) => Math.max(prev - 1, 0));
   const onSubmit = async () => {
      if (isActionPending) return;

      const isStep0Valid = await validateStep(0);
      if (!isStep0Valid) {
         setCurrentStepIndex(0);
         return;
      }

      const isStep1Valid = await validateStep(1);
      if (!isStep1Valid) {
         setCurrentStepIndex(1);
         return;
      }

      if (!canManageContracts(currentUser)) {
         showToast("Permission denied: only Admins and Staff can create contracts.", "error");
         return;
      }

      const values = getValues();
      const payload = {
         tenant_id: Number(values.tenant_id),
         room_id: Number(values.room_id),
         bed_space_id: values.bed_space_id ? Number(values.bed_space_id) : null,
         contract_type: values.contract_type || "month_to_month",
         move_in_date: values.move_in_date,
         expected_move_out: values.expected_move_out || null,
         deposit_amount: parseMoneyInput(values.deposit_amount),
         monthly_rate: parseMoneyInput(values.monthly_rate),
         notes: values.notes || null,
      };

      try {
         await submitContract(payload);
      } catch (error) {
         // Handled by useAction
      }
   };
   const readOnly = !canManageContracts(currentUser);
   const wizardSteps = [
      { label: "Room Assignment" },
      { label: "Financial Terms" },
      { label: "Final Review" },
      { label: "Initial Settlement" }
   ];
   return (
      <StandardPage
         title="Register Contract"
         subtitle="Link a tenant to a bed space."
         skeleton={<SkeletonDetailPage />}
         loading={loading}
         breadcrumbs={
            <Breadcrumbs
               items={[
                  { label: "Contracts", href: "/contracts" },
                  { label: "Register Contract" },
               ]}
            />
         }
      >
         {readOnly && (
            <Alert variant="warning" title="Restricted Role" className="max-w-4xl mx-auto mb-6">
               You do not have permission to create contracts.
            </Alert>
         )}

         {hasNoTenants && (
            <Alert variant="warning" title="Prerequisite Required" className="max-w-4xl mx-auto mb-6">
               No tenant records found in the directory. You must <Link href="/tenants/new" className="underline font-bold">register a tenant</Link> before generating a contract.
            </Alert>
         )}

         {hasNoEligibleTenants && !hasNoTenants && (
            <Alert variant="info" title="No Eligible Tenants" className="max-w-4xl mx-auto mb-6">
               All registered tenants are currently linked to active contracts. <Link href="/tenants/new" className="underline font-bold">Register a new tenant</Link> to proceed.
            </Alert>
         )}

         {hasNoRooms && (
            <Alert variant="warning" title="Inventory Required" className="max-w-4xl mx-auto mb-6">
               No rooms found in the inventory. You must <Link href="/rooms/new" className="underline font-bold">add a room</Link> before generating a contract.
            </Alert>
         )}

         <WizardFrame
            title="Contract Ledger Registration"
            steps={wizardSteps}
            currentStepIndex={currentStepIndex}
            onNext={onNext}
            onBack={onBack}
            onCancel={() => router.push("/contracts")}
            onSubmit={onSubmit}
            submitLabel="Register Contract"
            isSubmitting={isActionPending}
            hideNavigation={currentStepIndex === 3 || !!createdContract}
            isLastStepOverride={currentStepIndex === 2}
         >
            <div className="space-y-6">
               {currentStepIndex === 0 && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                     <div className="grid gap-6 sm:grid-cols-2">
                        <Field
                           label="Tenant"
                           required
                           error={errors.tenant_id?.message}
                           helpText="Only tenants without active agreements are listed."
                        >
                           <Select
                              autoFocus
                              hasError={Boolean(errors.tenant_id)}
                              disabled={readOnly || hasNoEligibleTenants}
                              className="!h-12 border-stone-200 font-bold"
                              {...register("tenant_id", { required: "Assign a resident to this contract." })}
                           >
                              <option value="">
                                 {hasNoTenants ? "No tenants registered" : hasNoEligibleTenants ? "No available tenants found" : "Select Tenant"}
                              </option>
                              {eligibleTenants.map((t) => (
                                 <option key={t.tenant_id} value={t.tenant_id}>
                                    {formatTenantDirectoryName(t)} (#TENANT-{String(t.tenant_id).padStart(4, "0")})
                                 </option>
                              ))}
                           </Select>
                        </Field>
                        <Field label="Room" required error={errors.room_id?.message}>
                           <Select
                              hasError={Boolean(errors.room_id)}
                              disabled={readOnly || hasNoRooms}
                              className="!h-12 border-stone-200 font-bold"
                              {...register("room_id", { required: "Select a room unit." })}
                           >
                              <option value="">
                                 {hasNoRooms ? "No rooms in inventory" : "Select room"}
                              </option>
                              {rooms.map((room) => (
                                 <option
                                    key={room.room_id}
                                    value={room.room_id}
                                    disabled={room.status === "unavailable" || room.status === "maintenance" || room.status === "archived"}
                                 >
                                    {room.room_code} (#ROOM-{String(room.room_id).padStart(3, "0")}){room.is_metered ? ` (METERED)${room.meter_serials?.length > 0 ? ` (SN: ${room.meter_serials.join(", ")})` : ""}` : ""}
                                 </option>
                              ))}
                           </Select>
                        </Field>
                     </div>
                     <div className="mt-6">
                        <Field
                           label="Bed Space"
                           error={errors.bed_space_id?.message}
                           helpText={isSharedRoom ? "Select an available bed." : "System will auto-assign for solo units."}
                        >
                           <Select
                              hasError={Boolean(errors.bed_space_id)}
                              disabled={readOnly || !isSharedRoom || !bedSpaceOptions.some((b) => b.status === "vacant")}
                              className="!h-12 border-stone-200 font-bold"
                              {...register("bed_space_id", {
                                 validate: (value) => isSharedRoom && !value ? "Bed assignment is required for shared units." : true,
                              })}
                           >
                              <option value="">
                                 {isSharedRoom ? (bedSpaceOptions.some(b => b.status === 'vacant') ? "Select Bed" : "No vacancy") : "N/A — Subsumed by Room"}
                              </option>
                              {bedSpaceOptions.map((bed) => {
                                 const isReserved = !!bed.active_contract;
                                 const isRenewalTarget = isReserved && String(bed.active_contract.contract_id) === String(renewContractId);
                                 const isAvailable = (bed.status === "vacant" && !isReserved) || isRenewalTarget;

                                 return (
                                    <option key={bed.bed_space_id} value={bed.bed_space_id} disabled={!isAvailable}>
                                       {bed.bed_label || `Bed #${bed.bed_space_id}`} {isRenewalTarget ? "(CURRENT)" : isReserved ? "(RESERVED)" : ""}
                                    </option>
                                 );
                              })}
                           </Select>
                        </Field>
                     </div>
                  </div>
               )}
               {currentStepIndex === 1 && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                     {/* Agreement Type (BR-CON-004): determines if end date is required */}
                     <Field
                        label="Agreement Type"
                        required
                        error={errors.contract_type?.message}
                        helpText="Month-to-month is open-ended with no end date required. Fixed term leases require one."
                     >
                        <Select
                           autoFocus
                           hasError={Boolean(errors.contract_type)}
                           disabled={readOnly}
                           className="!h-12 border-stone-200 font-bold"
                           {...register("contract_type", { required: "Select a contract type." })}
                        >
                           <option value="month_to_month">Month-to-Month (Open-ended)</option>
                           <option value="fixed_term">Fixed Term</option>
                        </Select>
                     </Field>
                     <div className="grid gap-6 md:grid-cols-2">
                        <Field label="Start Date" required error={errors.move_in_date?.message}>
                           <Input
                              type="date"
                              hasError={Boolean(errors.move_in_date)}
                              disabled={readOnly}
                              className="!h-12 border-stone-200 font-bold"
                              {...register("move_in_date", { required: "Move-in date is required." })}
                           />
                        </Field>
                        <Field
                           label={isFixedTerm ? "End Date" : "Expected Move-Out (Optional)"}
                           required={isFixedTerm}
                           error={errors.expected_move_out?.message}
                           helpText={isFixedTerm
                              ? "Required for fixed-term leases."
                              : "Leave blank for open-ended agreements."
                           }
                        >
                           <Input
                              type="date"
                              hasError={Boolean(errors.expected_move_out)}
                              disabled={readOnly}
                              className="!h-12 border-stone-200 font-bold"
                              {...register("expected_move_out", {
                                 required: isFixedTerm ? "Move-out date is required for fixed-term contracts." : false,
                                 validate: (val) => !val || new Date(val) > new Date(getValues("move_in_date")) || "Must be after the start date.",
                              })}
                           />
                        </Field>
                     </div>
                     <div className="grid gap-6 md:grid-cols-2 mt-6">
                        <Field label="Monthly Rent" required error={errors.monthly_rate?.message}>
                           <Input
                              type="number"
                              step="0.01"
                              prefix="₱"
                              hasError={Boolean(errors.monthly_rate)}
                              disabled={readOnly}
                              className="!h-12 border-stone-200 font-mono text-lg font-bold"
                              {...register("monthly_rate", {
                                 required: "Monthly rent is required.",
                                 min: { value: 0.01, message: "Rent must be a positive amount." },
                              })}
                           />
                        </Field>
                        <Field label="Security Deposit" required error={errors.deposit_amount?.message}>
                           <Input
                              type="number"
                              step="0.01"
                              prefix="₱"
                              hasError={Boolean(errors.deposit_amount)}
                              disabled={readOnly}
                              className="!h-12 border-stone-200 font-mono text-lg font-bold"
                              {...register("deposit_amount", {
                                 required: "Security deposit is required.",
                                 min: { value: 0, message: "Deposit cannot be negative." },
                              })}
                           />
                        </Field>
                     </div>
                     <div className="mt-6">
                        <Field label="Monthly Rent Override (Optional)" error={errors.monthly_rate_override?.message} helpText="Check if you want to charge a different rate than the room's base rate">
                           <Input
                              type="number"
                              step="0.01"
                              prefix="₱"
                              hasError={Boolean(errors.monthly_rate_override)}
                              disabled={readOnly}
                              placeholder="0.00"
                              className="!h-12 border-stone-200 font-mono font-black tabular-nums"
                              {...register("monthly_rate_override")}
                           />
                        </Field>
                     </div>
                  </div>
               )}
               {currentStepIndex === 2 && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                     <div className="grid gap-8 md:grid-cols-2">
                        <div className="space-y-4 rounded-2xl bg-stone-50/50 p-6 border border-stone-100">
                           <span className="hs-strip-title text-stone-400">Lease Preview</span>
                           <div className="space-y-3">
                              <div className="flex justify-between">
                                 <span className="text-xs font-medium text-stone-500">Tenant</span>
                                 <span className="text-xs font-bold text-stone-900">{tenants.find(t => String(t.tenant_id) === String(getValues("tenant_id")))?.first_name} {tenants.find(t => String(t.tenant_id) === String(getValues("tenant_id")))?.last_name}</span>
                              </div>
                              <div className="flex justify-between">
                                 <span className="text-xs font-medium text-stone-500">Room / Bed</span>
                                 <span className="text-xs font-bold text-stone-900">{rooms.find(r => String(r.room_id) === String(getValues("room_id")))?.room_code}</span>
                              </div>
                           </div>
                        </div>
                        <div className="space-y-4 rounded-2xl bg-teal-50/50 p-6 border border-teal-100">
                           <span className="hs-strip-title text-teal-700/60">Move-in Costs</span>
                           <div className="space-y-3">
                              <div className="flex justify-between items-center">
                                 <span className="text-xs font-medium text-teal-800/80">Security Deposit</span>
                                 <CurrencyDisplay amount={getValues("deposit_amount") || 0} className="text-sm font-bold text-teal-900" />
                              </div>
                              <div className="flex justify-between items-center">
                                 <span className="text-xs font-medium text-teal-800/80">First Month Advance</span>
                                 <CurrencyDisplay amount={getValues("monthly_rate") || 0} className="text-sm font-bold text-teal-900" />
                              </div>
                              <div className="pt-3 border-t border-teal-200/50 flex justify-between items-center">
                                 <span className="hs-strip-title text-teal-800">Total Initial Payment</span>
                                 <CurrencyDisplay amount={Number(getValues("monthly_rate") || 0) + Number(getValues("deposit_amount") || 0)} className="text-lg font-bold text-teal-700" />
                              </div>
                           </div>
                        </div>
                     </div>
                     <div className="mt-8">
                        <Field label="Administrative Context">
                           <Textarea
                              rows={3}
                              placeholder="Document any special considerations for this lease..."
                              className="border-stone-200"
                              {...register("notes")}
                           />
                        </Field>
                     </div>
                     <div className="flex items-center gap-3 rounded-2xl bg-stone-50 p-6 text-stone-500">
                        <ShieldCheck size={20} className="text-stone-300 shrink-0" />
                        <p className="hs-strip-title text-stone-500 leading-relaxed">
                           Registering a contract initiates a legal ledger record. Ensure all financial terms are verified against the standard room rates.
                        </p>
                     </div>
                  </div>
               )}

               {currentStepIndex === 3 && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                     {!createdContract ? (
                        <div className="flex flex-col items-center justify-center py-20 text-stone-400">
                           <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-stone-300 mb-4" />
                           <p className="text-[10px] font-black uppercase tracking-[0.2em]">Finalizing Agreement...</p>
                        </div>
                     ) : (
                        <>
                           <div className="flex flex-col items-center text-center space-y-4 py-4">
                              <div className="flex size-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-500 shadow-sm border border-emerald-100">
                                 <CheckCircle2 size={32} strokeWidth={2.5} />
                              </div>
                              <div>
                                 <h3 className="text-xl font-black text-stone-900">Registration Complete</h3>
                                 <p className="text-xs font-medium text-stone-500 mt-1 uppercase tracking-widest">Contract #{String(createdContract.contract_id).padStart(6, '0')}</p>
                              </div>
                           </div>

                           <div className="grid gap-6 md:grid-cols-2">
                              <div className="rounded-2xl border border-stone-100 bg-stone-50/50 p-6 space-y-4">
                                 <div className="flex items-center gap-2 text-stone-400">
                                    <ReceiptText size={16} />
                                    <span className="text-[10px] font-black uppercase tracking-widest">Ledger Balance</span>
                                 </div>
                                 <div className="space-y-3">
                                    <div className="flex justify-between items-center text-xs">
                                       <span className="font-medium text-stone-500">Security Deposit</span>
                                       <div className="flex items-center gap-2">
                                          <CurrencyDisplay amount={createdContract?.deposit_amount || 0} className="font-bold text-stone-600" />
                                          {isFullySettled ? <CheckCircle2 size={12} className="text-emerald-500" /> : <div className="size-2 rounded-full bg-amber-400 animate-pulse" />}
                                       </div>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                       <span className="font-medium text-stone-500">First Month Rent</span>
                                       <div className="flex items-center gap-2">
                                          <CurrencyDisplay amount={createdContract?.monthly_rate || 0} className="font-bold text-stone-600" />
                                          {isFullySettled ? <CheckCircle2 size={12} className="text-emerald-500" /> : <div className="size-2 rounded-full bg-amber-400 animate-pulse" />}
                                       </div>
                                    </div>
                                    <div className="pt-3 border-t border-stone-200/50 flex justify-between items-baseline">
                                       <span className="text-[10px] font-black uppercase text-rose-500">Total Settlement Required</span>
                                       <CurrencyDisplay
                                          amount={isFullySettled ? 0 : Number(createdContract?.monthly_rate || 0) + Number(createdContract?.deposit_amount || 0)}
                                          className="text-2xl font-black text-stone-900"
                                       />
                                    </div>
                                 </div>
                              </div>

                              <div className="flex flex-col justify-center space-y-3">
                                 {!isFullySettled ? (
                                    <Button
                                       variant="primary"
                                       className="!h-14 w-full rounded-xl text-xs font-black uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-900/10 active:scale-95 transition-all"
                                       onClick={() => setShowPaymentSheet(true)}
                                    >
                                       <Wallet className="mr-2" size={16} />
                                       Settle Full Amount
                                    </Button>
                                 ) : (
                                    <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700">
                                       <CheckCircle2 size={20} />
                                       <span className="text-xs font-black uppercase tracking-widest">Onboarding Fully Settled</span>
                                    </div>
                                 )}

                                 <Button
                                    variant="secondary"
                                    className="!h-14 w-full rounded-xl text-xs font-black uppercase tracking-widest border-stone-200 text-stone-600 hover:bg-stone-100 active:scale-95 transition-all"
                                    onClick={() => router.push(`/contracts/${createdContract.contract_id}`)}
                                    disabled={!createdContract?.contract_id}
                                 >
                                    View Contract Details
                                    <ArrowRight className="ml-2" size={16} />
                                 </Button>
                              </div>
                           </div>

                           <div className="rounded-2xl border border-teal-600/10 bg-teal-50/30 p-6 flex items-start gap-4 hs-glass-effect">
                              <ShieldCheck className="text-teal-600 mt-1" size={20} />
                              <div className="space-y-1">
                                 <p className="text-xs font-bold text-teal-900">Professional Onboarding Tip</p>
                                 <p className="text-[10px] font-medium text-teal-700 leading-relaxed">
                                    Collecting the security deposit and first month's rent upfront ensures the lease is legally enforceable and protects the property from occupancy risks.
                                 </p>
                              </div>
                           </div>
                        </>
                     )}
                  </div>
               )}
            </div>
         </WizardFrame>

         <SideSheetOverlay
            isOpen={showPaymentSheet}
            onClose={() => setShowPaymentSheet(false)}
            title="Record Initial Payment"
            size="lg"
         >
            <div className="p-6 pt-0">
               <PaymentWizard
                  isInitialSettlement={true}
                  initialValues={{
                     contract_id: createdContract?.contract_id,
                     billing_id: createdContract?.latest_billing?.billing_id,
                     rent_amount: createdContract?.monthly_rate,
                     deposit_amount: createdContract?.deposit_amount,
                     amount_paid: Number(createdContract?.deposit_amount || 0) + Number(createdContract?.monthly_rate || 0),
                  }}
                  onSuccess={() => {
                     setIsFullySettled(true);
                     setShowPaymentSheet(false);
                     showToast("Full onboarding settlement recorded successfully.", "success");
                  }}
                  onCancel={() => setShowPaymentSheet(false)}
               />
            </div>
         </SideSheetOverlay>
      </StandardPage>
   );
}
