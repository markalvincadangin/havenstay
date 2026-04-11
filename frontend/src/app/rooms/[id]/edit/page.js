"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { motion, useReducedMotion } from "framer-motion";
import { Trash2, ArrowLeft, ShieldCheck, Box, RefreshCw } from "lucide-react";

import { apiRequest } from "../../../../lib/api";
import { canManageRooms } from "../../../../lib/auth";
import { useAuthGuard } from "../../../../hooks/useAuthGuard";
import { flattenApiErrors } from "../../../../lib/errors";
import { parseMoneyInput } from "../../../../lib/money";
import { useUnsavedChangesWarning } from "../../../../lib/useUnsavedChangesWarning";
import Alert from "../../../_components/ui/Alert";
import { AppMain } from "../../../_components/ui/AppShell";
import Button from "../../../_components/ui/Button";
import { Card } from "../../../_components/ui/Card";
import { Field, Input, Select, Textarea } from "../../../_components/ui/Fields";
import PageHeader from "../../../_components/ui/PageHeader";
import { SkeletonDetailPage } from "../../../_components/ui/Skeleton";
import UserRoleBadge from "../../../_components/ui/UserRoleBadge";
import Breadcrumbs from "../../../_components/ui/Breadcrumbs";

const ROOM_STATUSES = ["available", "unavailable", "maintenance"];

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.2, ease: "easeOut" },
};

function normalizeRoomStatus(status) {
  if (ROOM_STATUSES.includes(status)) return status;
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

  const loadRoom = useCallback(async () => {
    try {
      const data = await apiRequest(`/api/rooms/${roomId}`, { method: "GET" });
      setRoom(data);
      reset({
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
        room_type: values.room_type,
        capacity: Number(values.capacity),
        monthly_rate: rate,
        status: values.status,
        amenities: values.amenities || null,
        description: values.description || null,
        bed_spaces:
          values.room_type === "shared"
            ? values.bed_spaces.map((b) => ({
                bed_space_id: b.bed_space_id || null,
                bed_label: b.bed_label,
                status: b.status,
              }))
            : [],
      };

      await apiRequest(`/api/rooms/${roomId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      router.push(`/rooms/${roomId}`);
    } catch (error) {
      setApiError(flattenApiErrors(error));
    }
  };

  if (authLoading || loading) {
    return (
      <AppMain>
        <SkeletonDetailPage />
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
          title="Update details"
          subtitle={room ? `Edit registry fields for ${room.room_code}.` : "Edit room record."}
          breadcrumbs={
            <Breadcrumbs
              items={[
                { label: "Room Registry", href: "/rooms" },
                { label: title, href: `/rooms/${roomId}` },
                { label: "Update" },
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
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-100 text-stone-600">
                  <RefreshCw size={16} aria-hidden />
                </div>
                <h2 className="hs-strip-title">Basic Information</h2>
              </div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-tighter text-stone-400">#ROOM-{roomId}</p>
            </div>

            <div className="space-y-8 p-8">
              <div className="grid gap-6 sm:grid-cols-2">
                <Field label="Formal room code" readOnly helpText="Room code is fixed after registration.">
                  <Input
                    disabled
                    className="!h-11 border-stone-200 bg-stone-50 font-mono text-stone-500"
                    {...register("room_code")}
                  />
                </Field>

                <Field label="Monthly rate (PHP)" required error={errors.monthly_rate?.message}>
                  <Input
                    type="number"
                    step="1"
                    className="!h-11 border-stone-200 font-mono tabular-nums"
                    disabled={readOnly}
                    {...register("monthly_rate", { required: "Rate is required.", min: 100 })}
                  />
                </Field>
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <Field label="Room availability" required helpText="Select the current operational status of this unit.">
                  <Select className="!h-11 border-stone-200 font-bold" disabled={readOnly} {...register("status")}>
                    <option value="available">Available</option>
                    <option value="unavailable">Unavailable</option>
                    <option value="maintenance">Maintenance</option>
                  </Select>
                </Field>

                <Field label="Room category" required>
                  <Select className="!h-11 border-stone-200 font-bold" disabled={readOnly} {...register("room_type")}>
                    <option value="solo">Solo (private)</option>
                    <option value="shared">Shared (multi-bed)</option>
                  </Select>
                </Field>
              </div>
            </div>
          </Card>

          <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
            <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/50 px-8 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                  <ShieldCheck size={16} aria-hidden />
                </div>
                <h2 className="hs-strip-title">Bed Layout</h2>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">
                  {roomType === "solo" ? "Single bed" : `${fields.length} beds`}
                </span>
                {roomType === "shared" ? (
                  <button
                    type="button"
                    onClick={() => append({ bed_label: `Bed ${fields.length + 1}`, status: "vacant" })}
                    disabled={readOnly}
                    className="h-8 rounded-lg bg-teal-50 px-3 text-[10px] font-bold uppercase tracking-widest text-teal-800 transition-colors hover:bg-teal-100 disabled:opacity-50"
                  >
                    Add bed
                  </button>
                ) : null}
              </div>
            </div>

            <div className="space-y-4 p-8">
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="flex items-end gap-3 rounded-xl border border-stone-100 bg-stone-50 p-4 shadow-sm transition-[border-color,box-shadow] focus-within:border-teal-200 focus-within:bg-white"
                >
                  <Field label="Label" className="flex-1">
                    <Input
                      placeholder="Bed label"
                      className="!h-10 border-stone-200 bg-white"
                      disabled={readOnly}
                      {...register(`bed_spaces.${index}.bed_label`, { required: true })}
                    />
                  </Field>
                  <Field label="Bed status" className="w-40">
                    <Select
                      disabled={readOnly || field.status === "occupied"}
                      className="!h-10 border-stone-200 bg-white font-bold"
                      {...register(`bed_spaces.${index}.status`)}
                    >
                      <option value="vacant">Vacant</option>
                      <option value="maintenance">Maintenance</option>
                      {field.status === "occupied" ? (
                        <option value="occupied" disabled>
                          Occupied
                        </option>
                      ) : null}
                    </Select>
                  </Field>
                  {roomType === "shared" && fields.length > 1 && field.status !== "occupied" ? (
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      disabled={readOnly}
                      className="mb-0.5 flex h-10 w-10 items-center justify-center rounded-lg border border-red-100 bg-red-50 text-red-500 transition-colors hover:bg-red-100 disabled:opacity-50"
                      aria-label={`Remove bed ${index + 1}`}
                    >
                      <Trash2 size={16} aria-hidden />
                    </button>
                  ) : null}
                </div>
              ))}
              {roomType === "shared" ? (
                <p className="pt-2 text-center text-[10px] font-bold uppercase tracking-widest text-amber-700">
                  Occupied beds cannot be removed until the tenant moves out.
                </p>
              ) : null}
            </div>
          </Card>

          <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
            <div className="flex items-center gap-3 border-b border-stone-100 bg-stone-50/50 px-8 py-5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-100 text-stone-500">
                <Box size={16} aria-hidden />
              </div>
              <h2 className="hs-strip-title">Description</h2>
            </div>
            <div className="space-y-6 p-8">
              <Field label="Amenities">
                <Textarea rows={3} className="border-stone-200" disabled={readOnly} {...register("amenities")} />
              </Field>
              <Field label="Notes">
                <Textarea rows={3} className="border-stone-200" disabled={readOnly} {...register("description")} />
              </Field>
            </div>
          </Card>

          {apiError ? (
            <Alert variant="error" title="Could not save changes">
              {apiError}
            </Alert>
          ) : null}

          <div className="flex flex-col-reverse gap-3 pt-6 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push(`/rooms/${roomId}`)}
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
              Save changes
            </Button>
          </div>
        </form>
      </motion.div>
    </AppMain>
  );
}
