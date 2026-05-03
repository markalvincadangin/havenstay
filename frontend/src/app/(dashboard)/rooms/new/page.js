"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { ShieldCheck, Box, RefreshCw, Trash2, Plus } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { canManageRooms } from "@/lib/auth";
import { applyServerFieldErrors } from "@/lib/forms";
import { parseMoneyInput } from "@/lib/formatters";
import { useUnsavedChangesWarning } from "@/hooks/useUnsavedChangesWarning";
import Alert from "@/components/ui/Alert";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import Button from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Fields";
import Link from "next/link";
import { ROOM_TYPE_LABELS, BED_STATUS_LABELS } from "@/lib/constants";
import { primaryLinkCtaClass, secondaryOutlineLinkClass } from "@/components/ui/LinkTokens";
import StandardPage from "@/components/ui/StandardPage";
import { SkeletonDetailPage } from "@/components/ui/Skeleton";
import { FormSection } from "@/components/ui/FormSection";
import PageHeaderActions from "@/components/ui/PageHeaderActions";
import { useAuth } from "@/context/AuthContext";
import { useToasts } from "@/context/ToastContext";

export default function NewRoomPage() {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const { showToast } = useToasts();
  
  const [scannedDuplicate, setScannedDuplicate] = useState(null);
  const [isScanning, setIsScanning] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    control,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({
    mode: "onChange",
    defaultValues: {
      room_code: "",
      room_type: "private",
      capacity: "1",
      monthly_rate: "",
      amenities: "",
      description: "",
      is_metered: true,
      bed_spaces: [{ bed_label: "Bed 1", status: "vacant" }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "bed_spaces",
  });

  useUnsavedChangesWarning(isDirty && !isSubmitting);
  const roomType = useWatch({ control, name: "room_type" });

  useEffect(() => {
    if (roomType === "private") {
      setValue("capacity", "1");
      setValue("bed_spaces", [{ bed_label: "Bed 1", status: "vacant" }]);
    } else {
      setValue("capacity", fields.length.toString());
    }
  }, [roomType, fields.length, setValue]);

  const checkUniqueness = async (value) => {
    if (!value || value.trim().length < 2) {
      setScannedDuplicate(null);
      return;
    }
    setIsScanning(true);
    try {
      const results = await apiRequest(`/api/rooms?q=${encodeURIComponent(value.trim())}`);
      const rows = results?.data || results || [];
      const match = rows.find(r => r.room_code?.toLowerCase().trim() === value.trim().toLowerCase());
      setScannedDuplicate(match ? match.room_id : null);
    } catch (e) {
      // Silently fail scanning
    } finally {
      setIsScanning(false);
    }
  };

  const onSubmit = async (values) => {
    if (!canManageRooms(currentUser)) return;
    try {
      const rate = parseMoneyInput(values.monthly_rate);
      if (Number.isNaN(rate)) {
        showToast("Enter a valid monthly rate.", "error");
        return;
      }
      const payload = {
        room_code: values.room_code,
        room_type: values.room_type,
        capacity: Number(values.capacity),
        monthly_rate: rate,
        amenities: values.amenities || null,
        description: values.description || null,
        is_metered: values.is_metered ? 1 : 0,
      };
      if (values.room_type === "shared") {
        if (!values.bed_spaces || values.bed_spaces.length < 2) {
          showToast("Shared rooms must have at least 2 bed spaces.", "error");
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

      const roomId = response?.room_id || response?.id;
      if (roomId) {
        showToast(`Room ${values.room_code} registered.`, "success");
        router.push(`/rooms/${roomId}`);
      }
    } catch (error) {
      applyServerFieldErrors(error, setError, { showToast });
    }
  };

  const readOnly = !canManageRooms(currentUser);

  return (
    <StandardPage
      title="Register Room"
      subtitle="Define a new room and initialize its bed space availability."
      skeleton={<SkeletonDetailPage />}
      breadcrumbs={
        <Breadcrumbs items={[{ label: "Room Inventory", href: "/rooms" }, { label: "Register Room" }]} />
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
          title="Identity Details"
          icon={RefreshCw}
          rightElement={<span className="text-[10px] font-bold uppercase tracking-widest text-stone-300">Required fields</span>}
        >
          <div className="space-y-8">
            <div className="grid gap-6 sm:grid-cols-2">
              <Field
                label="Room Code"
                required
                error={errors.room_code?.message}
                warning={scannedDuplicate ? "A room with this code already exists." : null}
                helpText="Unique system identifier (e.g. 101 or RM-101)."
              >
                <Input
                  autoFocus
                  hasError={Boolean(errors.room_code || scannedDuplicate)}
                  placeholder="e.g. 101"
                  className="!h-11 border-stone-200 focus:border-teal-500/50 font-mono"
                  disabled={readOnly}
                  {...register("room_code", { required: "Room code is required." })}
                  onBlur={(e) => checkUniqueness(e.target.value)}
                />
              </Field>
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
              <Field label="Monthly Rent" required error={errors.monthly_rate?.message}>
                <Input
                  type="number"
                  step="1"
                  prefix="₱"
                  hasError={Boolean(errors.monthly_rate)}
                  placeholder="5000"
                  className="!h-11 border-stone-200 font-mono focus:border-teal-500/50 tabular-nums font-bold"
                  disabled={readOnly}
                  {...register("monthly_rate", { required: "Monthly rent is required.", min: 100 })}
                />
              </Field>
              <Field label="Room Type" required error={errors.room_type?.message}>
                <Select hasError={Boolean(errors.room_type)} className="!h-11 border-stone-200 font-bold" disabled={readOnly} {...register("room_type")}>
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
            title="Bed Inventory"
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
                      hasError={Boolean(errors?.bed_spaces?.[index]?.bed_label)}
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
        <FormSection title="Utility Hardware" icon={Box}>
          <div className="space-y-4">
            <label className="flex items-start gap-4 p-4 rounded-xl border border-stone-200 hover:border-stone-300 transition-colors bg-white cursor-pointer select-none">
              <div className="pt-0.5">
                <input 
                  type="checkbox" 
                  className="w-5 h-5 rounded border-stone-300 text-teal-600 focus:ring-teal-600"
                  {...register("is_metered")}
                />
              </div>
              <div>
                <div className="text-sm font-bold text-stone-900">Enable Utility Metering</div>
                <div className="text-xs text-stone-500 mt-1 font-medium leading-relaxed">
                  Check this if the room has individual electric/water sub-meters. If unchecked, the room will be treated as &apos;All-Inclusive&apos; during billing.
                </div>
              </div>
            </label>
          </div>
        </FormSection>
        <FormSection title="Registry Details" icon={Box}>
          <div className="space-y-6">
            <Field label="Amenities" helpText="e.g. AC, Wi-Fi, personal desk">
              <Textarea rows={3} placeholder="List room amenities…" className="border-stone-200 focus:border-teal-500/50" disabled={readOnly} {...register("amenities")} />
            </Field>
            <Field label="Administrative Notes" helpText="Internal staff context only (not visible to tenants).">
              <Textarea rows={3} placeholder="Optional staff notes…" className="border-stone-200 focus:border-teal-500/50" disabled={readOnly} {...register("description")} />
            </Field>
          </div>
        </FormSection>
        <div className="flex flex-col-reverse gap-3 pt-8 sm:flex-row sm:justify-end">
          <Link
            href="/rooms"
            className="flex h-12 items-center justify-center rounded-xl border border-stone-200 px-10 text-xs font-black uppercase tracking-widest text-stone-500 transition-all hover:bg-stone-50 active:scale-95"
          >
            Cancel
          </Link>
          <Button
            type="submit"
            variant="primary"
            loading={isSubmitting}
            disabled={readOnly || isSubmitting || scannedDuplicate}
            className="h-12 rounded-xl px-12 text-xs font-black uppercase tracking-widest shadow-lg shadow-teal-900/10 active:scale-95 transition-all"
          >
            Register Room
          </Button>
        </div>
      </form>
    </StandardPage>
  );
}
