"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm, useWatch } from "react-hook-form";
import { ShieldCheck } from "lucide-react";
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
export default function NewContractPage() {
   const router = useRouter();
   const searchParams = useSearchParams();
   const renewContractId = searchParams.get("renew_contract_id");
   const { user: currentUser } = useAuth();
   const { showToast } = useToasts();
   const [bedSpaceOptions, setBedSpaceOptions] = useState([]);
   const [currentStepIndex, setCurrentStepIndex] = useState(0);
   const totalSteps = 3;
   const {
      register,
      control,
      getValues,
      setValue,
      trigger,
      setError,
      formState: { errors, isDirty },
   } = useForm({
      defaultValues: {
         tenant_id: "",
         room_id: "",
         bed_space_id: "",
         contract_type: "month_to_month",
         move_in_date: new Date().toISOString().split("T")[0],
         expected_move_out: "",
         deposit_amount: "",
         monthly_rent: "",
         monthly_rate_override: "",
         notes: "",
      },
   });

   const { execute: submitContract, isPending: isActionPending } = useAction("/api/contracts", {
      method: "POST",
      successMessage: "Contract registered and initial billing generated.",
      onSuccess: (response) => {
         const initialBillingId = response?.data?.latest_billing?.billing_id || response?.latest_billing?.billing_id;
         if (initialBillingId) {
            router.push(`/billing/${initialBillingId}`);
         } else if (response?.data?.contract_id) {
            router.push(`/contracts/${response.data.contract_id}`);
         } else {
            router.push("/contracts");
         }
      },
      onError: (err) => {
         applyServerFieldErrors(err, setError, { showToast });
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
               setValue("monthly_rent", source.monthly_rate_override || source.monthly_rate);
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
         setValue("monthly_rent", "");
         setValue("deposit_amount", "");
         return;
      }
      const id = String(selectedRoomId);
      if (lastRoomIdForRentRef.current === id) return;
      const roomData = rooms.find((r) => String(r.room_id) === id);
      if (!roomData) {
         setValue("monthly_rent", "");
         setValue("deposit_amount", "");
         return;
      }
      lastRoomIdForRentRef.current = id;
      const roomRate = parseMoneyInput(roomData.monthly_rate ?? 0);
      const suggestedRate = roomRate.toFixed(2);
      setValue("monthly_rent", suggestedRate, { shouldDirty: true });
      // Default deposit to 1 month rent (Standard 1+1 rule)
      setValue("deposit_amount", suggestedRate, { shouldDirty: true });
   }, [selectedRoomId, rooms, setValue]);
   const validateStep = async (stepIndex) => {
      if (stepIndex === 0) {
         return await trigger(["tenant_id", "room_id", "bed_space_id"]);
      }
      if (stepIndex === 1) {
         const fieldsToValidate = ["contract_type", "move_in_date", "deposit_amount", "monthly_rent"];
         // BR-CON-004: only validate expected_move_out as required when fixed_term
         if (isFixedTerm) fieldsToValidate.push("expected_move_out");
         return await trigger(fieldsToValidate);
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
      // Final check before massive submission
      const isValid = await trigger();
      if (!isValid) return;
      if (!canManageContracts(currentUser)) {
         showToast("Permission denied: only Admins and Staff can create contracts.", "error");
         return;
      }
      const values = getValues();
      let bedSpaceId = values.bed_space_id;
      if (!isSharedRoom && selectedRoom) {
         try {
            const room = await apiRequest(`/api/rooms/${selectedRoomId}`, { method: "GET" });
            const bedSpaces = Array.isArray(room?.bed_spaces) ? room.bed_spaces : (room?.bedSpaces || []);
            if (bedSpaces.length > 0) bedSpaceId = bedSpaces[0].bed_space_id;
            else {
               showToast("This room has no bed spaces set up. Please configure the room inventory first.", "error");
               return;
            }
         } catch {
            showToast("Unable to load room inventory. Please try again.", "error");
            return;
         }
      }
      if (!bedSpaceId) {
         setError("bed_space_id", { type: "manual", message: "Bed space is required." });
         return;
      }
      const payload = {
         tenant_id: Number(values.tenant_id),
         bed_space_id: Number(bedSpaceId),
         contract_type: values.contract_type || "month_to_month",
         move_in_date: values.move_in_date,
         expected_move_out: values.expected_move_out || null,
         deposit_amount: parseMoneyInput(values.deposit_amount),
         monthly_rate: parseMoneyInput(values.monthly_rent),
         monthly_rate_override: values.monthly_rate_override ? parseMoneyInput(values.monthly_rate_override) : null,
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
      { label: "Final Review" }
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
                                    {room.room_code} (#ROOM-{String(room.room_id).padStart(3, "0")})
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
                        <Field label="Monthly Rent" required error={errors.monthly_rent?.message}>
                           <Input
                              type="number"
                              step="0.01"
                              prefix="₱"
                              hasError={Boolean(errors.monthly_rent)}
                              disabled={readOnly}
                              className="!h-12 border-stone-200 font-mono font-black tabular-nums"
                              {...register("monthly_rent", { required: "Monthly rate required." })}
                           />
                        </Field>
                        <Field label="Security Deposit" required error={errors.deposit_amount?.message} helpText="Recommendation: Equal to 1 month rent.">
                           <Input
                              type="number"
                              step="0.01"
                              prefix="₱"
                              hasError={Boolean(errors.deposit_amount)}
                              disabled={readOnly}
                              className="!h-12 border-stone-200 font-mono font-black tabular-nums"
                              {...register("deposit_amount", { required: "Deposit required." })}
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
                                 <CurrencyDisplay amount={getValues("monthly_rent") || 0} className="text-sm font-bold text-teal-900" />
                              </div>
                              <div className="pt-3 border-t border-teal-200/50 flex justify-between items-center">
                                 <span className="hs-strip-title text-teal-800">Total Initial Payment</span>
                                 <CurrencyDisplay amount={Number(getValues("monthly_rent") || 0) + Number(getValues("deposit_amount") || 0)} className="text-lg font-bold text-teal-700" />
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
            </div>
         </WizardFrame>
      </StandardPage>
   );
}
