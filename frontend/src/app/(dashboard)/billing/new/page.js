"use client";
import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import useSWR from "swr";
import { Search, Calculator, Layers, FileCheck, Zap, Droplet, Info, ShieldCheck } from "lucide-react";
import { fetcher, apiRequest } from "@/lib/api";
import { flattenApiErrors } from "@/lib/errors";
import { applyServerFieldErrors } from "@/lib/forms";
import { useAuth } from "@/context/AuthContext";
import { canManageBilling } from "@/lib/auth";
import StandardPage from "@/components/ui/StandardPage";
import { WizardFrame } from "@/components/ui/WizardFrame";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import { Field, Select, Input } from "@/components/ui/Fields";
import ResourceIdCell from "@/components/ui/ResourceIdCell";
import Alert from "@/components/ui/Alert";
import { formatDateString } from "@/lib/formatters";
import { useToasts } from "@/context/ToastContext";
const MeterReadingSelector = ({ meter, readingsData, control, setValue, getValues }) => {
  const isElectric = meter.utility?.name?.toLowerCase().includes("electric");
  const UtilityIcon = isElectric ? Zap : Droplet;
  // Sort ascending chronologically
  const meterReadings = useMemo(() => {
    return (readingsData || []).filter(r => r.meter_id === meter.meter_id)
      .sort((a,b) => new Date(a.reading_date) - new Date(b.reading_date));
  }, [readingsData, meter.meter_id]);
  const readings = useWatch({ control, name: "readings" }) || [];
  const selectedIdx = readings.findIndex(r => r.meter_id === meter.meter_id);
  const selectedConfig = selectedIdx > -1 ? readings[selectedIdx] : { previous_reading_id: "", current_reading_id: "" };
  const prevRead = meterReadings.find(r => String(r.reading_id) === String(selectedConfig.previous_reading_id));
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
    // Auto-reset end reading if logically impossible now
    if (field === 'previous_reading_id') {
      const nrPrev = meterReadings.find(r => String(r.reading_id) === String(value));
      const nrCurr = meterReadings.find(r => String(r.reading_id) === String(currentReadings[tIdx].current_reading_id));
      if (nrPrev && nrCurr && new Date(nrCurr.reading_date) <= new Date(nrPrev.reading_date)) {
        currentReadings[tIdx].current_reading_id = "";
      }
    }
    setValue("readings", currentReadings, { shouldDirty: true });
  };
  return (
    <div className="border border-stone-200 rounded-xl overflow-hidden mb-6 last:mb-0 bg-white">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-stone-50 border-b border-stone-100 gap-4">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg shadow-inner ${isElectric ? 'bg-amber-50 text-amber-500' : 'bg-sky-50 text-sky-500'}`}>
            <UtilityIcon size={18} strokeWidth={2.5} />
          </div>
          <div>
            <div className="text-[10px] uppercase font-black tracking-[0.2em] text-stone-500">{meter.utility?.name || "Utility"}</div>
            <div className="font-mono text-sm font-bold text-stone-900 tracking-wider">SN-{meter.serial_number}</div>
          </div>
        </div>
      </div>
      <div className="p-6 grid gap-6 md:grid-cols-2">
        <Field label="Start Baseline Reading" required>
          <Select
            value={selectedConfig.previous_reading_id}
            onChange={(e) => handleUpdate("previous_reading_id", e.target.value)}
            className="!h-10 text-sm border-stone-200 font-bold focus:border-teal-500/50"
          >
            <option value="">Select reading...</option>
            {meterReadings.map(r => (
              <option key={r.reading_id} value={r.reading_id}>
                {Number(r.reading_value).toFixed(2)} — {formatDateString(r.reading_date)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="End Consumption Reading" required>
          <Select
            value={selectedConfig.current_reading_id}
            onChange={(e) => handleUpdate("current_reading_id", e.target.value)}
            className="!h-10 text-sm border-stone-200 font-bold focus:border-teal-500/50"
            disabled={!selectedConfig.previous_reading_id}
          >
            <option value="">Select later reading...</option>
            {validEndReadings.map(r => (
              <option key={r.reading_id} value={r.reading_id}>
                {Number(r.reading_value).toFixed(2)} — {formatDateString(r.reading_date)}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </div>
  );
};
export default function NewBillingPage() {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const { showToast } = useToasts();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [apiError, setApiError] = useState("");
  const totalSteps = 4;
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
      due_date: "",
      billing_period_start: "",
      billing_period_end: "",
      readings: [],
      apportionmentOverrides: {},
    },
  });
  const [forecast, setForecast] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const selectedRoomId = useWatch({ control, name: "room_id" });
  const apportionmentOverrides = useWatch({ control, name: "apportionmentOverrides" }) || {};
  const readOnly = !canManageBilling(currentUser);
  // Data fetching
  const { data: roomsData } = useSWR(currentUser && !readOnly ? `/api/rooms` : null, fetcher);
  const rooms = (roomsData?.data || []);
  const { data: routeMeters } = useSWR(
    currentUser && !readOnly && selectedRoomId ? `/api/rooms/${selectedRoomId}/meters` : null, 
    fetcher
  );
  const [metersReadingsData, setMetersReadingsData] = useState([]);
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
  const validateStep = async (stepIndex) => {
    setApiError("");
    if (stepIndex === 0) {
      return await trigger(["room_id", "due_date", "billing_period_start", "billing_period_end"]);
    }
    if (stepIndex === 1) {
      const readings = getValues("readings");
      if (!routeMeters || routeMeters.length === 0) {
        setApiError("No active meters detected. Registration aborted.");
        return false;
      }
      const configuredIds = readings.filter(r => r.previous_reading_id && r.current_reading_id).map(r => r.meter_id);
      if(!routeMeters.every(m => configuredIds.includes(m.meter_id))) {
         setApiError("All active meters require both start and end readings to advance.");
         return false;
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
        setApiError(flattenApiErrors(err));
        setIsSubmitting(false);
        return false;
      }
    }
    if (stepIndex === 2) {
      // Validate Custom Overrides
      const overrides = getValues("apportionmentOverrides");
      for (const [_cid, ov] of Object.entries(overrides)) {
        if (ov.amount !== undefined && ov.amount !== "" && !ov.override_reason) {
          setApiError("Override reasons must be supplied for custom amounts.");
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
    setApiError("");
    if (readOnly) return;
    setIsSubmitting(true);
    // Construct final payload
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
        amount: base.amount,
        override_reason: null
      };
    });
    try {
      await apiRequest('/api/billing/commit-utility', {
        method: 'POST',
        body: JSON.stringify({
          room_id: getValues("room_id"),
          billing_period_start: getValues("billing_period_start"),
          billing_period_end: getValues("billing_period_end"),
          due_date: getValues("due_date"),
          readings: getValues("readings"),
          apportionments: finalApportionments
        })
      });
      showToast("Billing ledger committed and apportionments saved.", "success");
      router.push('/billing');
    } catch(err) {
      applyServerFieldErrors(err, setError, { setApiError });
      setIsSubmitting(false);
    }
  };
  const wizardSteps = [
    { label: "Context" },
    { label: "Readings" },
    { label: "Apportionment" },
    { label: "Confirm" }
  ];
  return (
    <StandardPage
      title="Utility Apportionment Wizard"
      subtitle="FORENSIC BILLING AND ORCHESTRATION"
      breadcrumbs={
        <Breadcrumbs items={[{ label: "Billing", href: "/billing" }, { label: "Apportionment Wizard" }]} />
      }
    >
      {readOnly && (
        <Alert variant="warning" title="Restricted Role" className="max-w-4xl mx-auto mb-6">
          You do not have permission to execute billing ledgers.
        </Alert>
      )}
      {apiError && <Alert variant="error" title="Submission Error" className="max-w-4xl mx-auto mb-6">{apiError}</Alert>}
      <WizardFrame
        title="Apportionment execution"
        steps={wizardSteps}
        currentStepIndex={currentStepIndex}
        onNext={onNext}
        onBack={onBack}
        onCancel={() => router.push("/billing")}
        onSubmit={onSubmit}
        isSubmitting={isSubmitting}
        nextLabel="Next Step"
        submitLabel="Commit Ledger"
      >
        <div className="space-y-6">
          {currentStepIndex === 0 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
               <div className="flex flex-col gap-2 border-b border-stone-100 pb-6">
                  <h3 className="text-sm font-black text-stone-900 tracking-tight flex items-center gap-2">
                     <Search size={16} /> Data Selection Matrix
                  </h3>
                  <p className="text-xs font-medium text-stone-500">
                     Define the target room and the specific chronological billing boundaries.
                  </p>
               </div>
               <div className="grid gap-6 md:grid-cols-2">
                  <Field label="Target Room" required error={errors.room_id?.message}>
                     <Select
                        autoFocus
                        disabled={readOnly}
                        hasError={Boolean(errors.room_id)}
                        className="!h-12 border-stone-200 font-bold focus:border-teal-500/50"
                        {...register("room_id", { required: "Room identification is necessary." })}
                     >
                        <option value="">Select a unit...</option>
                        {rooms.map(r => (
                           <option key={r.room_id} value={r.room_id}>{r.room_code}</option>
                        ))}
                     </Select>
                  </Field>
                  <Field label="Due Date" required error={errors.due_date?.message}>
                     <Input
                        type="date"
                        disabled={readOnly}
                        hasError={Boolean(errors.due_date)}
                        className="!h-12 border-stone-200 font-bold"
                        {...register("due_date", { required: "Due date is legally required." })}
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
                  <h3 className="text-sm font-black text-stone-900 tracking-tight flex items-center gap-2">
                     <Calculator size={16} /> Consumption Mapping
                  </h3>
                  <p className="text-xs font-medium text-stone-500">
                     Select the start and end physical meter dial readings to calculate exact usage.
                  </p>
               </div>
               {(!routeMeters || routeMeters.length === 0) ? (
                  <Alert variant="warning" title="No Active Hardware">
                     This room has no assigned meters. Select another room or register hardware first.
                  </Alert>
               ) : (
                  <div>
                     {routeMeters.map(m => (
                        <MeterReadingSelector 
                           key={m.meter_id}
                           meter={m}
                           readingsData={metersReadingsData}
                           control={control}
                           setValue={setValue}
                           getValues={getValues}
                        />
                     ))}
                  </div>
               )}
            </div>
          )}
          {currentStepIndex === 2 && forecast && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
               <div className="flex flex-col gap-2 border-b border-stone-100 pb-6 mb-6">
                  <h3 className="text-sm font-black text-stone-900 tracking-tight flex items-center gap-2">
                     <Layers size={16} /> Apportionment Preview
                  </h3>
                  <p className="text-xs font-medium text-stone-500">
                     Verify the automated financial distribution splits and provide manual overrides if necessary.
                  </p>
               </div>
               <div className="space-y-6">
                  {forecast.apportionments.map((app, idx) => {
                     const orv = apportionmentOverrides[app.contract_id] || {};
                     const isOverridden = orv.amount !== undefined && orv.amount !== "" && parseFloat(orv.amount) !== app.amount;
                     const receivedOrphanCent = idx === 0 && (forecast.total_charge * 100) % forecast.apportionments.length !== 0;
                     return (
                        <div key={app.contract_id} className="bg-white border text-left border-stone-200 rounded-xl p-6 shadow-sm flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                           <div className="w-full lg:w-1/3">
                              <div className="flex flex-col gap-1">
                                 <ResourceIdCell type="contract" id={app.contract_id} />
                                 <div className="text-sm font-bold text-stone-900">{app.tenant_name}</div>
                                 {receivedOrphanCent && (
                                    <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-stone-100 text-[10px] uppercase font-black tracking-widest text-stone-500">
                                       <Info size={11} className="text-stone-400" /> Differential applied
                                    </div>
                                 )}
                              </div>
                              <div className="mt-4 text-xs font-medium text-stone-400 uppercase tracking-widest">Base Split</div>
                              <div className="text-lg font-mono font-black text-stone-800 tabular-nums">₱{app.amount.toFixed(2)}</div>
                           </div>
                           <div className="w-full lg:w-2/3 border-t lg:border-t-0 lg:border-l border-dashed border-stone-200 pt-4 lg:pt-0 lg:pl-6 space-y-4">
                              <Field label="Override Amount (₱)">
                                 <Input
                                    type="number"
                                    step="0.01"
                                    disabled={readOnly}
                                    placeholder={app.amount.toFixed(2)}
                                    value={orv.amount ?? ""}
                                    onChange={e => {
                                       setValue("apportionmentOverrides", {
                                          ...apportionmentOverrides,
                                          [app.contract_id]: { ...orv, amount: e.target.value }
                                       }, { shouldDirty: true });
                                    }}
                                    className={`!h-10 border-stone-200 font-bold font-mono text-sm tracking-wider tabular-nums ${isOverridden ? 'bg-amber-50 text-amber-900 border-amber-300' : ''}`}
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
                  <h3 className="text-sm font-black text-stone-900 tracking-tight flex items-center gap-2">
                     <FileCheck size={16} /> Ledger Finalization
                  </h3>
                  <p className="text-xs font-medium text-stone-500">
                     Review the payload geometry. Executing this step generates immutable structural ledger items.
                  </p>
               </div>
               <div className="grid grid-cols-2 gap-4 text-left">
                  <div className="bg-stone-50 rounded-xl p-5 border border-stone-100">
                     <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Total Authorized</div>
                     <div className="text-2xl font-mono font-black text-stone-900 tabular-nums">₱{forecast.total_charge.toFixed(2)}</div>
                  </div>
                  <div className="bg-stone-50 rounded-xl p-5 border border-stone-100">
                     <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Contracts Billed</div>
                     <div className="text-2xl font-mono font-black text-stone-900 tabular-nums">{forecast.apportionments.length}</div>
                  </div>
               </div>
               <div className="flex items-center gap-3 rounded-2xl bg-teal-50/50 border border-teal-100 p-6 text-teal-800 mt-6">
                  <ShieldCheck size={20} className="text-teal-400 shrink-0" />
                  <p className="text-[10px] font-bold uppercase tracking-widest leading-relaxed">
                     Ledger integrity constraints apply. All subsequent reads will be strictly formatted and immutable post-execution.
                  </p>
               </div>
            </div>
          )}
        </div>
      </WizardFrame>
    </StandardPage>
  );
}
