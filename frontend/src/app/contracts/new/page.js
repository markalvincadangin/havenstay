"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { MapPin, RefreshCw, Wallet, ShieldCheck, FileText } from "lucide-react";

import { apiRequest, fetcher } from "../../../lib/api";
import useSWR from "swr";
import { canManageContracts } from "../../../lib/auth";
import { applyServerFieldErrors } from "../../../lib/forms";
import { useUnsavedChangesWarning } from "../../../lib/useUnsavedChangesWarning";
import { formatPHP, formatTenantDirectoryName } from "../../../lib/formatters";
import { parseMoneyInput } from "../../../lib/money";
import Alert from "../../_components/ui/Alert";
import Breadcrumbs from "../../_components/ui/Breadcrumbs";
import Button from "../../_components/ui/Button";
import { Field, Input, Select, Textarea } from "../../_components/ui/Fields";
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
import Link from "next/link";

export default function NewContractPage() {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const [bedSpaceOptions, setBedSpaceOptions] = useState([]);
  const [apiError, setApiError] = useState("");

  const {
    register,
    handleSubmit,
    control,
    getValues,
    setValue,
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
        .filter((c) => c.status === "active")
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
      return;
    }
    const id = String(selectedRoomId);
    if (lastRoomIdForRentRef.current === id) return;

    const roomData = rooms.find((r) => String(r.room_id) === id);
    if (!roomData) {
      setValue("monthly_rent", "");
      return;
    }
    
    lastRoomIdForRentRef.current = id;
    const roomRate = parseMoneyInput(roomData.monthly_rate ?? 0);
    const suggestedRate = roomRate.toFixed(2);
    setValue("monthly_rent", suggestedRate, { shouldDirty: true });
  }, [selectedRoomId, rooms, setValue]);

  const onSubmit = async (values) => {
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
      const newId = response?.contract?.contract_id;
      if (newId) router.push(`/contracts/${newId}`);
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
      <div className="mx-auto w-full max-w-4xl space-y-6">
        {readOnly && (
          <Alert variant="warning" title="Restricted Role">
            You do not have permission to create contracts.
          </Alert>
        )}

        {apiError && <Alert variant="error" title="Submission Error">{apiError}</Alert>}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <FormSection 
            title="Room & Bed Assignment" 
            icon={RefreshCw}
            rightElement={
              <span className="text-[10px] font-bold uppercase tracking-widest text-stone-300">Step 1</span>
            }
          >
            <div className="grid gap-6 sm:grid-cols-2">
              <Field
                label="Tenant"
                required
                error={errors.tenant_id?.message}
                helpText={
                  eligibleTenants.length === 0
                    ? "No eligible tenants found."
                    : "Only tenants without active agreements are listed."
                }
              >
                <Select
                  autoFocus
                  hasError={Boolean(errors.tenant_id)}
                  disabled={readOnly}
                  className="!h-11 border-stone-200 font-bold"
                  {...register("tenant_id", { required: "Assign a resident to this contract." })}
                >
                  <option value="">Select Tenant</option>
                  {eligibleTenants.map((t) => (
                    <option key={t.tenant_id} value={t.tenant_id}>
                      TENANT-{t.tenant_id} · {formatTenantDirectoryName(t)}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Room" required error={errors.room_id?.message}>
                <Select
                  hasError={Boolean(errors.room_id)}
                  disabled={readOnly}
                  className="!h-11 border-stone-200 font-bold"
                  {...register("room_id", { required: "Select a room unit." })}
                >
                  <option value="">Select room</option>
                  {rooms.map((room) => (
                    <option 
                      key={room.room_id} 
                      value={room.room_id} 
                      disabled={room.status === "fully_occupied" || room.status === "maintenance" || room.status === "archived"}
                    >
                      {room.room_code} ({ROOM_TYPE_LABELS[room.room_type] || room.room_type}) {room.status !== "available" && room.status !== "partially_occupied" ? `— ${ROOM_STATUS_LABELS[room.status] || room.status}` : room.status === "partially_occupied" ? "— VACANCY AVAILABLE" : ""}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="mt-6">
              <Field
                label="Bed"
                error={errors.bed_space_id?.message}
                helpText={isSharedRoom ? "Select a vacant bed label." : "System will auto-assign for solo rooms."}
              >
                <Select
                  hasError={Boolean(errors.bed_space_id)}
                  disabled={readOnly || !isSharedRoom || !bedSpaceOptions.some((b) => b.status === "vacant")}
                  className="!h-11 border-stone-200 font-bold"
                  {...register("bed_space_id", {
                    validate: (value) => isSharedRoom && !value ? "Bed assignment is required for shared units." : true,
                  })}
                >
                  <option value="">
                    {isSharedRoom ? (bedSpaceOptions.some(b => b.status === 'vacant') ? "Select Bed" : "No vacancy") : "N/A — Solo Unit"}
                  </option>
                  {bedSpaceOptions.map((bed) => (
                    <option key={bed.bed_space_id} value={bed.bed_space_id} disabled={bed.status !== "vacant"}>
                      {bed.bed_label || `Bed #${bed.bed_space_id}`} {bed.status !== "vacant" ? `(${BED_STATUS_LABELS[bed.status] || bed.status})` : ""}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </FormSection>

          <div className="grid gap-6 md:grid-cols-2">
            <FormSection title="Lease Terms" icon={MapPin}>
              <div className="space-y-6">
                <Field label="Move-in Date" required error={errors.move_in_date?.message}>
                  <Input
                    type="date"
                    hasError={Boolean(errors.move_in_date)}
                    disabled={readOnly}
                    className="!h-11 border-stone-200 focus:border-teal-500/50"
                    {...register("move_in_date", { required: "Move-in date is required." })}
                  />
                </Field>
                <Field label="Expected Move-Out" required error={errors.expected_move_out?.message}>
                  <Input
                    type="date"
                    hasError={Boolean(errors.expected_move_out)}
                    disabled={readOnly}
                    className="!h-11 border-stone-200 focus:border-teal-500/50"
                    {...register("expected_move_out", {
                      required: "Expected move-out date is required for planning.",
                      validate: (val) => !val || new Date(val) > new Date(getValues("move_in_date")) || "Must be after inception.",
                    })}
                  />
                </Field>
              </div>
            </FormSection>

            <FormSection title="Financial Terms" icon={Wallet}>
              <div className="space-y-6">
                <Field label="Deposit" required error={errors.deposit_amount?.message}>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    hasError={Boolean(errors.deposit_amount)}
                    disabled={readOnly}
                    className="!h-11 border-stone-200 font-mono font-bold tabular-nums focus:border-teal-500/50"
                    {...register("deposit_amount", { required: "Deposit required." })}
                  />
                </Field>
                <Field 
                  label="Monthly Rent" 
                  required 
                  error={errors.monthly_rent?.message}
                  helpText={selectedRoom ? `Unit total ${formatPHP(selectedRoom.monthly_rate)}` : null}
                >
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    hasError={Boolean(errors.monthly_rent)}
                    disabled={readOnly}
                    className="!h-11 border-stone-200 font-mono font-bold tabular-nums focus:border-teal-500/50"
                    {...register("monthly_rent", { required: "Monthly rate required." })}
                  />
                </Field>
              </div>
            </FormSection>
          </div>

          <FormSection title="Special Notes" icon={FileText}>
            <Field label="Internal Notes">
              <Textarea
                rows={3}
                placeholder="Specific terms, shared utility agreements, etc."
                disabled={readOnly}
                className="border-stone-200 focus:border-teal-500/50"
                {...register("notes")}
              />
            </Field>
          </FormSection>

          <div className="flex flex-col-reverse gap-3 pt-8 sm:flex-row sm:justify-end">
            <Link
              href="/contracts"
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
              Register Contract
            </Button>
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
