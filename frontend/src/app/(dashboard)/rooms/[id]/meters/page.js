"use client";
import { useState } from "react";
import useSWR from "swr";
import { useParams, useRouter } from "next/navigation";
import { 
  Zap, 
  Droplet, 
  Plus, 
  _ArrowLeft, 
  History, 
  _CheckCircle2, 
  AlertTriangle,
  Activity,
  _CalendarDays
} from "lucide-react";
import { apiRequest, fetcher } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useToasts } from "@/context/ToastContext";
import StandardPage from "@/components/ui/StandardPage";
import { Card } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";
import {  formatDateString } from "@/lib/formatters";
import { Table } from "@/components/ui/Table";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import { FormSection } from "@/components/ui/FormSection";
import ResourceIdCell from "@/components/ui/ResourceIdCell";
import PageHeaderActions from "@/components/ui/PageHeaderActions";
import { SideSheetOverlay } from "@/components/ui/SideSheetOverlay";
import { Field, Input, Select } from "@/components/ui/Fields";
/**
 * FR-023a: Room Utility Metering Management Page
 * Handles sub-meter readings for Electric and Water.
 */
export default function RoomMetersPage() {
  const params = useParams();
  const _router = useRouter();
  const roomId = params?.id;
  const { user: currentUser } = useAuth();
  const { showToast } = useToasts();
  const { data: room } = useSWR(currentUser && roomId ? `/api/rooms/${roomId}` : null, fetcher);
  const { data: readings, error, mutate } = useSWR(
    currentUser && roomId ? `/api/rooms/${roomId}/meters` : null,
    fetcher
  );
  const [activeTab, setActiveTab] = useState("electric");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  // Form State
  const [formData, setFormData] = useState({
    reading_date: new Date().toISOString().split('T')[0],
    reading_value: ""
  });
  const electricReadings = readings?.filter(r => r.utility_type === 'electric') || [];
  const waterReadings = readings?.filter(r => r.utility_type === 'water') || [];
  const currentReadings = activeTab === 'electric' ? electricReadings : waterReadings;
  const latestR = currentReadings[0];
  const latestReadingValue = latestR?.reading_value ? Number(latestR.reading_value).toString() : "0";
  const latestDateStr = latestR ? formatDateString(latestR.reading_date) : "N/A";
  const handleSubmit = async (e) => {
    e.preventDefault();
    const val = parseFloat(formData.reading_value);
    if (isNaN(val) || val < latestReadingValue) {
        showToast(`Validation failed: The new reading must be ≥ the last record (${latestReadingValue} on ${latestDateStr}).`, "error");
        return;
    }
    setIsSubmitting(true);
    try {
      await apiRequest(`/api/rooms/${roomId}/meters`, {
        method: "POST",
        body: JSON.stringify({
          ...formData,
          utility_type: activeTab,
          reading_value: val
        })
      });
      setShowAddModal(false);
      setFormData({ reading_date: new Date().toISOString().split('T')[0], reading_value: "" });
      showToast("Reading recorded successfully.", "success");
      mutate();
    } catch (err) {
      showToast(err.message || "Failed to record meter reading.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };
  return (
    <StandardPage
      title={
        <div className="flex items-center gap-4">
          <span>Room {room?.room_code || ''} Meters</span>
          <ResourceIdCell id={roomId} type="room" />
        </div>
      }
      subtitle={
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono font-bold text-stone-500 uppercase tracking-widest leading-none">
              Last Reading: {latestReadingValue} {activeTab === 'electric' ? 'kWh' : 'm³'}
            </span>
          </div>
          <p className="hs-page-subtitle text-sm font-medium leading-relaxed text-stone-500">
            Track chronological utility consumption and forensic meter history.
          </p>
        </div>
      }
      loading={!room && !error}
      error={error}
      breadcrumbs={
        <Breadcrumbs 
          items={[
            { label: "Room Inventory", href: "/rooms" }, 
            { label: `Room Profile`, href: `/rooms/${roomId}` },
            { label: "Utility Metering" }
          ]} 
        />
      }
      actions={
        <PageHeaderActions
          backHref={`/rooms/${roomId}`}
          backLabel="Back to Room Profile"
          user={currentUser}
        />
      }
    >
      <div className="space-y-8">
        <div className="grid gap-8 lg:grid-cols-12">
          {/* Quick Stats & Entry Trigger */}
          <aside className="lg:col-span-4 space-y-6">
            <Card className="p-8 border-stone-200 shadow-sm relative overflow-hidden bg-stone-50/20">
               <div className="absolute top-0 right-0 p-4 opacity-[0.03] pointer-events-none">
                 {activeTab === 'electric' ? <Zap size={140} /> : <Droplet size={140} />}
               </div>
               <div className="relative z-10 flex gap-2 mb-8 p-1 bg-stone-100/50 rounded-2xl border border-stone-100">
                  <button 
                    onClick={() => setActiveTab('electric')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'electric' ? 'bg-white shadow-sm border border-stone-200 text-teal-600' : 'text-stone-400'}`}
                  >
                    <Zap size={14} /> Electric
                  </button>
                  <button 
                    onClick={() => setActiveTab('water')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'water' ? 'bg-white shadow-sm border border-stone-200 text-teal-600' : 'text-stone-400'}`}
                  >
                    <Droplet size={14} /> Water
                  </button>
               </div>
               <div className="space-y-2 mb-8 text-center relative z-10">
                  <p className="hs-strip-title uppercase tracking-[0.2em] text-[10px] font-black text-stone-400 leading-none">Last Recorded</p>
                  <p className="text-5xl font-black text-stone-900 tabular-nums tracking-tighter">
                    {latestReadingValue}
                    <span className="text-[10px] font-black text-stone-300 ml-2 uppercase tracking-widest">
                      {activeTab === 'electric' ? 'kWh' : 'm³'}
                    </span>
                  </p>
               </div>
               <Button 
                 fullWidth 
                 className="!h-14 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-teal-500/20 bg-teal-600 hover:bg-teal-700 border-0"
                 onClick={() => setShowAddModal(true)}
               >
                 <Plus size={18} strokeWidth={3} className="mr-2" />
                 Record Reading
               </Button>
            </Card>
            <FormSection 
              title="Validation Rule" 
              icon={Activity}
              bodyClassName="p-8"
            >
               <p className="text-xs font-medium text-stone-500 leading-relaxed">
                 Meter readings must be greater than or equal to the last recorded value of <strong className="text-stone-900">{latestReadingValue} {activeTab === 'electric' ? 'kWh' : 'm³'}</strong> to maintain billing accuracy. Lower entries will be rejected.
               </p>
            </FormSection>
          </aside>
          {/* History Log */}
          <div className="lg:col-span-8 space-y-6">
            <Card className="!p-0 overflow-hidden border-stone-200 shadow-sm rounded-2xl">
              <div className="flex justify-between items-center border-b border-stone-100 bg-stone-50/50 px-8 py-5">
                <div className="flex items-center gap-2">
                    <History size={14} className="text-stone-400" />
                    <h2 className="hs-strip-title text-stone-400 tracking-widest uppercase font-black text-xs">Consumption History</h2>
                </div>
                <span className="text-[10px] font-mono font-bold text-stone-400 uppercase tracking-widest">
                  {currentReadings.length} {currentReadings.length === 1 ? 'ENTRY' : 'ENTRIES'}
                </span>
              </div>
              <div className="p-0">
                <Table
                  embedded
                  columns={[
                    { key: "id", label: "METER ID", className: "pl-8" },
                    { key: "date", label: "READING DATE" },
                    { key: "value", label: `Reading (${activeTab === 'electric' ? 'kWh' : 'm³'})` },
                    { key: "consumption", label: "CONSUMPTION", className: "text-right" },
                    { key: "billing", label: "LINKED BILLING", className: "text-right" },
                    { key: "recorder", label: "RECORDED BY", className: "text-right px-8" },
                  ]}
                  rows={currentReadings.map((reading, idx) => {
                    const prevReading = currentReadings[idx + 1];
                    const deltaValue = prevReading ? (reading.reading_value - prevReading.reading_value) : null;
                    const deltaStr = deltaValue !== null ? deltaValue.toFixed(2) : '—';
                    return (
                      <tr key={reading.reading_id} className="transition-colors hover:bg-stone-50/30 border-b border-stone-50 last:border-0 group">
                        <td className="px-8 py-5">
                            <div className="flex flex-col gap-1.5 items-start">
                              <ResourceIdCell id={reading.reading_id} type="reading" />
                              {reading.correlation_id && (
                                <div className="font-mono text-[8px] font-black text-stone-300 bg-stone-50 border border-stone-100 rounded px-1.5 py-0.5 tracking-widest leading-none block" title={`Forensic Reference: TX-${reading.correlation_id.slice(0,8).toUpperCase()}`}>
                                  #TX-{reading.correlation_id.slice(0,5).toUpperCase()}
                                </div>
                              )}
                            </div>
                        </td>
                        <td className="py-5">
                            <span className="text-xs font-bold text-stone-600 uppercase tracking-tight">{formatDateString(reading.reading_date)}</span>
                        </td>
                        <td className="py-5">
                           <span className="text-sm font-black text-stone-900 font-mono tabular-nums tracking-tight">
                             {reading.reading_value}
                             <span className="text-[10px] font-bold text-stone-300 ml-1 uppercase font-sans tracking-widest">{activeTab === 'electric' ? 'kWh' : 'm³'}</span>
                           </span>
                        </td>
                        <td className="py-5 text-right">
                           <span className={`font-mono text-xs font-black tabular-nums ${Number(deltaStr) > 0 ? 'text-teal-600' : 'text-stone-300'}`}>
                             {Number(deltaStr) > 0 ? `+${deltaStr}` : deltaStr}
                           </span>
                        </td>
                        <td className="px-8 py-5 text-right">
                           <div className="flex flex-col items-end gap-1">
                             {reading.billing ? (
                               <>
                                 <span className="text-[10px] font-bold text-teal-600 uppercase tracking-tight">#{reading.billing.billing_id}</span>
                                 <span className="text-[8px] font-medium text-stone-400 tabular-nums uppercase">{reading.billing.period}</span>
                               </>
                             ) : (
                               <span className="text-[10px] font-bold text-stone-300 uppercase tracking-widest italic">Pending</span>
                             )}
                           </div>
                        </td>
                        <td className="px-8 py-5 text-right">
                           <div className="flex items-center justify-end gap-2">
                             <span className="text-[10px] font-black uppercase tracking-widest text-stone-400 group-hover:text-stone-900 transition-colors">
                               {reading.recorder ? `${reading.recorder.first_name} ${reading.recorder.last_name}` : 'Unknown'}
                             </span>
                           </div>
                        </td>
                      </tr>
                    );
                  })}
                  emptyTitle="No Meter Readings"
                  emptyDescription={`No ${activeTab} readings have been recorded for this room yet.`}
                />
              </div>
            </Card>
          </div>
        </div>
      </div>
      <SideSheetOverlay
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title={`Record ${activeTab === 'electric' ? 'Electric' : 'Water'} Reading`}
      >
        <div className="space-y-6">
          <div className="flex items-start gap-4 p-6 bg-stone-50 rounded-2xl border border-stone-100">
            <div className={`flex size-12 shrink-0 items-center justify-center rounded-2xl shadow-sm ${activeTab === 'electric' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>
              {activeTab === 'electric' ? <Zap size={24} strokeWidth={2.5} /> : <Droplet size={24} strokeWidth={2.5} />}
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Last Recorded</p>
              <p className="text-xl font-black text-stone-900 font-mono tabular-nums tracking-tight">
                {latestReadingValue} <span className="text-xs font-bold text-stone-400">{activeTab === 'electric' ? 'kWh' : 'm³'}</span>
              </p>
            </div>
          </div>
          <form onSubmit={handleSubmit} className="space-y-5">
            <Field label="Utility Category" required>
              <Select
                value={activeTab}
                onChange={(e) => setActiveTab(e.target.value)}
                className="font-bold"
              >
                <option value="electric">Electric (kWh)</option>
                <option value="water">Water (m³)</option>
              </Select>
            </Field>
            <Field label="Reading Date" required>
              <Input
                type="date"
                value={formData.reading_date}
                onChange={(e) => setFormData({ ...formData, reading_date: e.target.value })}
                className="font-bold"
              />
            </Field>
            <Field label="Reading Value" required>
              <div className="relative">
                <Input
                  type="number"
                  step="0.0001"
                  autoFocus
                  placeholder={`≥ ${latestReadingValue}`}
                  value={formData.reading_value}
                  onChange={(e) => setFormData({ ...formData, reading_value: e.target.value })}
                  className="!h-16 px-8 text-xl font-black tabular-nums border-stone-200 focus:border-teal-500"
                />
                <div className="absolute right-6 top-1/2 -translate-y-1/2 text-xs font-black uppercase tracking-widest text-stone-300 pointer-events-none">
                  {activeTab === 'electric' ? 'kWh' : 'm³'}
                </div>
              </div>
            </Field>
            <div className="pt-4 flex flex-col gap-3">
              <Button
                type="submit"
                fullWidth
                className="!h-14 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-teal-600 shadow-xl shadow-teal-900/10"
                loading={isSubmitting}
              >
                Confirm Reading
              </Button>
              <Button
                type="button"
                variant="ghost"
                fullWidth
                className="!h-12 text-[10px] font-bold uppercase tracking-widest text-stone-400"
                onClick={() => setShowAddModal(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
          <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-100 flex gap-3">
            <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[10px] font-medium text-amber-800 leading-relaxed uppercase">
              Meter readings must be greater than or equal to the last record to maintain forensic billing integrity.
            </p>
          </div>
        </div>
      </SideSheetOverlay>
    </StandardPage>
  );
}
