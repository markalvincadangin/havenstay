"use client";

import { useState } from "react";
import useSWR from "swr";
import { useParams, useRouter } from "next/navigation";
import { 
  Zap, 
  Droplet, 
  Plus, 
  ArrowLeft, 
  History, 
  CheckCircle2, 
  AlertTriangle,
  Activity,
  CalendarDays
} from "lucide-react";

import { apiRequest, fetcher } from "../../../../lib/api";
import { useAuth } from "../../../_context/AuthContext";
import StandardPage from "../../../_components/ui/StandardPage";
import { Card } from "../../../_components/ui/Card";
import Button from "../../../_components/ui/Button";
import Alert from "../../../_components/ui/Alert";
import { formatPHP, formatDateString } from "../../../../lib/formatters";
import { Table } from "../../../_components/ui/Table";
import Breadcrumbs from "../../../_components/ui/Breadcrumbs";
import SectionCard from "../../../_components/ui/SectionCard";
import ResourceIdCell from "../../../_components/ui/ResourceIdCell";
import PageHeaderActions from "../../../_components/ui/PageHeaderActions";

/**
 * FR-023a: Room Utility Metering Management Page
 * Handles sub-meter readings for Electric and Water.
 */
export default function RoomMetersPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params?.id;
  const { user: currentUser } = useAuth();

  const { data: room } = useSWR(currentUser && roomId ? `/api/rooms/${roomId}` : null, fetcher);
  const { data: readings, error, mutate } = useSWR(
    currentUser && roomId ? `/api/rooms/${roomId}/meters` : null,
    fetcher
  );

  const [activeTab, setActiveTab] = useState("electric");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState("");
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
    setActionError("");
    
    const val = parseFloat(formData.reading_value);
    if (isNaN(val) || val < latestReadingValue) {
        setActionError(`Validation failed: The new reading must be ≥ the last record (${latestReadingValue} on ${latestDateStr}).`);
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
      mutate();
    } catch (err) {
      setActionError(err.message || "Failed to record meter reading.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <StandardPage
      title={`Room ${room?.room_code || ''} Meters`}
      subtitle={
          <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                  <ResourceIdCell id={roomId} prefix="ROOM" />
                  <span className="text-stone-300">·</span>
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
        {actionError && (
          <Alert variant="error" title="Reading Validation Failed">
            {actionError}
          </Alert>
        )}

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

            <SectionCard 
              title="Validation Rule" 
              icon={Activity}
              iconClassName="bg-stone-900 text-stone-100"
              titleSize="xs"
            >
               <p className="text-xs font-medium text-stone-500 leading-relaxed">
                 Meter readings must be greater than or equal to the last recorded value of <strong className="text-stone-900">{latestReadingValue} {activeTab === 'electric' ? 'kWh' : 'm³'}</strong> to maintain billing accuracy. Lower entries will be rejected.
               </p>
            </SectionCard>
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
                    { key: "id", label: "RECORD ID", className: "pl-8" },
                    { key: "date", label: "READING DATE" },
                    { key: "value", label: "METER VALUE" },
                    { key: "consumption", label: "CONSUMPTION", className: "text-right" },
                    { key: "recorder", label: "STAFF NAME", className: "text-right px-8" },
                  ]}
                  rows={currentReadings.map((reading, idx) => {
                    const prevReading = currentReadings[idx + 1];
                    const deltaValue = prevReading ? (reading.reading_value - prevReading.reading_value) : null;
                    const deltaStr = deltaValue !== null ? deltaValue.toFixed(2) : '—';
                    
                    return (
                      <tr key={reading.reading_id} className="transition-colors hover:bg-stone-50/30 border-b border-stone-50 last:border-0 group">
                        <td className="px-8 py-5">
                            <div className="flex flex-col gap-1.5 items-start">
                              <ResourceIdCell id={reading.reading_id} prefix="RDG" />
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
                           <div className="flex items-center justify-end gap-2">
                             <span className="text-[10px] font-black uppercase tracking-widest text-stone-400 group-hover:text-stone-900 transition-colors">
                               {reading.recorder ? `${reading.recorder.first_name} ${reading.recorder.last_name}` : 'Unknown'}
                             </span>
                           </div>
                        </td>
                      </tr>
                    );
                  })}
                  emptyTitle="No Meter Logs"
                  emptyDescription={`No ${activeTab} readings have been recorded for this room yet.`}
                />
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Entry Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
          <div className="relative w-full max-w-sm bg-white rounded-3xl border border-stone-200 shadow-2xl overflow-hidden p-8">
            <div className="mb-6 flex items-start gap-4">
              <div className={`flex size-12 shrink-0 items-center justify-center rounded-2xl shadow-sm ${activeTab === 'electric' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>
                {activeTab === 'electric' ? <Zap size={24} strokeWidth={2.5} /> : <Droplet size={24} strokeWidth={2.5} />}
              </div>
              <div>
                <h2 className="text-xl font-black tracking-tight text-stone-900">Add {activeTab === 'electric' ? 'Electric' : 'Water'} Reading</h2>
                <p className="mt-1 text-sm text-stone-500">Manual entry for unit sub-meter.</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-100 mb-2">
                 <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Last Recorded</p>
                 <p className="text-sm font-black text-stone-900 font-mono tabular-nums tracking-tight">{latestReadingValue} {activeTab === 'electric' ? 'kWh' : 'm³'}</p>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Utility Category</label>
                <select 
                  required
                  className="w-full h-12 px-4 rounded-xl border border-stone-200 bg-stone-50/50 text-sm font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  value={activeTab}
                  onChange={(e) => setActiveTab(e.target.value)}
                >
                  <option value="electric">Electric (kWh)</option>
                  <option value="water">Water (m³)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Reading Date</label>
                <input 
                  type="date"
                  required
                  className="w-full h-12 px-4 rounded-xl border border-stone-200 bg-stone-50/50 text-sm font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  value={formData.reading_date}
                  onChange={(e) => setFormData({ ...formData, reading_date: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Reading Value</label>
                <input 
                  type="number"
                  step="0.0001"
                  required
                  autoFocus
                  placeholder={`≥ ${latestReadingValue}`}
                  className="w-full h-14 px-6 rounded-xl border border-stone-200 bg-white text-lg font-black text-stone-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  value={formData.reading_value}
                  onChange={(e) => setFormData({ ...formData, reading_value: e.target.value })}
                />
              </div>

              <div className="pt-4 flex flex-col gap-3">
                <Button 
                  type="submit" 
                  className="!h-14 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-teal-900/10"
                  loading={isSubmitting}
                >
                  Confirm Reading
                </Button>
                <Button 
                  type="button" 
                  variant="ghost" 
                  className="!h-12 rounded-xl text-[10px] font-bold uppercase tracking-widest text-stone-400"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </StandardPage>
  );
}
