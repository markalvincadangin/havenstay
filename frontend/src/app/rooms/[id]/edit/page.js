"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ShieldCheck, Box, RefreshCw, Trash2, Plus } from "lucide-react";

import { apiRequest } from "../../../../lib/api";
import { canManageRooms } from "../../../../lib/auth";
import { useAuthGuard } from "../../../../hooks/useAuthGuard";
import { flattenApiErrors } from "../../../../lib/errors";
import { parseMoneyInput } from "../../../../lib/money";
import { useUnsavedChangesWarning } from "../../../../lib/useUnsavedChangesWarning";
import Alert from "../../../_components/ui/Alert";
import { AppMain } from "../../../_components/ui/AppShell";
import Breadcrumbs from "../../../_components/ui/Breadcrumbs";
import Button from "../../../_components/ui/Button";
import { Card } from "../../../_components/ui/Card";
import { Field, Input, Select, Textarea } from "../../../_components/ui/Fields";
import PageHeader from "../../../_components/ui/PageHeader";
import Spinner from "../../../_components/ui/Spinner";
import UserRoleBadge from "../../../_components/ui/UserRoleBadge";
import { primaryLinkCtaClass, secondaryOutlineLinkClass } from "../../../_components/ui/LinkTokens";
import Link from "next/link";
import {
  BED_STATUS_LABELS,
  ROOM_STATUS_KEYS,
  ROOM_STATUS_OPTION_LABELS,
  ROOM_TYPE_OPTION_LABELS,
} from "../../../../lib/constants";

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.2, ease: "easeOut" },
};

function normalizeRoomStatus(status) {
  if (ROOM_STATUS_KEYS.includes(status)) return status;
  return "available";
}

export default function EditRoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params?.id;

  const { user: currentUser, authLoading } = useAuthGuard();
  const shouldReduceMotion = useReducedMotion();
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState("");
  const [room, setRoom] = useState(null);

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({
    defaultValues: {
      physical_number: "",
      room_code: "",
      room_type: "solo",
      capacity: "",
      monthly_rate: "",
      status: "available",
      amenities: "",
      description: "",
      bed_spaces: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "bed_spaces",
  });

  useUnsavedChangesWarning(isDirty && !isSubmitting);
  const roomType = useWatch({ control, name: "room_type" });
  const bedSpaces = useWatch({ control, name: "bed_spaces" });
  const physicalNumber = useWatch({ control, name: "physical_number" });

  const loadRoom = useCallback(async () => {
    try {
      const data = await apiRequest(`/api/rooms/${roomId}`, { method: "GET" });
      setRoom(data);
      const codeParts = (data.room_code || "").split("-");
      const physNum = codeParts.length > 1 ? codeParts[1] : data.room_code;
      
      reset({
        physical_number: physNum,
        room_code: data.room_code || "",
        room_type: data.room_type || "solo",
        capacity: data.capacity?.toString() ?? "",
        monthly_rate: data.monthly_rate ?? "",
        status: normalizeRoomStatus(data.status),
        amenities: data.amenities || "",
        description: data.description || "",
        bed_spaces: data.bed_spaces || [],
      });
    } catch (error) {
      setApiError(error?.message || "Failed to load room for editing.");
    }
  }, [roomId, reset]);

  useEffect(() => {
    if (authLoading || !currentUser || !roomId) return;

    const fetchData = async () => {
      try {
        await loadRoom();
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [authLoading, currentUser, roomId, loadRoom]);

  useEffect(() => {
    if (physicalNumber) {
      const prefix = roomType === "solo" ? "SOLO" : "SHRD";
      const generatedCode = `${prefix}-${physicalNumber.toUpperCase()}`;
      setValue("room_code", generatedCode, { shouldDirty: true });
    }
  }, [roomType, physicalNumber, setValue]);

  useEffect(() => {
    if (roomType === "solo") {
      setValue("capacity", "1");
    } else {
      setValue("capacity", (bedSpaces?.length || 0).toString());
    }
  }, [roomType, bedSpaces?.length, setValue]);

  const onSubmit = async (values) => {
    setApiError("");
    if (!canManageRooms(currentUser)) return;

    try {
      const rate = parseMoneyInput(values.monthly_rate);
      if (Number.isNaN(rate)) {
        setApiError("Enter a valid monthly rate.");
        return;
      }
      const payload = {
        room_code: values.room_code,
        room_type: values.room_type,
        capacity: Number(values.capacity),
        monthly_rate: rate,
        status: values.status,
        amenities: values.amenities || null,
        description: values.description || null,
        bed_spaces: values.bed_spaces.map((b) => ({
          bed_space_id: b.bed_space_id || null,
          bed_label: b.bed_label,
          status: b.status,
        })),
      };

      await apiRequest(`/api/rooms/${roomId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      router.push(`/rooms/${roomId}`);
      router.refresh();
    } catch (error) {
      setApiError(flattenApiErrors(error));
    }
  };

  if (authLoading || loading) {
    return (
      <AppMain>
        <Spinner label="Loading profile…" />
      </AppMain>
    );
  }

  const readOnly = !canManageRooms(currentUser);
  const title = room ? `Room ${room.room_code}` : "Room";

  return (
    <AppMain>
      <motion.div
        className="mx-auto mt-8 w-full max-w-4xl space-y-6"
        initial={shouldReduceMotion ? false : pageVariants.initial}
        animate={shouldReduceMotion ? false : pageVariants.animate}
        transition={shouldReduceMotion ? { duration: 0 } : pageVariants.transition}
      >
        <PageHeader
          title="Update Details"
          subtitle={room ? `Edit unit fields for ${room.room_code}.` : "Edit room record."}
          breadcrumbs={
            <Breadcrumbs
              items={[
                { label: "Room Inventory", href: "/rooms" },
                { label: title, href: `/rooms/${roomId}` },
                { label: "Update Details" },
              ]}
            />
          }
          actions={
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => router.push(`/rooms/${roomId}`)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-500 transition-colors hover:bg-stone-50"
                aria-label="Back to room profile"
                title="Back to profile"
              >
                <ArrowLeft size={18} aria-hidden />
              </button>
              <div className="border-l border-stone-200 pl-3">
                <UserRoleBadge username={currentUser?.username} roleName={currentUser?.role?.role_name} />
              </div>
            </div>
          }
        />

        {readOnly ? (
          <Alert variant="warning" title="Restricted access">
            You do not have permission to edit room records.
          </Alert>
        ) : null}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
            <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/50 px-8 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-stone-100 text-stone-600">
                  <RefreshCw size={14} aria-hidden />
                </div>
                <h2 className="hs-strip-title text-stone-400 tracking-widest uppercase font-black text-sm">Basic Information</h2>
              </div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-tighter text-stone-400">#ROOM-{roomId}</p>
            </div>

            <div className="space-y-8 p-8">
              <div className="grid gap-6 sm:grid-cols-2">
                <Field label="Physical number" required error={errors.physical_number?.message}>
                  <Input
                    placeholder="e.g. 101"
                    className="!h-11 border-stone-200 focus:border-teal-500/50"
                    disabled={readOnly}
                    {...register("physical_number", { required: "Physical number is required." })}
                  />
                </Field>

                <Field label="Formal room code" required error={errors.room_code?.message} helpText="Updated based on category and number.">
                  <Input
                    readOnly
                    className="!h-11 border-stone-200 bg-stone-50 font-mono text-stone-600 cursor-not-allowed"
                    {...register("room_code", { required: "Room code missing." })}
                  />
                </Field>
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <Field label="Base rate (PHP)" required error={errors.monthly_rate?.message}>
                  <Input
                    type="number"
                    step="1"
                    placeholder="5000"
                    className="!h-11 border-stone-200 font-mono focus:border-teal-500/50 tabular-nums"
                    disabled={readOnly}
                    {...register("monthly_rate", { required: "Rate is required.", min: 100 })}
                  />
                </Field>

                <Field label="Unit status" required error={errors.status?.message} helpText="Select the current operational status of this unit.">
                  <Select className="!h-11 border-stone-200 font-bold" disabled={readOnly} {...register("status")}>
                    {Object.entries(ROOM_STATUS_OPTION_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              <div className="sm:w-1/2">
                <Field label="Unit category" required error={errors.room_type?.message}>
                  <Select className="!h-11 border-stone-200 font-bold" disabled={readOnly} {...register("room_type")}>
                    {Object.entries(ROOM_TYPE_OPTION_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            </div>
          </Card>

          <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
            <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/50 px-8 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                  <ShieldCheck size={14} aria-hidden />
                </div>
                <h2 className="hs-strip-title text-stone-400 tracking-widest uppercase font-black text-sm">Bed Assignments</h2>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">
                  {roomType === "solo" ? "Single bed" : `${fields.length} beds listed`}
                </span>
                {roomType === "shared" ? (
                   <button
                     type="button"
                     onClick={() => append({ bed_label: `Bed ${fields.length + 1}`, status: "vacant" })}
                     disabled={readOnly}
                     className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-teal-50 px-3 text-[10px] font-black uppercase tracking-widest text-teal-700 transition-colors hover:bg-teal-100 disabled:opacity-50"
                   >
                     <Plus size={12} strokeWidth={3} />
                     Add bed
                   </button>
                ) : null}
              </div>
            </div>

            <div className="space-y-4 p-8">
              {fields.map((field, index) => {
                const isOccupied = field.status === "occupied";
                return (
                  <div
                    key={field.id}
                    className="flex items-end gap-3 rounded-xl border border-stone-100 bg-stone-50 p-4 shadow-sm transition-[border-color,box-shadow] focus-within:border-teal-200 focus-within:bg-white"
                  >
                    <Field label="Bed label" className="flex-1">
                      <Input
                        placeholder="Bed label"
                        className="!h-10 border-stone-200 bg-white font-mono"
                        disabled={readOnly}
                        {...register(`bed_spaces.${index}.bed_label`, { required: true })}
                      />
                    </Field>
                    <Field label="Current Status" className="w-40">
                      <Select
                        disabled={readOnly || isOccupied}
                        className="!h-10 border-stone-200 bg-white font-bold"
                        {...register(`bed_spaces.${index}.status`)}
                      >
                        <option value="vacant">{BED_STATUS_LABELS.vacant}</option>
                        <option value="maintenance">{BED_STATUS_LABELS.maintenance}</option>
                        {isOccupied && (
                          <option value="occupied" disabled>
                            {BED_STATUS_LABELS.occupied}
                          </option>
                        )}
                      </Select>
                    </Field>
                    {roomType === "shared" && fields.length > 1 && !isOccupied ? (
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        disabled={readOnly}
                        className="mb-0.5 flex h-10 w-10 items-center justify-center rounded-lg border border-red-100 bg-red-50 text-red-500 transition-colors hover:bg-red-100 disabled:opacity-50"
                        aria-label={`Remove bed ${index + 1}`}
                      >
                        <Trash2 size={16} aria-hidden />
                      </button>
                    ) : (
                      <div className="mb-0.5 h-10 w-10 shrink-0" />
                    )}
                  </div>
                );
              })}
              {roomType === "shared" && (
                <p className="pt-2 text-center text-[10px] font-bold uppercase tracking-widest text-stone-400">
                  Occupied beds cannot be removed until the tenant moves out.
                </p>
              )}
            </div>
          </Card>

          <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
            <div className="flex items-center gap-3 border-b border-stone-100 bg-stone-50/50 px-8 py-5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-stone-100 text-stone-600">
                <Box size={14} aria-hidden />
              </div>
              <h2 className="hs-strip-title text-stone-400 tracking-widest uppercase font-black text-sm">Descriptions & Amenities</h2>
            </div>
            <div className="space-y-6 p-8">
              <Field label="In-unit amenities" helpText="Visible on public or tenant-facing profiles.">
                <Textarea rows={3} placeholder="e.g. Wi-Fi, AC, Cabinet…" className="border-stone-200" disabled={readOnly} {...register("amenities")} />
              </Field>
              <Field label="Internal description" helpText="Private staff notes regarding this unit.">
                <Textarea rows={3} placeholder="Staff notes…" className="border-stone-200" disabled={readOnly} {...register("description")} />
              </Field>
            </div>
          </Card>

          {apiError && <Alert variant="error" title="Could not save changes">{apiError}</Alert>}

          <div className="flex flex-col-reverse gap-3 pt-6 sm:flex-row sm:justify-end">
            <Link
              href={`/rooms/${roomId}`}
              className={secondaryOutlineLinkClass + " px-8"}
            >
              Cancel
            </Link>
            <Button
              type="submit"
              variant="primary"
              loading={isSubmitting}
              disabled={readOnly || isSubmitting || !isDirty}
              className={primaryLinkCtaClass + " px-12 border-0 shadow-lg shadow-teal-900/10"}
            >
              Save Changes
            </Button>
          </div>
        </form>
      </motion.div>
    </AppMain>
  );
}
