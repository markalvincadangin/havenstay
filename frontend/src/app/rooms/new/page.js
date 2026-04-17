"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { ShieldCheck, Box, RefreshCw, Trash2, Plus } from "lucide-react";

import { apiRequest } from "../../../lib/api";
import { canManageRooms } from "../../../lib/auth";
import { applyServerFieldErrors } from "../../../lib/forms";
import { parseMoneyInput } from "../../../lib/money";
import { useUnsavedChangesWarning } from "../../../lib/useUnsavedChangesWarning";
import Alert from "../../_components/ui/Alert";
import Breadcrumbs from "../../_components/ui/Breadcrumbs";
import Button from "../../_components/ui/Button";
import { Field, Input, Select, Textarea } from "../../_components/ui/Fields";
import Link from "next/link";
import { ROOM_TYPE_LABELS, BED_STATUS_LABELS } from "../../../lib/constants";
import { primaryLinkCtaClass, secondaryOutlineLinkClass } from "../../_components/ui/LinkTokens";
import StandardPage from "../../_components/ui/StandardPage";
import { FormSection } from "../../_components/ui/FormSection";
import PageHeaderActions from "../../_components/ui/PageHeaderActions";
import { useAuth } from "../../_context/AuthContext";

export default function NewRoomPage() {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const [apiError, setApiError] = useState("");

  const {
    register,
    handleSubmit,
    setValue,
    control,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({
    defaultValues: {
      physical_number: "",
      room_code: "",
      room_type: "solo",
      capacity: "1",
      monthly_rate: "",
      status: "vacant",
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
      const generatedCode = `UNIT-${String(physicalNumber).trim().toUpperCase()}`;
      setValue("room_code", generatedCode, { shouldDirty: true });
    }
  }, [physicalNumber, setValue]);

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
        status: values.status || "vacant",
        amenities: values.amenities || null,
        description: values.description || null,
      };

      if (values.room_type === "shared") {
        if (!values.bed_spaces || values.bed_spaces.length < 2) {
          setApiError("Shared rooms must have at least 2 bed spaces.");
          return;
        }

        payload.bed_spaces = values.bed_spaces.map((b) => ({
          bed_label: b.bed_label,
          status: b.status || "vacant",
        }));
      }

      const response = await apiRequest("/api/rooms", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const roomId = response?.room_id;
      if (roomId) router.push(`/rooms/${roomId}`);
    } catch (error) {
       applyServerFieldErrors(error, setError, { setApiError });
    }
  };

  const readOnly = !canManageRooms(currentUser);

  return (
    <StandardPage
      title="Register Unit"
      subtitle="Add a unit record and configure initial bed spaces."
      breadcrumbs={
        <Breadcrumbs items={[{ label: "Room Inventory", href: "/rooms" }, { label: "Register Unit" }]} />
      }
      actions={
        <PageHeaderActions
          backHref="/rooms"
          backLabel="Back to Room Inventory"
          user={currentUser}
        />
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="mx-auto w-full max-w-4xl space-y-6">
        <FormSection
          title="Basic Information"
          icon={RefreshCw}
          rightElement={<span className="text-[10px] font-bold uppercase tracking-widest text-stone-300">Required fields</span>}
        >
          <div className="space-y-8">
            <div className="grid gap-6 sm:grid-cols-2">
              <Field 
                label="Room Number" 
                required 
                error={errors.physical_number?.message}
                helpText="The number displayed on the unit door (e.g. 101)."
              >
                <Input
                  autoFocus
                  placeholder="e.g. 101"
                  className="!h-11 border-stone-200 focus:border-teal-500/50"
                  disabled={readOnly}
                  {...register("physical_number", { required: "Room number is required." })}
                />
              </Field>

              <Field label="Room Code" required error={errors.room_code?.message} helpText="System identifier for internal tracking.">
                <Input
                  readOnly
                  placeholder="UNIT-101"
                  className="!h-11 border-stone-200 bg-stone-50 font-mono text-stone-600 cursor-not-allowed"
                  {...register("room_code", { required: "Room code missing." })}
                />
              </Field>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <Field label="Monthly Rent (PHP)" required error={errors.monthly_rate?.message}>
                <Input
                  type="number"
                  step="1"
                  placeholder="5000"
                  className="!h-11 border-stone-200 font-mono focus:border-teal-500/50 tabular-nums"
                  disabled={readOnly}
                  {...register("monthly_rate", { required: "Rent rate is required.", min: 100 })}
                />
              </Field>

              <Field label="Room Category" required error={errors.room_type?.message}>
                <Select className="!h-11 border-stone-200 font-bold" disabled={readOnly} {...register("room_type")}>
                  {Object.entries(ROOM_TYPE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </Select>
              </Field>
            </div>
          </div>
        </FormSection>

        {roomType === "shared" && (
          <FormSection
            title="Room Layout"
            icon={ShieldCheck}
            rightElement={
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">
                  {fields.length} beds
                </span>
                <button
                  type="button"
                  onClick={() => append({ bed_label: `Bed ${fields.length + 1}`, status: "vacant" })}
                  disabled={readOnly}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-teal-50 px-3 text-[10px] font-black uppercase tracking-widest text-teal-700 transition-colors hover:bg-teal-100 disabled:opacity-50"
                >
                  <Plus size={12} strokeWidth={3} />
                  Add bed
                </button>
              </div>
            }
          >
            <div className="space-y-4">
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="flex items-end gap-3 rounded-xl border border-stone-100 bg-stone-50 p-4 shadow-sm"
                >
                  <Field label="Bed Label" className="flex-1">
                    <Input
                      placeholder="Bed A"
                      className="!h-10 border-stone-200 bg-white font-mono"
                      disabled={readOnly}
                      {...register(`bed_spaces.${index}.bed_label`, { required: true })}
                    />
                  </Field>
                  <Field label="Initial Status" className="w-40">
                    <Select className="!h-10 border-stone-200 bg-white font-bold" disabled={readOnly} {...register(`bed_spaces.${index}.status`)}>
                      <option value="vacant">{BED_STATUS_LABELS.vacant}</option>
                      <option value="maintenance">{BED_STATUS_LABELS.maintenance}</option>
                    </Select>
                  </Field>
                  {fields.length > 2 ? (
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
                    <div className="mb-0.5 flex h-10 w-10 items-center justify-center rounded-lg bg-stone-100 text-stone-400" title="Shared rooms must have at least 2 beds">
                      <Trash2 size={16} className="opacity-30" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </FormSection>
        )}

        <FormSection title="Important Notes" icon={Box}>
          <div className="space-y-6">
            <Field label="Included Amenities" helpText="e.g. AC, Wi-Fi, personal desk">
              <Textarea rows={3} placeholder="List room amenities…" className="border-stone-200 focus:border-teal-500/50" disabled={readOnly} {...register("amenities")} />
            </Field>
            <Field label="Management Notes" helpText="Internal staff context only (not visible to tenants).">
              <Textarea rows={3} placeholder="Optional staff notes…" className="border-stone-200 focus:border-teal-500/50" disabled={readOnly} {...register("description")} />
            </Field>
          </div>
        </FormSection>

        {apiError && <Alert variant="error" title="Could not register room">{apiError}</Alert>}

        <div className="flex flex-col-reverse gap-3 pt-8 sm:flex-row sm:justify-end">
          <Link
            href="/rooms"
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
            Register Unit
          </Button>
        </div>
      </form>
    </StandardPage>
  );
}
