"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { useParams, useRouter } from "next/navigation";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { ShieldCheck, Box, RefreshCw, Trash2, Plus } from "lucide-react";

import { apiRequest, fetcher } from "../../../../lib/api";
import { canManageRooms } from "../../../../lib/auth";
import { applyServerFieldErrors } from "../../../../lib/forms";
import { parseMoneyInput } from "../../../../lib/money";
import { useUnsavedChangesWarning } from "../../../../hooks/useUnsavedChangesWarning";
import Alert from "../../../_components/ui/Alert";
import Breadcrumbs from "../../../_components/ui/Breadcrumbs";
import Button from "../../../_components/ui/Button";
import { Field, Input, Select, Textarea } from "../../../_components/ui/Fields";
import Link from "next/link";
import {
  BED_STATUS_LABELS,
  ROOM_STATUS_KEYS,
  ROOM_STATUS_OPTION_LABELS,
  ROOM_TYPE_OPTION_LABELS,
} from "../../../../lib/constants";
import { primaryLinkCtaClass, secondaryOutlineLinkClass } from "../../../_components/ui/LinkTokens";
import StandardPage from "../../../_components/ui/StandardPage";
import { FormSection } from "../../../_components/ui/FormSection";
import ResourceIdCell from "../../../_components/ui/ResourceIdCell";
import { useAuth } from "../../../_context/AuthContext";
import PageHeaderActions from "../../../_components/ui/PageHeaderActions";

function normalizeRoomStatus(status) {
  if (ROOM_STATUS_KEYS.includes(status)) return status;
  return "vacant";
}

export default function EditRoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params?.id;

  const { user: currentUser } = useAuth();
  const [apiError, setApiError] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({
    defaultValues: {
      physical_number: "",
      room_code: "",
      room_type: "solo",
      capacity: "",
      monthly_rate: "",
      status: "vacant",
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

  const { data: roomData, error: roomError } = useSWR(
    currentUser && roomId ? `/api/rooms/${roomId}` : null,
    fetcher
  );

  const loading = !roomData && !roomError;

  useEffect(() => {
    if (roomData) {
      const codeParts = (roomData.room_code || "").split("-");
      const physNum = codeParts.length > 1 ? codeParts[1] : roomData.room_code;
      
      reset({
        physical_number: physNum,
        room_code: roomData.room_code || "",
        room_type: roomData.room_type || "solo",
        capacity: roomData.capacity?.toString() ?? "",
        monthly_rate: roomData.monthly_rate ?? "",
        status: normalizeRoomStatus(roomData.status),
        amenities: roomData.amenities || "",
        description: roomData.description || "",
        bed_spaces: roomData.bed_spaces || [],
      });
    }
  }, [roomData, reset]);

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

      if (values.room_type === "shared" && values.bed_spaces.length < 2) {
        setApiError("Shared rooms must have at least 2 bed spaces.");
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
        bed_spaces: values.room_type === "shared" 
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
      router.refresh();
    } catch (error) {
       applyServerFieldErrors(error, setError, { setApiError });
    }
  };

  const readOnly = !canManageRooms(currentUser);
  const title = roomData ? `Room ${roomData.room_code}` : "Room";

  return (
    <StandardPage
      title="Update Details"
      subtitle={roomData ? `Edit unit fields for ${roomData.room_code}.` : "Edit room record."}
      loading={loading}
      error={roomError}
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
        <PageHeaderActions
          backHref={`/rooms/${roomId}`}
          backLabel="Back to Profile"
          user={currentUser}
        />
      }
    >
      <div className="mx-auto w-full max-w-4xl space-y-6">
        {readOnly && (
          <Alert variant="warning" title="Restricted access">
            You do not have permission to edit room records.
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">


          <FormSection title="Identity Details" icon={Box}>
            <div className="space-y-8">
              <div className="grid gap-6 sm:grid-cols-2">
                <Field 
                  label="Unit Number" 
                  required 
                  error={errors.physical_number?.message}
                  helpText="The number displayed on the unit door (e.g. 101)."
                >
                  <Input
                    placeholder="e.g. 101"
                    className="!h-11 border-stone-200 focus:border-teal-500/50"
                    disabled={readOnly}
                    {...register("physical_number", { required: "Room number is required." })}
                  />
                </Field>

                <Field label="Unit Code" required error={errors.room_code?.message} helpText="System identifier for internal tracking.">
                  <Input
                    readOnly
                    placeholder="UNIT-101"
                    className="!h-11 border-stone-200 bg-stone-50 font-mono text-stone-600 cursor-not-allowed"
                    {...register("room_code", { required: "Room code missing." })}
                  />
                </Field>
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <Field label="Rental Rate (PHP)" required error={errors.monthly_rate?.message}>
                  <Input
                    type="number"
                    step="1"
                    placeholder="5000"
                    className="!h-11 border-stone-200 font-mono focus:border-teal-500/50 tabular-nums"
                    disabled={readOnly}
                    {...register("monthly_rate", { required: "Rent rate is required.", min: 100 })}
                  />
                </Field>

                <Field label="Unit Category" required error={errors.room_type?.message}>
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
          </FormSection>

          {roomType === "shared" && (
            <FormSection 
              title="Bed Inventory" 
              icon={ShieldCheck}
              rightElement={
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">
                    {fields.length} beds listed
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
                {fields.map((field, index) => {
                  const isOccupied = field.status === "occupied";
                  const canDelete = fields.length > 2 && !isOccupied;

                  return (
                    <div
                      key={field.id}
                      className="flex items-end gap-3 rounded-xl border border-stone-100 bg-stone-50 p-4 shadow-sm transition-[border-color,box-shadow] focus-within:border-teal-200 focus-within:bg-white"
                    >
                      <Field label="Bed Label" className="flex-1">
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
                      {canDelete ? (
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
                        <div className="mb-0.5 flex h-10 w-10 items-center justify-center rounded-lg bg-stone-100 text-stone-400" title={isOccupied ? "Occupied beds cannot be removed" : "Shared rooms must have at least 2 beds"}>
                          <Trash2 size={16} className="opacity-30" />
                        </div>
                      )}
                    </div>
                  );
                })}
                <p className="pt-2 text-center text-[10px] font-bold uppercase tracking-widest text-stone-400">
                  Shared rooms must maintain at least 2 beds. Occupied beds cannot be removed.
                </p>
              </div>
            </FormSection>
          )}

          <FormSection title="Registry Details" icon={Box}>
            <div className="space-y-6">
              <Field label="Amenities" helpText="Visible on public or tenant-facing profiles.">
                <Textarea rows={3} placeholder="e.g. Wi-Fi, AC, Cabinet…" className="border-stone-200 focus:border-teal-500/50" disabled={readOnly} {...register("amenities")} />
              </Field>
              <Field label="Administrative Notes" helpText="Internal staff context only (not visible to tenants).">
                <Textarea rows={3} placeholder="Staff notes…" className="border-stone-200 focus:border-teal-500/50" disabled={readOnly} {...register("description")} />
              </Field>
            </div>
          </FormSection>

          {apiError && <Alert variant="error" title="Could not save changes">{apiError}</Alert>}

          <div className="flex flex-col-reverse gap-3 pt-8 sm:flex-row sm:justify-end">
            <Link
              href={`/rooms/${roomId}`}
              className={secondaryOutlineLinkClass + " px-10"}
            >
              Cancel
            </Link>
            <Button
              type="submit"
              variant="primary"
              loading={isSubmitting}
              disabled={readOnly || isSubmitting || !isDirty}
              className={primaryLinkCtaClass + " px-12 border-0"}
            >
              Save Changes
            </Button>
          </div>
        </form>
      </div>
    </StandardPage>
  );
}
