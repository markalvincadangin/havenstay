"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ShieldCheck, Box, RefreshCw, Trash2 } from "lucide-react";

import { apiRequest } from "../../../lib/api";
import { canManageRooms } from "../../../lib/auth";
import { useAuthGuard } from "../../../hooks/useAuthGuard";
import { flattenApiErrors } from "../../../lib/errors";
import { parseMoneyInput } from "../../../lib/money";
import { useUnsavedChangesWarning } from "../../../lib/useUnsavedChangesWarning";
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

export default function NewRoomPage() {
  const router = useRouter();
  const { user: currentUser, authLoading } = useAuthGuard();
  const shouldReduceMotion = useReducedMotion();
  const [apiError, setApiError] = useState("");

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({
    defaultValues: {
      room_code: "",
      physical_number: "",
      room_type: "solo",
      capacity: "1",
      monthly_rate: "",
      status: "available",
      amenities: "",
      description: "",
      bed_spaces: [{ bed_label: "Bed 1", status: "vacant" }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "bed_spaces",
  });

  useUnsavedChangesWarning(isDirty && !isSubmitting);
  const roomType = useWatch({ control, name: "room_type" });
  const physicalNumber = useWatch({ control, name: "physical_number" });

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
      setValue("capacity", fields.length.toString());
    }
  }, [roomType, fields.length, setValue]);

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
        status: values.status || "available",
        amenities: values.amenities || null,
        description: values.description || null,
      };

      if (values.room_type === "shared") {
        payload.bed_spaces = values.bed_spaces.map((b) => ({
          bed_label: b.bed_label,
          status: b.status || "vacant",
        }));
      }

      const response = await apiRequest("/api/rooms", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const roomId = response?.room?.room_id;
      if (roomId) router.push(`/rooms/${roomId}`);
    } catch (error) {
      setApiError(flattenApiErrors(error));
    }
  };

  if (authLoading) {
    return (
      <AppMain>
        <Spinner label="Loading form…" />
      </AppMain>
    );
  }

  const readOnly = !canManageRooms(currentUser);

  return (
    <AppMain>
      <motion.div
        className="mx-auto mt-8 w-full max-w-4xl space-y-6"
        initial={shouldReduceMotion ? false : pageVariants.initial}
        animate={shouldReduceMotion ? false : pageVariants.animate}
        transition={shouldReduceMotion ? { duration: 0 } : pageVariants.transition}
      >
        <PageHeader
          title="Register Room"
          subtitle="Add a room record and configure bed spaces for the registry."
          breadcrumbs={
            <Breadcrumbs items={[{ label: "Room Registry", href: "/rooms" }, { label: "Register room" }]} />
          }
          actions={
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => router.push("/rooms")}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-500 transition-colors hover:bg-stone-50"
                aria-label="Back to Room Registry"
                title="Back to Room Registry"
              >
                <ArrowLeft size={18} aria-hidden />
              </button>
              <div className="border-l border-stone-200 pl-3">
                <UserRoleBadge username={currentUser?.username} roleName={currentUser?.role?.role_name} />
              </div>
            </div>
          }
        />

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
            <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/50 px-8 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-100 text-stone-600">
                  <RefreshCw size={16} aria-hidden />
                </div>
                <h2 className="hs-strip-title">Basic Information</h2>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Required where marked</span>
            </div>

            <div className="space-y-8 p-8">
              <div className="grid gap-6 sm:grid-cols-2">
                <Field label="Physical number" required error={errors.physical_number?.message}>
                  <Input
                    autoFocus
                    placeholder="e.g. 101"
                    className="!h-11 border-stone-200"
                    disabled={readOnly}
                    {...register("physical_number", { required: "Physical number is required." })}
                  />
                </Field>

                <Field label="Formal room code" required error={errors.room_code?.message} helpText="Generated from category and physical number.">
                  <Input
                    readOnly
                    placeholder="SOLO-101"
                    className="!h-11 border-stone-200 bg-stone-50 font-mono"
                    {...register("room_code", { required: "Room code missing." })}
                  />
                </Field>
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <Field label="Monthly rate (PHP)" required error={errors.monthly_rate?.message}>
                  <Input
                    type="number"
                    step="1"
                    placeholder="5000"
                    className="!h-11 border-stone-200 font-mono tabular-nums"
                    disabled={readOnly}
                    {...register("monthly_rate", { required: "Rate is required.", min: 100 })}
                  />
                </Field>

                <Field label="Room category" required error={errors.room_type?.message}>
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
                  className="flex items-end gap-3 rounded-xl border border-stone-100 bg-stone-50 p-4 shadow-sm"
                >
                  <Field label="Label" className="flex-1">
                    <Input
                      placeholder="Bed A"
                      className="!h-10 border-stone-200 bg-white"
                      disabled={readOnly}
                      {...register(`bed_spaces.${index}.bed_label`, { required: true })}
                    />
                  </Field>
                  <Field label="Initial status" className="w-40">
                    <Select className="!h-10 border-stone-200 bg-white" disabled={readOnly} {...register(`bed_spaces.${index}.status`)}>
                      <option value="vacant">Vacant</option>
                      <option value="maintenance">Maintenance</option>
                    </Select>
                  </Field>
                  {roomType === "shared" && fields.length > 1 ? (
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
              <Field label="Amenities" helpText="e.g. AC, Wi-Fi, desk">
                <Textarea rows={3} placeholder="List amenities…" className="border-stone-200" disabled={readOnly} {...register("amenities")} />
              </Field>
              <Field label="Notes" helpText="Optional context for staff (maintenance, access, etc.).">
                <Textarea rows={3} placeholder="Optional notes…" className="border-stone-200" disabled={readOnly} {...register("description")} />
              </Field>
            </div>
          </Card>

          {apiError ? (
            <Alert variant="error" title="Could not register room">
              {apiError}
            </Alert>
          ) : null}

          <div className="flex flex-col-reverse gap-3 pt-6 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push("/rooms")}
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
              Register room
            </Button>
          </div>
        </form>
      </motion.div>
    </AppMain>
  );
}
