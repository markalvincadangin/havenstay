"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, MapPin, RefreshCw, Wallet } from "lucide-react";

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

  /** Only when the user changes room selection — not when `rooms` refetches (avoids overwriting monthly_rent). */
  const lastRoomIdForRentRef = useRef(null);

  const selectedRoomId = watch("room_id");
  const selectedRoom = useMemo(
    () => rooms.find((room) => String(room.room_id) === String(selectedRoomId)),
    [rooms, selectedRoomId],
  );
  const isSharedRoom = selectedRoom?.room_type === "shared";

  /** Tenants who may receive a new lease: not archived, and no existing active contract (FR-017). */
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
    if (lastRoomIdForRentRef.current === id) {
      return;
    }
    const room = rooms.find((r) => String(r.room_id) === id);
    if (!room) {
      return;
    }
    lastRoomIdForRentRef.current = id;

    const roomRate = parseMoneyInput(room.monthly_rate ?? 0);
    const capacity = Number(room.capacity || 1);
    const suggestedRate =
      room.room_type === "shared" && capacity > 0
        ? (roomRate / capacity).toFixed(2)
        : roomRate.toFixed(2);
    setValue("monthly_rent", suggestedRate, { shouldDirty: true });
  }, [selectedRoomId, rooms, setValue]);

  useEffect(() => {
    if (authLoading || !currentUser) return;

    const bootstrap = async () => {
      try {
        const [tenantData, roomData, contractData] = await Promise.all([
          apiRequest("/api/tenants", { method: "GET" }),
          apiRequest("/api/rooms", { method: "GET" }),
          apiRequest("/api/contracts", { method: "GET" }),
        ]);

        setTenants(Array.isArray(tenantData) ? tenantData : tenantData?.tenants || []);
        setRooms(Array.isArray(roomData) ? roomData : roomData?.rooms || []);
        setContracts(Array.isArray(contractData) ? contractData : contractData?.contracts || []);
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
        const bedSpaces = Array.isArray(room?.bed_spaces)
          ? room.bed_spaces
          : Array.isArray(room?.bedSpaces)
            ? room.bedSpaces
            : [];
        if (bedSpaces.length > 0) {
          bedSpaceId = bedSpaces[0].bed_space_id;
        } else {
          setApiError("Solo room has no bed spaces configured. Contact an administrator.");
          return;
        }
      } catch {
        setApiError("Failed to load bed space information for this room.");
        return;
      }
    }

    if (!bedSpaceId) {
      setError("bed_space_id", {
        type: "manual",
        message: "Bed space is required.",
      });
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
        <Spinner label="Loading registration form…" />
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
              items={[{ label: "Contract Registry", href: "/contracts" }, { label: "Register contract" }]}
            />
          }
          actions={
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => router.push("/contracts")}
                className="inline-flex size-11 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-500 transition-colors hover:bg-stone-50"
                aria-label="Back to Contract Registry"
                title="Back to Contract Registry"
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
        {readOnly ? (
          <Alert variant="warning" title="Read-only role">
            You cannot register contracts with your current role.
          </Alert>
        ) : null}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
            <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/50 px-8 py-5">
              <div className="flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded-lg bg-stone-100 text-stone-600 shadow-sm">
                  <RefreshCw size={16} aria-hidden />
                </div>
                <h2 className="hs-strip-title">Tenant & Room Assignment</h2>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wide text-stone-400 [word-spacing:0.06em]">
                Required where marked
              </span>
            </div>
            <div className="space-y-8 p-8">
              <div className="grid gap-6 sm:grid-cols-2">
                <Field
                  label="Primary Resident"
                  required
                  error={errors.tenant_id?.message}
                  helpText={
                    eligibleTenants.length === 0
                      ? "No eligible tenants: archive excludes profiles; anyone with an active lease is hidden until move-out completes."
                      : "Only tenants who are not archived and who do not already have an active contract."
                  }
                >
                  <Select
                    autoFocus
                    hasError={Boolean(errors.tenant_id)}
                    disabled={readOnly}
                    className="!h-11 border-stone-200"
                    {...register("tenant_id", { required: "Select a Tenant." })}
                  >
                    <option value="">Select Tenant</option>
                    {eligibleTenants.map((t) => (
                      <option key={t.tenant_id} value={t.tenant_id}>
                        #{t.tenant_id} — {t.last_name}, {t.first_name} ({t.status})
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Room" required error={errors.room_id?.message}>
                  <Select
                    hasError={Boolean(errors.room_id)}
                    disabled={readOnly}
                    className="!h-11 border-stone-200"
                    {...register("room_id", { required: "Select a room." })}
                  >
                    <option value="">Select room</option>
                    {rooms.map((room) => (
                      <option
                        key={room.room_id}
                        value={room.room_id}
                        disabled={room.status !== "available"}
                      >
                        {room.room_code} ({room.room_type})
                        {room.status !== "available" ? ` — ${room.status}` : ""}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              <Field
                label="Bed Space"
                error={errors.bed_space_id?.message}
                helpText={
                  isSharedRoom
                    ? bedSpaceOptions.length > 0
                      ? bedSpaceOptions.some((b) => b.status === "vacant")
                        ? "Select a vacant bed label."
                        : "No vacant beds in this room."
                      : "Loading bed spaces…"
                    : "Auto-selected for solo rooms."
                }
              >
                <Select
                  hasError={Boolean(errors.bed_space_id)}
                  disabled={
                    readOnly ||
                    !isSharedRoom ||
                    !bedSpaceOptions.some((b) => b.status === "vacant")
                  }
                  className="!h-11 border-stone-200"
                  {...register("bed_space_id", {
                    validate: (value) => {
                      if (isSharedRoom && !value) {
                        return "Bed space is required for shared rooms.";
                      }
                      return true;
                    },
                  })}
                >
                  <option value="">
                    {isSharedRoom
                      ? bedSpaceOptions.some((b) => b.status === "vacant")
                        ? "Select bed space"
                        : "No vacant beds"
                      : "N/A — solo room"}
                  </option>
                  {bedSpaceOptions.map((bed) => (
                    <option
                      key={bed.bed_space_id}
                      value={bed.bed_space_id}
                      disabled={bed.status !== "vacant"}
                    >
                      {bed.bed_label || `Bed #${bed.bed_space_id}`}
                      {bed.status !== "vacant" ? ` (${bed.status})` : ""}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </Card>

          <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
            <div className="flex items-center gap-3 border-b border-stone-100 bg-stone-50/50 px-8 py-5">
              <div className="flex size-8 items-center justify-center rounded-lg bg-teal-50 text-teal-600 shadow-sm">
                <MapPin size={16} aria-hidden />
              </div>
              <h2 className="hs-strip-title">Lease Period</h2>
            </div>
            <div className="grid gap-6 p-8 sm:grid-cols-2">
              <Field label="Move-in Date" required error={errors.move_in_date?.message}>
                <Input
                  type="date"
                  hasError={Boolean(errors.move_in_date)}
                  disabled={readOnly}
                  className="!h-11 border-stone-200"
                  {...register("move_in_date", { required: "Move-in date is required." })}
                />
              </Field>
              <Field label="Expected Move-out" error={errors.expected_move_out?.message}>
                <Input
                  type="date"
                  hasError={Boolean(errors.expected_move_out)}
                  disabled={readOnly}
                  className="!h-11 border-stone-200"
                  {...register("expected_move_out", {
                    validate: (value) => {
                      if (!value) return true;
                      const moveIn = watch("move_in_date");
                      if (moveIn && new Date(value) <= new Date(moveIn)) {
                        return "Must be after move-in date.";
                      }
                      return true;
                    },
                  })}
                />
              </Field>
            </div>
          </Card>

          <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
            <div className="flex items-center gap-3 border-b border-stone-100 bg-stone-50/50 px-8 py-5">
              <div className="flex size-8 items-center justify-center rounded-lg bg-teal-50 text-teal-600 shadow-sm">
                <Wallet size={16} aria-hidden />
              </div>
              <h2 className="hs-strip-title">Financial Terms</h2>
            </div>
            <div className="space-y-8 p-8">
              <div className="grid gap-6 sm:grid-cols-2">
                <Field label="Deposit Amount" required error={errors.deposit_amount?.message}>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    hasError={Boolean(errors.deposit_amount)}
                    disabled={readOnly}
                    className="!h-11 border-stone-200 tabular-nums"
                    {...register("deposit_amount", {
                      required: "Deposit is required.",
                      min: { value: 0, message: "Min ₱0" },
                      max: { value: 500000, message: "Max ₱500,000" },
                    })}
                  />
                </Field>
                <Field
                  label="Monthly Rate"
                  required
                  error={errors.monthly_rent?.message}
                  helpText={
                    selectedRoom
                      ? `Room total ${formatPHP(selectedRoom.monthly_rate)} · Suggested ${
                          isSharedRoom && selectedRoom.capacity
                            ? `${formatPHP(
                                parseMoneyInput(selectedRoom.monthly_rate ?? 0) /
                                  Number(selectedRoom.capacity || 1),
                              )} per bed`
                            : formatPHP(selectedRoom.monthly_rate)
                        }`
                      : null
                  }
                >
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    hasError={Boolean(errors.monthly_rent)}
                    disabled={readOnly}
                    className="!h-11 border-stone-200 tabular-nums"
                    {...register("monthly_rent", {
                      required: "Monthly rate is required.",
                      min: { value: 500, message: "Min ₱500" },
                      max: { value: 100000, message: "Max ₱100,000" },
                    })}
                  />
                </Field>
              </div>

              <Field label="Notes">
                <Textarea
                  rows={3}
                  disabled={readOnly}
                  className="border-stone-200"
                  {...register("notes", {
                    maxLength: { value: 1000, message: "Max 1,000 characters" },
                  })}
                />
              </Field>
            </div>
          </Card>

          {apiError ? (
            <Alert variant="error" title="Registration failed">
              {apiError}
            </Alert>
          ) : null}

          <div className="flex flex-col-reverse gap-3 pt-6 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push("/contracts")}
              className="!h-11 rounded-xl px-8 text-[10px] font-bold uppercase tracking-widest"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={isSubmitting}
              disabled={readOnly || isSubmitting}
              className="!h-11 rounded-xl bg-teal-600 px-10 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-teal-900/10 hover:bg-teal-700"
            >
              Register Contract
            </Button>
          </div>
        </form>
        </div>
      </motion.div>
    </AppMain>
  );
}
