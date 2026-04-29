"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm, useWatch } from "react-hook-form";
import useSWR from "swr";
import { Search, Calculator, Layers, FileCheck, Zap, Droplet, Info, ShieldCheck, Plus } from "lucide-react";

import { SideSheetOverlay } from "@/components/ui/SideSheetOverlay";
import { MeterReadingForm } from '@/features/utilities/components/MeterReadingForm';
import { canManageMeters, canManageBilling } from "@/lib/auth";
import { fetcher, apiRequest } from "@/lib/api";
import { flattenApiErrors } from "@/lib/errors";
import { applyServerFieldErrors } from "@/lib/forms";
import { useAuth } from "@/context/AuthContext";
import { WizardFrame } from "@/components/ui/WizardFrame";
import { Field, Select, Input } from "@/components/ui/Fields";
import ResourceIdCell from "@/components/ui/ResourceIdCell";
import Alert from "@/components/ui/Alert";
import { formatDateString } from "@/lib/formatters";
import CurrencyDisplay from "@/components/ui/CurrencyDisplay";
import { useToasts } from "@/context/ToastContext";

/**
 * MeterReadingSelector — Helper component for step 1 consumption mapping.
 */
const MeterReadingSelector = ({ meter, readingsData, control, setValue, getValues, onRecordReading, canRecord, lastRecordedId }) => {
  const isElectric = meter.utility?.name?.toLowerCase().includes("electric");
  const UtilityIcon = isElectric ? Zap : Droplet;
  const readings = useWatch({ control, name: "readings" }) || [];
  const selectedIdx = readings.findIndex(r => r.meter_id === meter.meter_id);
  const selectedConfig = selectedIdx > -1 ? readings[selectedIdx] : { previous_reading_id: "", current_reading_id: "" };

  const [lastBilled, setLastBilled] = useState(null);

  // Fetch forensic baseline (last billed)
  useEffect(() => {
    const fetchBaseline = async () => {
      try {
        const res = await fetcher(`/api/meters/${meter.meter_id}/last-billed`);
        if (res && res.data) setLastBilled(res.data);
      } catch (e) {
        console.error("Failed to fetch baseline for meter", meter.serial_number);
      }
    };
    fetchBaseline();
  }, [meter.meter_id]);

  const meterReadings = useMemo(() => {
    return (readingsData || []).filter(r => r.meter_id === meter.meter_id)
      .sort((a, b) => new Date(b.reading_date) - new Date(a.reading_date));
  }, [readingsData, meter.meter_id]);

  const prevRead = meterReadings.find(r => String(r.reading_id) === String(selectedConfig.previous_reading_id));
  const currRead = meterReadings.find(r => String(r.reading_id) === String(selectedConfig.current_reading_id));

  // Consumption Preview Logic
  const consumption = useMemo(() => {
    if (!prevRead || !currRead) return null;
    let diff = parseFloat(currRead.reading_value) - parseFloat(prevRead.reading_value);
    if (diff < 0) diff = 10000 - parseFloat(prevRead.reading_value) + parseFloat(currRead.reading_value);
    return diff;
  }, [prevRead, currRead]);

  // Smart Suggestion Logic: Forensically continuous
  useEffect(() => {
    if (meterReadings.length === 0) return;

    const currentReadings = [...(getValues("readings") || [])];
    let tIdx = currentReadings.findIndex(r => r.meter_id === meter.meter_id);
    const hasConfig = tIdx > -1 && (currentReadings[tIdx].previous_reading_id || currentReadings[tIdx].current_reading_id);

    if (!hasConfig) {
      // Suggestion Logic: Start = Last Billed, End = Most Recent
      const suggestedStart = lastBilled?.reading_id || meterReadings[1]?.reading_id || meterReadings[0]?.reading_id;
      const suggestedEnd = meterReadings[0]?.reading_id;

      if (suggestedEnd && suggestedStart) {
        const payload = {
          meter_id: meter.meter_id,
          previous_reading_id: String(suggestedStart),
          current_reading_id: String(suggestedEnd)
        };
        if (tIdx === -1) currentReadings.push(payload);
        else currentReadings[tIdx] = payload;
        
        setValue("readings", currentReadings, { shouldDirty: true });
      }
    } else if (lastRecordedId) {
      const isForThisMeter = meterReadings.some(r => String(r.reading_id) === String(lastRecordedId));
      if (isForThisMeter && currentReadings[tIdx].current_reading_id !== String(lastRecordedId)) {
        currentReadings[tIdx] = { ...currentReadings[tIdx], current_reading_id: String(lastRecordedId) };
        setValue("readings", currentReadings, { shouldDirty: true });
      }
    }
  }, [meterReadings, lastBilled, lastRecordedId, meter.meter_id, setValue, getValues]);

  const validEndReadings = meterReadings.filter(r => {
    if (!prevRead) return true;
    return new Date(r.reading_date) > new Date(prevRead.reading_date);
  });

  const handleUpdate = (field, value) => {
    const currentReadings = [...(getValues("readings") || [])];
    let tIdx = currentReadings.findIndex(r => r.meter_id === meter.meter_id);
    if (tIdx === -1) {
      currentReadings.push({ meter_id: meter.meter_id, previous_reading_id: "", current_reading_id: "" });
      tIdx = currentReadings.length - 1;
    }
    currentReadings[tIdx] = { ...currentReadings[tIdx], [field]: value };
    setValue("readings", currentReadings, { shouldDirty: true });
  };

  const isContinuous = lastBilled && String(selectedConfig.previous_reading_id) === String(lastBilled.reading_id);

  return (
    <div className="border border-stone-200 rounded-xl overflow-hidden mb-6 last:mb-0 bg-white shadow-sm transition-all hover:shadow-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-stone-50 border-b border-stone-100 gap-4">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl shadow-sm border ${isElectric ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-sky-50 text-sky-600 border-sky-100'}`}>
            <UtilityIcon size={18} strokeWidth={2.5} />
          </div>
          <div>
            <div className="hs-strip-title text-stone-500">{meter.utility?.name || "Utility"}</div>
            <div className="font-mono text-sm font-bold text-stone-900 tracking-wider uppercase">SN-{meter.serial_number}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {consumption !== null && (
            <div className="px-3 py-1.5 rounded-lg bg-teal-500 text-white flex items-center gap-2 animate-in zoom-in duration-300 shadow-sm shadow-teal-200">
              <Zap size={12} className={isElectric ? "text-amber-200" : "text-sky-200"} />
              <span className="text-[10px] font-black tracking-widest uppercase">{consumption.toFixed(2)} {isElectric ? 'kWh' : 'm³'}</span>
            </div>
          )}
          {canRecord && (
            <button
              type="button"
              onClick={() => onRecordReading(meter)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-stone-600 hover:text-teal-600 border border-stone-200 hover:border-teal-200 transition-all text-[10px] font-black uppercase tracking-widest shadow-sm active:scale-95"
            >
              <Plus size={14} strokeWidth={3} />
              Record Reading
            </button>
          )}
        </div>
      </div>
      <div className="p-6 grid gap-6 md:grid-cols-2">
        <Field
          label={
            <div className="flex items-center justify-between">
              <span>Start Baseline Reading</span>
              {isContinuous && (
                <span className="text-[9px] font-black text-teal-600 uppercase flex items-center gap-1">
                  <ShieldCheck size={10} /> Forensic Continuity Verified
                </span>
              )}
            </div>
          }
          required
          helpText={prevRead ? `Recorded on ${formatDateString(prevRead.reading_date)}` : "Select the starting reference reading"}
        >
          <div className="relative group">
            <Input
              type="number"
              readOnly
              value={prevRead ? Number(prevRead.reading_value).toFixed(2) : ""}
              placeholder="0.00"
              className={`!h-10 text-sm border-stone-200 font-bold focus:border-teal-500/50 bg-white ${isContinuous ? 'ring-2 ring-teal-500/10' : ''}`}
            />
            <Select
              value={selectedConfig.previous_reading_id}
              onChange={(e) => handleUpdate("previous_reading_id", e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer"
            >
              <option value="">Select reading...</option>
              {meterReadings.map(r => (
                <option key={r.reading_id} value={r.reading_id}>
                  {Number(r.reading_value).toFixed(2)} — {formatDateString(r.reading_date)} {lastBilled?.reading_id === r.reading_id ? '(LAST BILLED)' : ''}
                </option>
              ))}
            </Select>
          </div>
        </Field>
        <Field
          label="End Consumption Reading"
          required
          helpText={currRead ? `Recorded on ${formatDateString(currRead.reading_date)}` : "Select the final consumption reading"}
        >
          <div className="relative group">
            <Input
              type="number"
              readOnly
              value={currRead ? Number(currRead.reading_value).toFixed(2) : ""}
              placeholder="0.00"
              disabled={!selectedConfig.previous_reading_id}
              className="!h-10 text-sm border-stone-200 font-bold focus:border-teal-500/50 bg-white disabled:bg-stone-50"
            />
            <Select
              value={selectedConfig.current_reading_id}
              onChange={(e) => handleUpdate("current_reading_id", e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
              disabled={!selectedConfig.previous_reading_id}
            >
              <option value="">Select later reading...</option>
              {validEndReadings.map(r => (
                <option key={r.reading_id} value={r.reading_id}>
                  {Number(r.reading_value).toFixed(2)} — {formatDateString(r.reading_date)}
                </option>
              ))}
            </Select>
          </div>
        </Field>
      </div>
    </div>
  );
};

/**
 * BillingWizard — Multi-step flow for generating billing cycles.
 */
export default function BillingWizard() {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const { showToast } = useToasts();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const totalSteps = 4;

  const defaultDates = useMemo(() => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const dueDate = new Date(lastDay);
    dueDate.setDate(dueDate.getDate() + 5);

    return {
      start: firstDay.toISOString().split('T')[0],
      end: lastDay.toISOString().split('T')[0],
      due: dueDate.toISOString().split('T')[0]
    };
  }, []);

  const {
    register,
    control,
    getValues,
    setValue,
    trigger,
    setError,
    formState: { errors }
  } = useForm({
    defaultValues: {
      room_id: "",
      due_date: defaultDates.due,
      billing_period_start: defaultDates.start,
      billing_period_end: defaultDates.end,
      readings: [],
      apportionmentOverrides: {},
    },
  });

  const [forecast, setForecast] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeReadingMeter, setActiveReadingMeter] = useState(null);
  const selectedRoomId = useWatch({ control, name: "room_id" });
  const readings = useWatch({ control, name: "readings" }) || [];
  const apportionmentOverrides = useWatch({ control, name: "apportionmentOverrides" }) || {};
  const readOnly = !canManageBilling(currentUser);
  const canRecord = canManageMeters(currentUser);

  const { data: roomsData } = useSWR(currentUser && !readOnly ? `/api/rooms` : null, fetcher);
  const rooms = (roomsData?.data || []);
  const hasNoRooms = roomsData && rooms.length === 0;

  const { data: routeMetersRaw } = useSWR(
    currentUser && !readOnly && selectedRoomId ? `/api/rooms/${selectedRoomId}/meters` : null,
    fetcher
  );

  const selectedRoom = useMemo(() => {
    return rooms.find(r => String(r.room_id) === String(selectedRoomId));
  }, [rooms, selectedRoomId]);

  const routeMeters = useMemo(() => {
    if (!routeMetersRaw) return [];
    return Array.isArray(routeMetersRaw) ? routeMetersRaw : (routeMetersRaw.data || []);
  }, [routeMetersRaw]);

  const [metersReadingsData, setMetersReadingsData] = useState([]);
  const [lastRecordedId, setLastRecordedId] = useState(null);

  useEffect(() => {
    let active = true;
    const fetchAllReadings = async () => {
      if (!routeMeters || routeMeters.length === 0) {
        if (active) setMetersReadingsData([]);
        return;
      }
      const all = [];
      for (let m of routeMeters) {
        const reads = await fetcher(`/api/meters/${m.meter_id}/readings`);
        reads.forEach(r => all.push({ ...r, meter_id: m.meter_id }));
      }
      if (active) setMetersReadingsData(all);
    };

    fetchAllReadings();
    return () => { active = false; };
  }, [routeMeters]);

  const isStepInvalid = useMemo(() => {
    if (currentStepIndex === 0) return !selectedRoomId;
    if (currentStepIndex === 1) {
      if (!selectedRoom?.is_metered) return false;
      if (!routeMeters || routeMeters.length === 0) return true;
      const configuredIds = readings.filter(r => r.previous_reading_id && r.current_reading_id).map(r => r.meter_id);
      return !routeMeters.every(m => configuredIds.includes(m.meter_id));
    }
    return false;
  }, [currentStepIndex, selectedRoomId, routeMeters, readings]);

  const refreshReadings = async (newlyAddedId = null) => {
    if (!routeMeters || routeMeters.length === 0) return;
    const all = [];
    for (let m of routeMeters) {
      const reads = await fetcher(`/api/meters/${m.meter_id}/readings`);
      reads.forEach(r => all.push({ ...r, meter_id: m.meter_id }));
    }
    setMetersReadingsData(all);
    if (newlyAddedId) setLastRecordedId(newlyAddedId);
  };

  const validateStep = async (stepIndex) => {
    if (stepIndex === 0) {
      return await trigger(["room_id", "due_date", "billing_period_start", "billing_period_end"]);
    }
    if (stepIndex === 1) {
      if (!selectedRoom?.is_metered) {
        // Skip reading validation for all-inclusive rooms
      } else {
        const readings = getValues("readings");
        if (!routeMeters || routeMeters.length === 0) {
          showToast("No meters found for this room. Please assign meters before generating a bill.", "error");
          return false;
        }
        const configuredIds = readings.filter(r => r.previous_reading_id && r.current_reading_id).map(r => r.meter_id);
        if (!routeMeters.every(m => configuredIds.includes(m.meter_id))) {
          showToast("Please select both start and end readings for all meters before continuing.", "error");
          return false;
        }
      }
      // Prepare Forecast Generation
      setIsSubmitting(true);
      try {
        const res = await apiRequest('/api/billing/forecast', {
          method: 'POST',
          body: JSON.stringify({
            room_id: getValues("room_id"),
            billing_period_start: getValues("billing_period_start"),
            billing_period_end: getValues("billing_period_end"),
            readings: getValues("readings")
          })
        });
        setForecast(res);
        setValue("apportionmentOverrides", {}, { shouldDirty: true });
        setIsSubmitting(false);
        return true;
      } catch (err) {
        showToast(flattenApiErrors(err), "error");
        setIsSubmitting(false);
        return false;
      }
    }
    if (stepIndex === 2) {
      const overrides = getValues("apportionmentOverrides");
      for (const [_cid, ov] of Object.entries(overrides)) {
        if (ov.amount !== undefined && ov.amount !== "" && !ov.override_reason) {
          showToast("A justification is required when manually overriding a utility amount.", "warning");
          return false;
        }
        if (ov.manual_items && ov.manual_items.some(item => !item.description || item.amount === "" || isNaN(parseFloat(item.amount)))) {
          showToast("Please provide both a description and a valid amount for all additional charges.", "warning");
          return false;
        }
      }
      return forecast !== null;
    }
    return true;
  };

  const onNext = async () => {
    const isValid = await validateStep(currentStepIndex);
    if (isValid) setCurrentStepIndex((prev) => Math.min(prev + 1, totalSteps - 1));
  };
  const onBack = () => setCurrentStepIndex((prev) => Math.max(prev - 1, 0));
  const onSubmit = async () => {
    if (readOnly) return;
    setIsSubmitting(true);
    const finalApportionments = forecast.apportionments.map(base => {
      const ov = apportionmentOverrides[base.contract_id];
      if (ov && ov.amount !== undefined && ov.amount !== "") {
        return {
          contract_id: base.contract_id,
          amount: parseFloat(ov.amount),
          override_reason: ov.override_reason
        };
      }
      return {
        contract_id: base.contract_id,
        amount: base.utility_share,
        override_reason: null
      };
    });
    try {
      const apportionmentsPayload = forecast.apportionments.map(base => {
        const ov = apportionmentOverrides[base.contract_id] || {};
        const manualItems = (ov.manual_items || []).map(item => ({
          item_type: item.item_type,
          description: item.description,
          amount: parseFloat(item.amount) || 0
        }));

        const utilAmount = (ov.amount !== undefined && ov.amount !== "") ? parseFloat(ov.amount) : base.utility_share;

        return {
          contract_id: base.contract_id,
          amount: utilAmount,
          override_reason: ov.override_reason || null,
          manual_items: manualItems
        };
      });

      await apiRequest('/api/billing/commit-utility', {
        method: 'POST',
        body: JSON.stringify({
          room_id: getValues("room_id"),
          billing_period_start: getValues("billing_period_start"),
          billing_period_end: getValues("billing_period_end"),
          due_date: getValues("due_date"),
          readings: getValues("readings"),
          total_charge: forecast.total_charge,
          apportionments: apportionmentsPayload
        })
      });
      showToast("Bills generated and posted to tenant ledgers successfully.", "success");
      router.push('/billing');
    } catch (err) {
      if (err.status === 422 && err.errors) {
        const firstError = Object.values(err.errors)[0][0];
        showToast(firstError, "error");
      } else {
        applyServerFieldErrors(err, setError, { showToast });
      }
      setIsSubmitting(false);
    }
  };

  const addManualItem = (contractId) => {
    const current = { ...getValues("apportionmentOverrides") };
    const ov = current[contractId] || {};
    const items = [...(ov.manual_items || [])];
    items.push({ id: Date.now(), item_type: "penalty", description: "", amount: "" });
    current[contractId] = { ...ov, manual_items: items };
    setValue("apportionmentOverrides", current, { shouldDirty: true });
  };

  const removeManualItem = (contractId, itemId) => {
    const current = { ...getValues("apportionmentOverrides") };
    const ov = current[contractId] || {};
    const items = (ov.manual_items || []).filter(i => i.id !== itemId);
    current[contractId] = { ...ov, manual_items: items };
    setValue("apportionmentOverrides", current, { shouldDirty: true });
  };

  const updateManualItem = (contractId, itemId, field, value) => {
    const current = { ...getValues("apportionmentOverrides") };
    const ov = current[contractId] || {};
    const items = (ov.manual_items || []).map(i => i.id === itemId ? { ...i, [field]: value } : i);
    current[contractId] = { ...ov, manual_items: items };
    setValue("apportionmentOverrides", current, { shouldDirty: true });
  };

  const wizardSteps = [
    { label: "Selection" },
    { label: "Consumption" },
    { label: "Distribution" },
    { label: "Review" }
  ];

  return (
    <div className="max-w-6xl mx-auto">

      <WizardFrame
        title="Billing Cycle Generation"
        steps={wizardSteps}
        currentStepIndex={currentStepIndex}
        onNext={onNext}
        onBack={onBack}
        onCancel={() => router.push("/billing")}
        onSubmit={onSubmit}
        isSubmitting={isSubmitting}
        isNextDisabled={isStepInvalid}
        nextLabel="Next Step"
        submitLabel="Generate Bills"
      >
        <div className="space-y-6">
          {currentStepIndex === 0 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex flex-col gap-2 border-b border-stone-100 pb-6">
                <h3 className="hs-strip-title text-stone-900 flex items-center gap-2">
                  <Search size={14} className="text-teal-600" /> BILLING PERIOD
                </h3>
                <p className="text-xs font-medium text-stone-500">
                  Select the room and the date range for this bill.
                </p>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <Field label="Target Room" required error={errors.room_id?.message}>
                  <Select
                    autoFocus
                    disabled={readOnly || hasNoRooms}
                    hasError={Boolean(errors.room_id)}
                    className="!h-12 border-stone-200 font-bold focus:border-teal-500/50"
                    {...register("room_id", { required: "Assign a target room." })}
                  >
                    <option value="">
                      {hasNoRooms ? "No rooms in inventory" : "Select target room"}
                    </option>
                    {rooms.map((r) => (
                      <option key={r.room_id} value={r.room_id}>{r.room_code}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Due Date" required error={errors.due_date?.message}>
                  <Input
                    type="date"
                    disabled={readOnly}
                    min={getValues("billing_period_end") || ""}
                    hasError={Boolean(errors.due_date)}
                    className="!h-12 border-stone-200 font-bold"
                    {...register("due_date", {
                      required: "Due date is legally required.",
                      validate: (val) => new Date(val) > new Date(getValues("billing_period_end")) || "Due date must be after the billing period."
                    })}
                  />
                </Field>
                <Field label="Billing Period Start" required error={errors.billing_period_start?.message}>
                  <Input
                    type="date"
                    disabled={readOnly}
                    hasError={Boolean(errors.billing_period_start)}
                    className="!h-12 border-stone-200 font-bold"
                    {...register("billing_period_start", { required: "Start date is strictly required." })}
                  />
                </Field>
                <Field label="Billing Period End" required error={errors.billing_period_end?.message}>
                  <Input
                    type="date"
                    disabled={readOnly}
                    min={getValues("billing_period_start") || ""}
                    hasError={Boolean(errors.billing_period_end)}
                    className="!h-12 border-stone-200 font-bold"
                    {...register("billing_period_end", { required: "End date is strictly required." })}
                  />
                </Field>
              </div>
            </div>
          )}

          {currentStepIndex === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex flex-col gap-2 border-b border-stone-100 pb-6 mb-6">
                <h3 className="hs-strip-title text-stone-900 flex items-center gap-2">
                  <Calculator size={14} className="text-teal-600" /> Consumption Mapping
                </h3>
                <p className="text-xs font-medium text-stone-500">
                  Select the start and end physical meter dial readings to calculate exact usage.
                </p>
              </div>
              {!selectedRoom?.is_metered ? (
                <div className="bg-teal-50/50 border border-teal-100 rounded-2xl p-8 text-center animate-in zoom-in duration-500">
                  <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-sm border border-teal-100 text-teal-600 mb-4">
                    <ShieldCheck size={32} />
                  </div>
                  <h4 className="text-sm font-black text-stone-900 uppercase tracking-widest mb-2">All-Inclusive Mode</h4>
                  <p className="text-xs text-stone-500 font-medium max-w-sm mx-auto leading-relaxed">
                    This room is configured as an all-inclusive unit. No utility meter readings are required. Base rent will be the only item processed.
                  </p>
                </div>
              ) : (!routeMeters || routeMeters.length === 0) ? (
                <Alert variant="warning" title="No Active Hardware">
                  This room has no assigned meters. Select another room or register hardware first.
                </Alert>
              ) : (
                <div className="space-y-4">
                  {routeMeters.map(m => (
                    <MeterReadingSelector
                      key={m.meter_id}
                      meter={m}
                      readingsData={metersReadingsData}
                      control={control}
                      setValue={setValue}
                      getValues={getValues}
                      onRecordReading={setActiveReadingMeter}
                      canRecord={canRecord}
                      lastRecordedId={lastRecordedId}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {currentStepIndex === 2 && forecast && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex flex-col gap-2 border-b border-stone-100 pb-6 mb-6">
                <h3 className="hs-strip-title text-stone-900 flex items-center gap-2">
                  <Layers size={14} className="text-teal-600" /> Financial Distribution
                </h3>
                <p className="text-xs font-medium text-stone-500">
                  Verify the automated financial distribution splits and provide manual overrides if necessary.
                </p>
              </div>
              <div className="space-y-6">
                {forecast.apportionments.map((app, idx) => {
                  const orv = apportionmentOverrides[app.contract_id] || {};
                  const isOverridden = orv.amount !== undefined && orv.amount !== "" && parseFloat(orv.amount) !== app.utility_share;
                  const receivedOrphanCent = idx === 0 && (forecast.total_charge * 100) % forecast.apportionments.length !== 0;
                  return (
                    <div key={app.contract_id} className="bg-white border text-left border-stone-200 rounded-2xl p-6 shadow-sm flex flex-col lg:flex-row lg:items-start justify-between gap-6 hover:border-teal-200 transition-colors">
                      <div className="w-full lg:w-1/3">
                        <div className="flex flex-col gap-1">
                          <ResourceIdCell type="contract" id={app.contract_id} />
                          <div className="text-sm font-bold text-stone-900 mt-1">{app.tenant_name}</div>
                          {app.already_billed && (
                            <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 text-[9px] uppercase font-black tracking-widest text-amber-700 border border-amber-100 shadow-sm animate-in shake duration-500">
                              <ShieldCheck size={11} className="text-amber-600" /> <span>Already Billed (Overlap)</span>
                            </div>
                          )}
                          {receivedOrphanCent && !app.already_billed && (
                            <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-stone-100 text-[10px] uppercase font-black tracking-widest text-stone-500">
                              <Info size={11} className="text-stone-400" /> <span>Differential applied</span>
                            </div>
                          )}
                        </div>
                        <div className="mt-4 space-y-3">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-medium text-stone-400 uppercase tracking-widest text-[9px]">Monthly Rent</span>
                            <CurrencyDisplay amount={app.base_rent} className="font-bold text-stone-900" />
                          </div>
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-medium text-stone-400 uppercase tracking-widest text-[9px]">Utility Share</span>
                            <CurrencyDisplay amount={isOverridden ? parseFloat(orv.amount || 0) : app.utility_share} className="font-bold text-stone-900" />
                          </div>
                          {(orv.manual_items || []).length > 0 && (
                            <div className="flex justify-between items-center text-xs animate-in slide-in-from-left-1">
                              <span className="font-medium text-stone-400 uppercase tracking-widest text-[9px]">Additional Items</span>
                              <CurrencyDisplay
                                amount={orv.manual_items.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0)}
                                className="font-bold text-teal-600"
                              />
                            </div>
                          )}
                          <div className="pt-2 border-t border-stone-100 flex justify-between items-center">
                            <span className="text-[10px] font-black text-teal-600 uppercase tracking-widest">Estimated Total</span>
                            <CurrencyDisplay
                              amount={
                                app.base_rent +
                                (isOverridden ? parseFloat(orv.amount || 0) : app.utility_share) +
                                (orv.manual_items || []).reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0)
                              }
                              className="text-lg font-black text-stone-800"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="w-full lg:w-2/3 border-t lg:border-t-0 lg:border-l border-dashed border-stone-200 pt-4 lg:pt-0 lg:pl-6 space-y-4">
                        <Field label="Utility Override (₱)" helpText={app.already_billed ? "This tenant already has an active bill. New charges will be appended or skipped based on policy." : null}>
                          <Input
                            type="number"
                            step="0.01"
                            disabled={readOnly}
                            placeholder={app.utility_share.toFixed(2)}
                            value={orv.amount ?? ""}
                            onChange={e => {
                              setValue("apportionmentOverrides", {
                                ...apportionmentOverrides,
                                [app.contract_id]: { ...orv, amount: e.target.value }
                              }, { shouldDirty: true });
                            }}
                            className={`!h-10 border-stone-200 font-bold font-mono text-sm tracking-wider tabular-nums ${isOverridden ? 'bg-amber-50 text-amber-900 border-amber-300' : ''} ${app.already_billed ? 'border-amber-400 shadow-sm shadow-amber-100' : ''}`}
                          />
                        </Field>
                        {isOverridden && (
                          <div className="animate-in fade-in slide-in-from-top-2">
                            <Field label="Override Reason" required>
                              <Input
                                disabled={readOnly}
                                placeholder="Provide justification for manual override..."
                                value={orv.override_reason || ""}
                                onChange={e => {
                                  setValue("apportionmentOverrides", {
                                    ...apportionmentOverrides,
                                    [app.contract_id]: { ...orv, override_reason: e.target.value }
                                  }, { shouldDirty: true });
                                }}
                                hasError={!orv.override_reason}
                                className="!h-10 border-stone-200 text-sm font-medium focus:border-amber-500/50"
                              />
                            </Field>
                          </div>
                        )}

                        {/* Manual Items Section */}
                        <div className="mt-4 pt-4 border-t border-stone-100">
                          <div className="flex items-center justify-between mb-4">
                            <span className="text-[9px] font-black text-stone-400 uppercase tracking-widest flex items-center gap-2">
                              <Layers size={10} className="text-stone-300" /> Additional Charges / Credits
                            </span>
                            <button
                              type="button"
                              onClick={() => addManualItem(app.contract_id)}
                              className="text-[9px] font-black text-teal-600 uppercase tracking-widest hover:text-teal-700 transition-colors flex items-center gap-1 bg-teal-50 px-2 py-1 rounded-md"
                            >
                              <Plus size={10} strokeWidth={3} /> Add Item
                            </button>
                          </div>

                          <div className="space-y-3">
                            {(orv.manual_items || []).map((item) => (
                              <div key={item.id} className="grid grid-cols-12 gap-2 animate-in fade-in slide-in-from-left-2 duration-300">
                                <div className="col-span-3">
                                  <Select
                                    className="!h-9 text-[10px] font-bold border-stone-200 bg-stone-50"
                                    value={item.item_type}
                                    onChange={e => updateManualItem(app.contract_id, item.id, 'item_type', e.target.value)}
                                  >
                                    <option value="penalty">Penalty</option>
                                    <option value="adjustment">Adjustment</option>
                                  </Select>
                                </div>
                                <div className="col-span-6">
                                  <Input
                                    className="!h-9 text-[10px] font-medium border-stone-200"
                                    placeholder="Description (e.g. Lost Key)"
                                    value={item.description}
                                    hasError={!item.description}
                                    onChange={e => updateManualItem(app.contract_id, item.id, 'description', e.target.value)}
                                  />
                                </div>
                                <div className="col-span-2">
                                  <Input
                                    type="number"
                                    className="!h-9 text-[10px] font-bold border-stone-200"
                                    placeholder="0.00"
                                    value={item.amount}
                                    hasError={item.amount === "" || isNaN(parseFloat(item.amount))}
                                    onChange={e => updateManualItem(app.contract_id, item.id, 'amount', e.target.value)}
                                  />
                                </div>
                                <div className="col-span-1 flex items-center justify-center">
                                  <button
                                    type="button"
                                    onClick={() => removeManualItem(app.contract_id, item.id)}
                                    className="h-8 w-8 flex items-center justify-center rounded-lg text-rose-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                                  >
                                    <Plus size={14} className="rotate-45" strokeWidth={3} />
                                  </button>
                                </div>
                              </div>
                            ))}
                            {(orv.manual_items || []).length === 0 && (
                              <div className="text-[10px] text-stone-300 italic py-2 text-center border border-dashed border-stone-100 rounded-xl">
                                No additional items added for this tenant.
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {currentStepIndex === 3 && forecast && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex flex-col gap-2 border-b border-stone-100 pb-6 mb-6">
                <h3 className="hs-strip-title text-stone-900 flex items-center gap-2">
                  <FileCheck size={14} className="text-teal-600" /> Final Ledger Review
                </h3>
                <p className="text-xs font-medium text-stone-500">
                  Review the billing details below. Generated bills are final and cannot be deleted.
                </p>
                <div className="grid grid-cols-2 gap-6 text-left">
                  <div className="bg-stone-50/50 rounded-2xl p-6 border border-stone-100 shadow-sm">
                    <div className="hs-strip-title text-stone-400 mb-2 uppercase text-[9px]">Total Estimated Ledger</div>
                    <div className="text-2xl font-black text-stone-900">
                      <CurrencyDisplay
                        amount={forecast.apportionments.reduce((acc, a) => {
                          const ov = apportionmentOverrides[a.contract_id] || {};
                          const util = (ov && ov.amount !== undefined && ov.amount !== "") ? parseFloat(ov.amount) : a.utility_share;
                          const manuals = (ov.manual_items || []).reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
                          return acc + a.base_rent + util + manuals;
                        }, 0)}
                      />
                    </div>
                  </div>
                  <div className="bg-stone-50/50 rounded-2xl p-6 border border-stone-100 shadow-sm">
                    <div className="hs-strip-title text-stone-400 mb-2 uppercase text-[9px]">Contracts Billed</div>
                    <div className="text-2xl font-mono font-black text-stone-900 tabular-nums">{forecast.apportionments.length}</div>
                  </div>
                </div>

                {/* Itemized Ledger Preview - Applying HCI reduction of cognitive load */}
                <div className="mt-8 space-y-4">
                  <div className="flex items-center justify-between px-2">
                    <h4 className="text-[10px] font-black text-stone-900 uppercase tracking-widest">Itemized Ledger Preview</h4>
                    <div className="flex gap-4">
                      <span className="text-[9px] font-bold text-stone-400 uppercase flex items-center gap-1.5">
                        <div className="h-1.5 w-1.5 rounded-full bg-stone-300"></div> Rent
                      </span>
                      <span className="text-[9px] font-bold text-stone-400 uppercase flex items-center gap-1.5">
                        <div className="h-1.5 w-1.5 rounded-full bg-amber-400"></div> Utilities
                      </span>
                      <span className="text-[9px] font-bold text-stone-400 uppercase flex items-center gap-1.5">
                        <div className="h-1.5 w-1.5 rounded-full bg-teal-500"></div> Extras
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {forecast.apportionments.map(app => {
                      const ov = apportionmentOverrides[app.contract_id] || {};
                      const util = (ov && ov.amount !== undefined && ov.amount !== "") ? parseFloat(ov.amount) : app.utility_share;
                      const manuals = (ov.manual_items || []).reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
                      const total = app.base_rent + util + manuals;

                      return (
                        <div key={app.contract_id} className="bg-white rounded-2xl border border-stone-100 p-6 shadow-sm hover:border-teal-500/20 transition-all duration-300">
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <div className="text-sm font-black text-stone-900">{app.tenant_name}</div>
                              <div className="text-[10px] font-medium text-stone-400 uppercase tracking-tight">#CONTRACT-{String(app.contract_id).padStart(6, '0')}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-black text-stone-900 tabular-nums">
                                <CurrencyDisplay amount={total} />
                              </div>
                              <div className="text-[9px] font-black text-teal-600 uppercase tracking-widest">Billed Total</div>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-stone-50">
                            <div>
                              <div className="text-[9px] font-black text-stone-400 uppercase mb-1">Monthly Rent</div>
                              <div className="text-xs font-bold text-stone-700 tabular-nums"><CurrencyDisplay amount={app.base_rent} /></div>
                            </div>
                            <div>
                              <div className="text-[9px] font-black text-stone-400 uppercase mb-1">Utility Share</div>
                              <div className="text-xs font-bold text-stone-700 tabular-nums"><CurrencyDisplay amount={util} /></div>
                            </div>
                            <div>
                              <div className="text-[9px] font-black text-stone-400 uppercase mb-1">Additional Charges</div>
                              <div className="text-xs font-bold text-teal-600 tabular-nums"><CurrencyDisplay amount={manuals} /></div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl bg-teal-50/50 border border-teal-100 p-6 text-teal-800 mt-6">
                <ShieldCheck size={20} className="text-teal-400 shrink-0" />
                <p className="hs-strip-title text-teal-800 leading-relaxed font-bold">
                  Please verify all amounts. Once generated, these bills will be immediately posted to the tenants' ledgers.
                </p>
              </div>
            </div>
          )}
        </div>
      </WizardFrame>

      <SideSheetOverlay
        isOpen={!!activeReadingMeter}
        onClose={() => setActiveReadingMeter(null)}
        title="Record Meter Reading"
        subtitle={activeReadingMeter?.serial_number}
      >
        {activeReadingMeter && (
          <MeterReadingForm
            meter={activeReadingMeter}
            onSuccess={(newReading) => {
              setActiveReadingMeter(null);
              refreshReadings(newReading?.reading_id);
              showToast("Meter reading recorded.", "success");
            }}
            onCancel={() => setActiveReadingMeter(null)}
          />
        )}
      </SideSheetOverlay>
    </div>
  );
}
