"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { ShieldCheck } from "lucide-react";
import { apiRequest, fetcher } from "@/lib/api";
import useSWR from "swr";
import { canManageContracts } from "@/lib/auth";
import { applyServerFieldErrors } from "@/lib/forms";
import { useUnsavedChangesWarning } from "@/hooks/useUnsavedChangesWarning";
import { formatPHP, formatTenantDirectoryName, parseMoneyInput } from "@/lib/formatters";
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
   const { user: currentUser } = useAuth();
   const { showToast } = useToasts();
   const [bedSpaceOptions, setBedSpaceOptions] = useState([]);
   const [apiError, setApiError] = useState("");
   const [currentStepIndex, setCurrentStepIndex] = useState(0);
   const totalSteps = 3;
   const {
      register,
      control,
      getValues,
      setValue,
      trigger,
      setError,
      formState: { errors, isSubmitting, isDirty },
   } = useForm({
      defaultValues: {
         tenant_id: "",
         room_id: "",
         bed_space_id: "",
         move_in_date: new Date().toISOString().split("T")[0],
         expected_move_out: "",
         deposit_amount: "",
         monthly_rent: "",
         monthly_rate_override: "",
         notes: "",
      },
   });
   useUnsavedChangesWarning(isDirty && !isSubmitting);
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
   const selectedRoomId = useWatch({ control, name: "room_id" });
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
            t.status !== "archived" && !activeContractTenantIds.has(Number(t.tenant_id)),
      );
   }, [tenants, contracts]);
   useEffect(() => {
      const loadBedSpaces = async () => {
         if (!selectedRoomId || !isSharedRoom) {
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
   }, [selectedRoomId, isSharedRoom]);
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
         return await trigger(["move_in_date", "expected_move_out", "deposit_amount", "monthly_rent"]);
      }
      return true;
   };
   const onNext = async () => {
      const isValid = await validateStep(currentStepIndex);
      if (isValid) setCurrentStepIndex((prev) => Math.min(prev + 1, totalSteps - 1));
   };
   const onBack = () => setCurrentStepIndex((prev) => Math.max(prev - 1, 0));
   const onSubmit = async () => {
      // Final check before massive submission
      const isValid = await trigger();
      if (!isValid) return;
      setApiError("");
      if (!canManageContracts(currentUser)) {
         setApiError("Unauthorized: only Admin or Staff can create contracts.");
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
               setApiError("Solo room has no bed spaces configured.");
               return;
            }
         } catch {
            setApiError("Failed to load inventory for this room.");
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
         move_in_date: values.move_in_date,
         expected_move_out: values.expected_move_out || null,
         deposit_amount: parseMoneyInput(values.deposit_amount),
         monthly_rate: parseMoneyInput(values.monthly_rent),
         monthly_rate_override: values.monthly_rate_override ? parseMoneyInput(values.monthly_rate_override) : null,
         notes: values.notes || null,
      };
      try {
         const response = await apiRequest("/api/contracts", {
            method: "POST",
            body: JSON.stringify(payload),
         });
         showToast("Contract registered and initial billing generated.", "success");
         // Navigate to the newly generated initial billing to fulfill the fallback pending_payment workflow.
         const initialBillingId = response?.data?.latest_billing?.billing_id || response?.latest_billing?.billing_id;
         if (initialBillingId) {
            router.push(`/billing/${initialBillingId}`);
         } else if (response?.data?.contract_id) {
            router.push(`/contracts/${response.data.contract_id}`);
         } else {
            router.push('/contracts');
         }
      } catch (error) {
         applyServerFieldErrors(error, setError, { setApiError });
      }
   };
   const readOnly = !canManageContracts(currentUser);
   const wizardSteps = [
      { label: "Asset Allocation" },
      { label: "Financial Terms" },
      { label: "Final Review" }
   ];
   return (
      <StandardPage
         title="Register Contract"
         subtitle="ESTABLISH A NEW CONTRACTUAL AGREEMENT"
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
         {apiError && <Alert variant="error" title="Submission Error" className="max-w-4xl mx-auto mb-6">{apiError}</Alert>}
         <WizardFrame
            title="Contract Ledger"
            steps={wizardSteps}
            currentStepIndex={currentStepIndex}
            onNext={onNext}
            onBack={onBack}
            onCancel={() => router.push("/contracts")}
            onSubmit={onSubmit}
            isSubmitting={isSubmitting}
         >
            <div className="space-y-6">
               {currentStepIndex === 0 && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                     <div className="grid gap-6 sm:grid-cols-2">
                        <Field
                           label="Primary Tenant"
                           required
                           error={errors.tenant_id?.message}
                           helpText="Only tenants without active agreements are listed."
                        >
                           <Select
                              autoFocus
                              hasError={Boolean(errors.tenant_id)}
                              disabled={readOnly}
                              className="!h-12 border-stone-200 font-bold"
                              {...register("tenant_id", { required: "Assign a resident to this contract." })}
                           >
                              <option value="">Select Tenant</option>
                              {eligibleTenants.map((t) => (
                                 <option key={t.tenant_id} value={t.tenant_id}>
                                    {formatTenantDirectoryName(t)} (#TENANT-{String(t.tenant_id).padStart(4, "0")})
                                 </option>
                              ))}
                           </Select>
                        </Field>
                        <Field label="Target Room" required error={errors.room_id?.message}>
                           <Select
                              hasError={Boolean(errors.room_id)}
                              disabled={readOnly}
                              className="!h-12 border-stone-200 font-bold"
                              {...register("room_id", { required: "Select a room unit." })}
                           >
                              <option value="">Select room</option>
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
                           label="Bed Space Allocation"
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
                                 const isAvailable = bed.status === "vacant" && !isReserved;
                                 return (
                                    <option key={bed.bed_space_id} value={bed.bed_space_id} disabled={!isAvailable}>
                                       {bed.bed_label || `Bed #${bed.bed_space_id}`} {isReserved ? "(RESERVED)" : ""}
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
                     <div className="grid gap-6 md:grid-cols-2">
                        <Field label="Start Date" required error={errors.move_in_date?.message}>
                           <Input
                              type="date"
                              autoFocus
                              hasError={Boolean(errors.move_in_date)}
                              disabled={readOnly}
                              className="!h-12 border-stone-200 font-bold"
                              {...register("move_in_date", { required: "Move-in date is required." })}
                           />
                        </Field>
                        <Field label="End Date" required error={errors.expected_move_out?.message}>
                           <Input
                              type="date"
                              hasError={Boolean(errors.expected_move_out)}
                              disabled={readOnly}
                              className="!h-12 border-stone-200 font-bold"
                              {...register("expected_move_out", {
                                 required: "Expected move-out date is required.",
                                 validate: (val) => !val || new Date(val) > new Date(getValues("move_in_date")) || "Must be after inception.",
                              })}
                           />
                        </Field>
                     </div>
                     <div className="grid gap-6 md:grid-cols-2 mt-6">
                        <Field label="Monthly Rate" required error={errors.monthly_rent?.message}>
                           <Input
                              type="number"
                              step="0.01"
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
                              hasError={Boolean(errors.deposit_amount)}
                              disabled={readOnly}
                              className="!h-12 border-stone-200 font-mono font-black tabular-nums"
                              {...register("deposit_amount", { required: "Deposit required." })}
                           />
                        </Field>
                     </div>
                     <div className="mt-6">
                        <Field label="Monthly Rate Override (Optional)" error={errors.monthly_rate_override?.message} helpText="Applies a custom billing rate for this tenant without changing the room's base rate. Locked after contract activation (BR-CON-013).">
                           <Input
                              type="number"
                              step="0.01"
                              hasError={Boolean(errors.monthly_rate_override)}
                              disabled={readOnly}
                              placeholder="₱ 0.00"
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
                           <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">Lease Preview</span>
                           <div className="space-y-3">
                              <div className="flex justify-between">
                                 <span className="text-xs font-medium text-stone-500">Resident</span>
                                 <span className="text-xs font-bold text-stone-900">{tenants.find(t => String(t.tenant_id) === String(getValues("tenant_id")))?.first_name} {tenants.find(t => String(t.tenant_id) === String(getValues("tenant_id")))?.last_name}</span>
                              </div>
                              <div className="flex justify-between">
                                 <span className="text-xs font-medium text-stone-500">Allocation</span>
                                 <span className="text-xs font-bold text-stone-900">{rooms.find(r => String(r.room_id) === String(getValues("room_id")))?.room_code}</span>
                              </div>
                           </div>
                        </div>
                        <div className="space-y-4 rounded-2xl bg-teal-50/50 p-6 border border-teal-100">
                           <span className="text-[10px] font-black uppercase tracking-widest text-teal-700/60">Initial Capital Required</span>
                           <div className="space-y-3">
                              <div className="flex justify-between items-center">
                                 <span className="text-xs font-medium text-teal-800/80">Security Deposit</span>
                                 <span className="font-mono text-sm font-black text-teal-900">{formatPHP(getValues("deposit_amount") || 0)}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                 <span className="text-xs font-medium text-teal-800/80">First Month Advance</span>
                                 <span className="font-mono text-sm font-black text-teal-900">{formatPHP(getValues("monthly_rent") || 0)}</span>
                              </div>
                              <div className="pt-3 border-t border-teal-200/50 flex justify-between items-center">
                                 <span className="text-[10px] font-black uppercase tracking-widest text-teal-800">Total Move-in Cost</span>
                                 <span className="font-mono text-lg font-black text-teal-700">{formatPHP(Number(getValues("monthly_rent") || 0) + Number(getValues("deposit_amount") || 0))}</span>
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
                        <p className="text-[10px] font-bold uppercase tracking-widest leading-relaxed">
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
