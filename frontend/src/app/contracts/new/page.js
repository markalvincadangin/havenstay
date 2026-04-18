"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { MapPin, RefreshCw, Wallet, ShieldCheck, FileText } from "lucide-react";

import { apiRequest, fetcher } from "../../../lib/api";
import useSWR from "swr";
import { canManageContracts } from "../../../lib/auth";
import { applyServerFieldErrors } from "../../../lib/forms";
import { useUnsavedChangesWarning } from "../../../hooks/useUnsavedChangesWarning";
import { formatPHP, formatTenantDirectoryName } from "../../../lib/formatters";
import { parseMoneyInput } from "../../../lib/money";
import Alert from "../../_components/ui/Alert";
import Breadcrumbs from "../../_components/ui/Breadcrumbs";
import Button from "../../_components/ui/Button";
import { Field, Input, Select, Textarea, Checkbox } from "../../_components/ui/Fields";
import {
  primaryLinkCtaClass,
  secondaryOutlineLinkClass,
} from "../../_components/ui/LinkTokens";
import { ROOM_STATUS_LABELS, BED_STATUS_LABELS, ROOM_TYPE_LABELS } from "../../../lib/constants";
import { normalizePaginatedList } from "../../../lib/pagination";
import StandardPage from "../../_components/ui/StandardPage";
import { FormSection } from "../../_components/ui/FormSection";
import { useAuth } from "../../_context/AuthContext";
import PageHeaderActions from "../../_components/ui/PageHeaderActions";
import StepIndicator from "../../_components/ui/StepIndicator";
import Link from "next/link";

export default function NewContractPage() {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const [bedSpaceOptions, setBedSpaceOptions] = useState([]);
  const [apiError, setApiError] = useState("");

  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 3;

  const {
    register,
    handleSubmit,
    control,
    getValues,
    setValue,
    watch,
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
        .filter((c) => ["active", "pending_payment"].includes(c.status))
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

  const validateStep = async (step) => {
    if (step === 1) {
      return await trigger(["tenant_id", "room_id", "bed_space_id"]);
    }
    if (step === 2) {
      return await trigger(["move_in_date", "expected_move_out", "deposit_amount", "monthly_rent"]);
    }
    return true;
  };

  const nextStep = async () => {
    const isValid = await validateStep(currentStep);
    if (isValid) setCurrentStep((s) => Math.min(s + 1, totalSteps));
  };

  const prevStep = () => setCurrentStep((s) => Math.max(s - 1, 1));

  const onSubmit = async (values) => {
    // Prevent premature submission if the user presses "Enter" inside an input on an earlier step
    if (currentStep < totalSteps) {
      nextStep();
      return;
    }

    setApiError("");
    if (!canManageContracts(currentUser)) {
      setApiError("Unauthorized: only Admin or Staff can create contracts.");
      return;
    }

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
      notes: values.notes || null,
    };

    try {
      const response = await apiRequest("/api/contracts", {
        method: "POST",
        body: JSON.stringify(payload),
      });

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

  return (
    <StandardPage
      title="Register Contract"
      subtitle="Create a new lease and assign a resident to an available room."
      loading={loading}
      breadcrumbs={
        <Breadcrumbs
          items={[
            { label: "Contracts", href: "/contracts" },
            { label: "Register Contract" },
          ]}
        />
      }
      actions={
        <PageHeaderActions
          backHref="/contracts"
          backLabel="Back to Contracts"
          user={currentUser}
        />
      }
    >
      <div className="mx-auto w-full max-w-4xl">
        <StepIndicator 
          currentStep={currentStep}
          steps={[
            { step: 1, label: "ASSET ALLOCATION", icon: RefreshCw },
            { step: 2, label: "FINANCIAL TERMS", icon: Wallet },
            { step: 3, label: "FINAL REVIEW", icon: ShieldCheck }
          ]}
        />

        {readOnly && (
          <Alert variant="warning" title="Restricted Role">
            You do not have permission to create contracts.
          </Alert>
        )}

        {apiError && <Alert variant="error" title="Submission Error">{apiError}</Alert>}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {currentStep === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <FormSection 
                title="Resident & Asset Selection" 
                icon={RefreshCw}
                subtitle="Pair a verified tenant with a vacant bed space."
              >
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
                          {formatTenantDirectoryName(t)} (ID: {t.tenant_id})
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
                          disabled={room.status === "fully_occupied" || room.status === "maintenance" || room.status === "archived"}
                        >
                          {room.room_code} ({ROOM_TYPE_LABELS[room.room_type] || room.room_type})
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>

                <div className="mt-6">
                  <Field
                    label="Bed Space Allocation"
                    error={errors.bed_space_id?.message}
                    helpText={isSharedRoom ? "Select an available bed." : "System will auto-assign for solo rooms."}
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
                        {isSharedRoom ? (bedSpaceOptions.some(b => b.status === 'vacant') ? "Select Bed" : "No vacancy") : "N/A — Solo Unit"}
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
              </FormSection>
            </div>
          )}

          {currentStep === 2 && (
            <div className="grid gap-6 md:grid-cols-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <FormSection title="Agreement Timeline" icon={MapPin}>
                <div className="space-y-6">
                  <Field label="Move-in Date" required error={errors.move_in_date?.message}>
                    <Input
                      type="date"
                      hasError={Boolean(errors.move_in_date)}
                      disabled={readOnly}
                      className="!h-12 border-stone-200 font-bold"
                      {...register("move_in_date", { required: "Move-in date is required." })}
                    />
                  </Field>
                  <Field label="Lease Expiration" required error={errors.expected_move_out?.message}>
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
              </FormSection>

              <FormSection title="Financial Strategy" icon={Wallet}>
                <div className="space-y-6">
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
              </FormSection>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
               <FormSection title="Forensic Commitment Review" icon={ShieldCheck}>
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
                              <span className="font-mono text-sm font-black text-teal-900">{formatPHP(getValues("monthly_rent"))}</span>
                           </div>
                           <div className="flex justify-between items-center">
                              <span className="text-xs font-medium text-teal-800/80">First Month Advance</span>
                              <span className="font-mono text-sm font-black text-teal-900">{formatPHP(getValues("monthly_rent"))}</span>
                           </div>
                           <div className="pt-3 border-t border-teal-200/50 flex justify-between items-center">
                              <span className="text-[10px] font-black uppercase tracking-widest text-teal-800">Total Move-in Cost</span>
                              <span className="font-mono text-lg font-black text-teal-700">{formatPHP(Number(getValues("monthly_rent")) * 2)}</span>
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
               </FormSection>
            </div>
          )}

          <div className="flex flex-col-reverse gap-3 border-t border-stone-100 pt-8 sm:flex-row sm:items-center sm:justify-end">
            {currentStep > 1 && (
                <Button
                    type="button"
                    variant="secondary"
                    onClick={prevStep}
                    className="rounded-xl !h-12 px-10 font-bold text-[10px] uppercase tracking-widest"
                >
                    BACK
                </Button>
            )}
            {currentStep < 3 ? (
                <Button
                    type="button"
                    variant="primary"
                    onClick={nextStep}
                    className="rounded-xl !h-12 px-12 font-bold text-[10px] uppercase tracking-widest border-0 shadow-lg"
                >
                    <span>NEXT STEP</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-2"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>
                </Button>
            ) : (
                <Button
                    type="submit"
                    variant="primary"
                    loading={isSubmitting}
                    disabled={readOnly || isSubmitting}
                    className="rounded-xl !h-12 px-12 font-bold text-[10px] uppercase tracking-widest bg-teal-700 hover:bg-teal-800 border-0 shadow-lg shadow-teal-500/20"
                >
                    SAVE CONTRACT
                </Button>
            )}
          </div>
        </form>

        <div className="flex items-center gap-3 rounded-2xl bg-stone-50 p-6 text-stone-500">
          <ShieldCheck size={20} className="text-stone-300" />
          <p className="text-[10px] font-bold uppercase tracking-widest leading-relaxed">
            Registering a contract initiates a legal ledger record. Ensure all financial terms are verified against the standard room rates.
          </p>
        </div>
      </div>
    </StandardPage>
  );
}
