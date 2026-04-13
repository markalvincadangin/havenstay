"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, MapPin, RefreshCw, Wallet, ShieldCheck } from "lucide-react";

import { apiRequest } from "../../../lib/api";
import { canManageContracts } from "../../../lib/auth";
import { useAuthGuard } from "../../../hooks/useAuthGuard";
import { flattenApiErrors } from "../../../lib/errors";
import { useUnsavedChangesWarning } from "../../../lib/useUnsavedChangesWarning";
import { formatPHP } from "../../../lib/formatters";
import { parseMoneyInput } from "../../../lib/money";
import Alert from "../../_components/ui/Alert";
import { AppMain } from "../../_components/ui/AppShell";
import Breadcrumbs from "../../_components/ui/Breadcrumbs";
import Button from "../../_components/ui/Button";
import { Card } from "../../_components/ui/Card";
import { Field, Input, Select, Textarea } from "../../_components/ui/Fields";
import PageHeader from "../../_components/ui/PageHeader";
import Spinner from "../../_components/ui/Spinner";
import UserRoleBadge from "../../_components/ui/UserRoleBadge";
import { ROOM_STATUS_LABELS, BED_STATUS_LABELS, ROOM_TYPE_LABELS } from "../../../lib/constants";
import { normalizePaginatedList } from "../../../lib/pagination";

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.2, ease: "easeOut" },
};

export default function NewContractPage() {
  const router = useRouter();
  const { user: currentUser, authLoading } = useAuthGuard();
  const shouldReduceMotion = useReducedMotion();
  const [loading, setLoading] = useState(true);
  const [tenants, setTenants] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [bedSpaceOptions, setBedSpaceOptions] = useState([]);
  const [apiError, setApiError] = useState("");

  const {
    register,
    handleSubmit,
    watch,
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

  const lastRoomIdForRentRef = useRef(null);
  const selectedRoomId = watch("room_id");
  const selectedRoom = useMemo(
    () => rooms.find((room) => String(room.room_id) === String(selectedRoomId)),
    [rooms, selectedRoomId],
  );
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
      return;
    }
    const id = String(selectedRoomId);
    if (lastRoomIdForRentRef.current === id) return;

    const roomData = rooms.find((r) => String(r.room_id) === id);
    if (!roomData) return;
    
    lastRoomIdForRentRef.current = id;
    const roomRate = parseMoneyInput(roomData.monthly_rate ?? 0);
    const capacity = Number(roomData.capacity || 1);
    const suggestedRate =
      roomData.room_type === "shared" && capacity > 0
        ? (roomRate / capacity).toFixed(2)
        : roomRate.toFixed(2);
    setValue("monthly_rent", suggestedRate, { shouldDirty: true });
  }, [selectedRoomId, rooms, setValue]);

  useEffect(() => {
    if (authLoading || !currentUser) return;
    const bootstrap = async () => {
      try {
        const [tenantData, roomData, contractData] = await Promise.all([
          apiRequest("/api/tenants?per_page=100", { method: "GET" }),
          apiRequest("/api/rooms?per_page=100", { method: "GET" }),
          apiRequest("/api/contracts?per_page=100", { method: "GET" }),
        ]);
        setTenants(normalizePaginatedList(tenantData).rows);
        setRooms(normalizePaginatedList(roomData).rows);
        setContracts(normalizePaginatedList(contractData).rows);
      } catch (error) {
        setApiError(error.message || "Failed to load form data.");
      } finally {
        setLoading(false);
      }
    };
    bootstrap();
  }, [authLoading, currentUser]);

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

    const monthlyRent = parseMoneyInput(values.monthly_rent);
    const depositParsed = parseMoneyInput(values.deposit_amount);
    if (Number.isNaN(monthlyRent) || Number.isNaN(depositParsed)) {
      setApiError("Enter valid amounts for deposit and monthly rate.");
      return;
    }

    const payload = {
      tenant_id: Number(values.tenant_id),
      room_id: Number(selectedRoomId),
      bed_space_id: Number(bedSpaceId),
      move_in_date: values.move_in_date,
      expected_move_out: values.expected_move_out || null,
      deposit_amount: depositParsed,
      monthly_rate: monthlyRent,
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
      setApiError(flattenApiErrors(error));
    }
  };

  if (authLoading || loading) {
    return (
      <AppMain>
        <Spinner label="Initializing registration form…" />
      </AppMain>
    );
  }

  const readOnly = !canManageContracts(currentUser);

  return (
    <AppMain>
      <motion.div
        className="mx-auto mt-8 w-full max-w-4xl space-y-6"
        initial={shouldReduceMotion ? false : pageVariants.initial}
        animate={shouldReduceMotion ? false : pageVariants.animate}
        transition={shouldReduceMotion ? { duration: 0 } : pageVariants.transition}
      >
        <PageHeader
          title="Register Contract"
          subtitle="Draft new lease terms and link tenants to available room inventory."
          breadcrumbs={
            <Breadcrumbs
              items={[
                { label: "Contract Ledger", href: "/contracts" },
                { label: "Register Contract" },
              ]}
            />
          }
          actions={
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => router.push("/contracts")}
                className="inline-flex size-11 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-500 transition-colors hover:bg-stone-50"
                aria-label="Back to Contract Ledger"
              >
                <ArrowLeft size={18} aria-hidden />
              </button>
              <div className="border-l border-stone-200 pl-3">
                <UserRoleBadge username={currentUser?.username} roleName={currentUser?.role?.role_name} />
              </div>
            </div>
          }
        />

        <div className="space-y-6">
          {readOnly && (
            <Alert variant="warning" title="Restricted Role">
              You do not have administrative clearance to register new contracts.
            </Alert>
          ) || apiError && (
             <Alert variant="error" title="Submission Error">{apiError}</Alert>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
              <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/50 px-8 py-5">
                <div className="flex items-center gap-3">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-stone-100 text-stone-600 shadow-sm">
                    <RefreshCw size={16} aria-hidden />
                  </div>
                  <h2 className="hs-strip-title text-stone-400 tracking-widest uppercase font-black text-sm">Room & Bed Assignment</h2>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-stone-300">Operational Step 01</span>
              </div>
              <div className="space-y-8 p-8">
                <div className="grid gap-6 sm:grid-cols-2">
                  <Field
                    label="Primary Resident"
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
                          #{t.tenant_id} · {t.last_name}, {t.first_name}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field label="Inventory Room" required error={errors.room_id?.message}>
                    <Select
                      hasError={Boolean(errors.room_id)}
                      disabled={readOnly}
                      className="!h-11 border-stone-200 font-bold"
                      {...register("room_id", { required: "Select a room unit." })}
                    >
                      <option value="">Select room</option>
                      {rooms.map((room) => (
                        <option key={room.room_id} value={room.room_id} disabled={room.status !== "available"}>
                          {room.room_code} ({ROOM_TYPE_LABELS[room.room_type] || room.room_type}) {room.status !== "available" ? `— ${ROOM_STATUS_LABELS[room.status] || room.status}` : ""}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>

                <Field
                  label="Assigned Bed Space"
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
            </Card>

            <div className="grid gap-6 md:grid-cols-2">
              <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
                <div className="flex items-center gap-3 border-b border-stone-100 bg-stone-50/50 px-8 py-5">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-teal-50 text-teal-600 shadow-sm">
                    <MapPin size={16} aria-hidden />
                  </div>
                  <h2 className="hs-strip-title text-stone-400 tracking-widest uppercase font-black text-sm">Lease Terms</h2>
                </div>
                <div className="grid gap-6 p-8">
                  <Field label="Inception (Move-in)" required error={errors.move_in_date?.message}>
                    <Input
                      type="date"
                      hasError={Boolean(errors.move_in_date)}
                      disabled={readOnly}
                      className="!h-11 border-stone-200"
                      {...register("move_in_date", { required: "Inception date is required." })}
                    />
                  </Field>
                  <Field label="Expected Move-Out" required error={errors.expected_move_out?.message}>
                    <Input
                      type="date"
                      hasError={Boolean(errors.expected_move_out)}
                      disabled={readOnly}
                      className="!h-11 border-stone-200"
                      {...register("expected_move_out", {
                        required: "Expected move-out date is required for planning.",
                        validate: (val) => !val || new Date(val) > new Date(watch("move_in_date")) || "Must be after inception.",
                      })}
                    />
                  </Field>
                </div>
              </Card>

              <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
                <div className="flex items-center gap-3 border-b border-stone-100 bg-stone-50/50 px-8 py-5">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 shadow-sm">
                    <Wallet size={16} aria-hidden />
                  </div>
                  <h2 className="hs-strip-title text-stone-400 tracking-widest uppercase font-black text-sm">Financial Terms</h2>
                </div>
                <div className="grid gap-6 p-8">
                  <Field label="Security Deposit" required error={errors.deposit_amount?.message}>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      hasError={Boolean(errors.deposit_amount)}
                      disabled={readOnly}
                      className="!h-11 border-stone-200 font-mono font-bold tabular-nums"
                      {...register("deposit_amount", { required: "Deposit required." })}
                    />
                  </Field>
                  <Field 
                    label="Lease Monthly Rate" 
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
                      className="!h-11 border-stone-200 font-mono font-bold tabular-nums"
                      {...register("monthly_rent", { required: "Monthly rate required." })}
                    />
                  </Field>
                </div>
              </Card>
            </div>

            <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
              <div className="border-b border-stone-100 bg-stone-50/50 px-8 py-5">
                <h2 className="hs-strip-title text-stone-400 tracking-widest uppercase font-black text-sm">Notes</h2>
              </div>
              <div className="p-8">
                <Field label="Agreement Notes">
                  <Textarea
                    rows={3}
                    placeholder="Specific terms, shared utility agreements, etc."
                    disabled={readOnly}
                    className="border-stone-200"
                    {...register("notes")}
                  />
                </Field>
              </div>
            </Card>

            <div className="flex flex-col-reverse gap-3 pt-6 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                onClick={() => router.push("/contracts")}
                className="!h-12 rounded-xl px-10 text-[10px] font-bold uppercase tracking-widest"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={isSubmitting}
                disabled={readOnly || isSubmitting}
                className="!h-12 rounded-xl bg-teal-600 px-12 text-[10px] font-black uppercase tracking-widest shadow-xl shadow-teal-900/20 hover:bg-teal-700 active:scale-95"
              >
                Register Contract
              </Button>
            </div>
          </form>
        </div>

        <div className="flex items-center gap-3 rounded-2xl bg-stone-50 p-6 text-stone-500">
          <ShieldCheck size={20} className="text-stone-300" />
          <p className="text-[10px] font-bold uppercase tracking-widest leading-relaxed">
            Registering a contract initiates a legal ledger record. Ensure all financial terms are verified against the standard room rates.
          </p>
        </div>
      </motion.div>
    </AppMain>
  );
}
