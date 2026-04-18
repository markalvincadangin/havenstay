"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { 
  Zap, 
  Droplets, 
  AlertTriangle, 
  Search, 
  Activity, 
  ArrowRight,
  History,
  Plus,
  AlertCircle
} from "lucide-react";
import useSWR from "swr";

import { fetcher } from "../../../lib/api";
import { formatPHP, formatDateString } from "../../../lib/formatters";
import Alert from "../../_components/ui/Alert";
import Breadcrumbs from "../../_components/ui/Breadcrumbs";
import Button from "../../_components/ui/Button";
import { Card } from "../../_components/ui/Card";
import { Table } from "../../_components/ui/Table";
import { StatusBadge } from "../../_components/ui/StatusBadge";
import { KpiCard } from "../../_components/ui/KpiCard";
import StandardPage from "../../_components/ui/StandardPage";
import ResourceIdCell from "../../_components/ui/ResourceIdCell";
import { useAuth } from "../../_context/AuthContext";
import ResourceView from "../../_components/ui/ResourceView";
import PageHeaderActions from "../../_components/ui/PageHeaderActions";
import { interactiveTableRowClass } from "../../../lib/tableRows";
import { normalizePaginatedList } from "../../../lib/pagination";
import RowOpenIndicator from "../../_components/ui/RowOpenIndicator";
import { FormSection } from "../../_components/ui/FormSection";
import { Field, Input } from "../../_components/ui/Fields";
import FilterPanelCard from "../../_components/ui/FilterPanelCard";
import FilterChips from "../../_components/ui/FilterChips";
import { apiRequest } from "../../../lib/api";
import { usePaginatedFilters } from "../../../hooks/usePaginatedFilters";

export default function UtilityMeteringHubPage() {
  const router = useRouter();
  const { user: currentUser } = useAuth();

  const { filters, updateFilter, resetFilters, queryString } = usePaginatedFilters({
    initialFilters: { query: "", status: "all" },
    debounceKeys: ["query"],
    buildExtraParams: ({ filters: current, debounced }) => {
        const extra = {};
        if (debounced.query) extra.q = debounced.query;
        // The room API does not support 'status=all', so we only send if specific
        if (current.status !== "all") extra.status = current.status;
        return extra;
    }
  });

  const { data: meterSummary, error, isValidating, mutate } = useSWR(
    currentUser ? "/api/reports/meter-coverage" : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  );

  const { data: roomData, isValidating: roomsValidating } = useSWR(
    currentUser ? `/api/rooms${queryString}` : null,
    fetcher,
    { keepPreviousData: true }
  );

  const { rows: rooms, meta } = normalizePaginatedList(roomData);
  
  const roomsByStatus = useMemo(() => {
    if (filters.status === "all") return rooms;
    const currentMonth = new Date().toISOString().slice(0, 7);
    if (filters.status === "pending") {
      return rooms.filter(r => {
        const e = r.last_meter_readings?.electric?.date?.startsWith(currentMonth);
        const w = r.last_meter_readings?.water?.date?.startsWith(currentMonth);
        return !e || !w;
      });
    }
    if (filters.status === "recorded") {
        return rooms.filter(r => {
          const e = r.last_meter_readings?.electric?.date?.startsWith(currentMonth);
          const w = r.last_meter_readings?.water?.date?.startsWith(currentMonth);
          return e && w;
        });
    }
    return rooms;
  }, [rooms, filters.status]);
  
  const loading = !meterSummary && !error;
  const isRoomLoading = !roomData && !error;

  const [activeTab, setActiveTab] = useState("electric");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [targetUtility, setTargetUtility] = useState("electric");
  const [formData, setFormData] = useState({
    reading_date: new Date().toISOString().split('T')[0],
    reading_value: ""
  });

  const stats = useMemo(() => {
    return {
        electric_coverage: meterSummary?.electric_coverage ?? 0,
        water_coverage: meterSummary?.water_coverage ?? 0,
        high_delta_count: meterSummary?.high_delta_alerts ?? 0,
        electric_pending: meterSummary?.electric_pending_count ?? 0,
        water_pending: meterSummary?.water_pending_count ?? 0,
    };
  }, [meterSummary]);

  const handleOpenRecord = (room, type) => {
    setSelectedRoom(room);
    setTargetUtility(type);
    setFormData({
        reading_date: new Date().toISOString().split('T')[0],
        reading_value: ""
    });
    setActionError("");
    setShowAddModal(true);
  };

  const handleRecordSubmit = async (e) => {
    e.preventDefault();
    setActionError("");

    const prevReading = targetUtility === 'electric' 
        ? selectedRoom.last_meter_readings?.electric?.value ?? 0 
        : selectedRoom.last_meter_readings?.water?.value ?? 0;
    
    const val = parseFloat(formData.reading_value);
    if (isNaN(val) || val < prevReading) {
        setActionError(`Validation failed: The new reading must be ≥ the last record (${prevReading}).`);
        return;
    }

    setIsSubmitting(true);
    try {
        await apiRequest(`/api/rooms/${selectedRoom.room_id}/meters`, {
            method: "POST",
            body: JSON.stringify({
                ...formData,
                utility_type: targetUtility,
                reading_value: val
            })
        });
        setShowAddModal(false);
        mutate();
    } catch (err) {
        setActionError(err.message || "Failed to record meter reading.");
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <StandardPage
      title="Utility Metering"
      subtitle="SYSTEM ADMINISTRATION: UNIT CONSUMPTION TRACKING & FORENSIC BILLING INTEGRITY"
      breadcrumbs={<Breadcrumbs items={[{ label: "Administration" }, { label: "Utility Metering" }]} />}
      loading={loading}
      error={error}
      actions={
        <PageHeaderActions
          backHref="/admin/items"
          backLabel="ASSET REGISTRY"
          user={currentUser}
        />
      }
    >
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
            <KpiCard
                label="Electric Compliance"
                value={`${stats.electric_coverage}%`}
                sub={`${stats.electric_pending} PENDING READINGS`}
                icon={Zap}
                isWarning={stats.electric_pending > 0}
                isSuccess={stats.electric_pending === 0}
                isLoading={loading}
                isSyncing={isValidating}
            />
            <KpiCard
                label="Water Compliance"
                value={`${stats.water_coverage}%`}
                sub={`${stats.water_pending} PENDING READINGS`}
                icon={Droplets}
                isWarning={stats.water_pending > 0}
                isSuccess={stats.water_pending === 0}
                isLoading={loading}
                isSyncing={isValidating}
            />
            <KpiCard
                label="High-Risk Anomalies"
                value={stats.high_delta_count}
                sub="UNUSUAL CONSUMPTION DETECTED"
                icon={AlertTriangle}
                isDanger={stats.high_delta_count > 0}
                isLoading={loading}
                isSyncing={isValidating}
            />
        </div>

        <FilterPanelCard icon={Search}>
            <div className="flex items-end gap-6">
                <div className="flex-1">
                    <Field label="Locate Unit">
                        <div className="group relative">
                            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400 group-focus-within:text-teal-600 transition-colors" />
                            <Input 
                                placeholder="Locate unit (e.g. 101)..." 
                                value={filters.query}
                                onChange={(e) => updateFilter("query", e.target.value)}
                                className="!h-12 pl-10 border-stone-200 font-bold" 
                            />
                        </div>
                    </Field>
                </div>
                <div className="w-64">
                    <Field label="Compliance Filter">
                        <div className="group relative">
                            <Activity className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400 group-focus-within:text-teal-600 transition-colors z-10" />
                            <select 
                                value={filters.status}
                                onChange={(e) => updateFilter("status", e.target.value)}
                                className="w-full !h-12 pl-10 border-stone-200 font-bold rounded-xl appearance-none bg-white focus:border-teal-500/50 focus:ring-4 focus:ring-teal-500/5 transition-all text-sm" 
                            >
                                <option value="all">ALL UNITS</option>
                                <option value="pending">PENDING ONLY</option>
                                <option value="recorded">RECORDED ONLY</option>
                            </select>
                            <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-stone-300">
                                <ArrowRight size={14} className="rotate-90" />
                            </div>
                        </div>
                    </Field>
                </div>
            </div>
            {filters.query && (
                <FilterChips
                    className="mt-6"
                    items={[{ key: "q", label: "Unit", value: filters.query, onClear: () => updateFilter("query", "") }]}
                    onClearAll={resetFilters}
                />
            )}
        </FilterPanelCard>

        <div className="space-y-4">
            <div className="flex items-center justify-between px-4">
                <div className="flex items-center gap-3">
                    <div className="flex size-7 items-center justify-center rounded-lg bg-stone-100 text-stone-600">
                        <Activity size={14} />
                    </div>
                    <h2 className="hs-strip-title text-stone-400 tracking-[0.2em] uppercase font-black text-[10px]">Registry Consumption Grid</h2>
                </div>
                <div className="text-[9px] font-mono font-bold text-stone-400 uppercase tracking-widest border border-stone-200 rounded-lg px-2 py-0.5">
                    {rooms.length} UNITS FOUND
                </div>
            </div>

            <ResourceView
                isLoading={loading || isRoomLoading}
                isSyncing={isValidating || roomsValidating}
                error={error}
                isEmpty={rooms.length === 0}
                onRetry={() => mutate()}
                emptyProps={{
                    title: "No Matching Units",
                    message: "Ensure the room exists in the inventory registry."
                }}
            >
                <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                    {roomsByStatus.map((room) => {
                        const elec = room.last_meter_readings?.electric;
                        const water = room.last_meter_readings?.water;
                        
                        const currentMonth = new Date().toISOString().slice(0, 7);
                        const isElecCurrent = elec?.date?.startsWith(currentMonth);
                        const isWaterCurrent = water?.date?.startsWith(currentMonth);
                        
                        return (
                            <Card key={room.room_id} className="p-0 overflow-hidden border-stone-200 transition-all hover:border-teal-200 hover:shadow-md group">
                                <div className="p-6 border-b border-stone-50 bg-stone-50/30">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h3 className="text-base font-black text-stone-900 leading-none">Unit {room.room_code}</h3>
                                            <div className="mt-2">
                                                <ResourceIdCell id={room.room_id} prefix="ROOM" />
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => router.push(`/rooms/${room.room_id}/meters`)}
                                            className="size-10 flex items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-400 hover:text-teal-600 hover:border-teal-200 hover:bg-stone-50 transition-all shadow-sm active:scale-95"
                                            title="View History Log"
                                        >
                                            <History size={16} />
                                        </button>
                                    </div>
                                </div>
                                
                                <div className="p-6 space-y-6">
                                    {/* Electric Slot */}
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Zap size={14} className={isElecCurrent ? "text-amber-500" : "text-stone-300"} />
                                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400">Electricity</span>
                                            </div>
                                            <StatusBadge variant={isElecCurrent ? "success" : "warning"} size="xs">
                                                {isElecCurrent ? "RECORDED" : "OUTDATED"}
                                            </StatusBadge>
                                        </div>
                                        <div className="flex items-end justify-between gap-4">
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-2xl font-black text-stone-900 font-mono tabular-nums leading-none tracking-tighter">
                                                        {elec ? elec.value : "0.00"}
                                                        <span className="text-[10px] ml-1 text-stone-300 font-sans tracking-widest">kWh</span>
                                                    </span>
                                                    {!isElecCurrent && elec && (
                                                        <span className="flex h-5 items-center px-1.5 rounded bg-amber-50 text-[8px] font-black text-amber-600 border border-amber-100 uppercase tracking-tighter">PREV</span>
                                                    )}
                                                </div>
                                                <span className="text-[9px] font-bold text-stone-400 uppercase mt-1 italic">
                                                    {elec ? `${isElecCurrent ? "Recorded" : "Last recorded"} ${formatDateString(elec.date)}` : "No history registry"}
                                                </span>
                                            </div>
                                            <Button 
                                                variant="secondary" 
                                                size="sm" 
                                                onClick={() => handleOpenRecord(room, "electric")}
                                                className="!h-10 px-4 rounded-xl border-stone-200 text-[9px] font-black uppercase tracking-[0.15em] flex items-center justify-center shadow-sm active:scale-95 hover:bg-stone-50 transition-transform"
                                            >
                                                <Plus size={14} className="mr-1.5" /> Record
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="border-t border-stone-100" />

                                    {/* Water Slot */}
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Droplets size={14} className={isWaterCurrent ? "text-blue-500" : "text-stone-300"} />
                                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400">Water Supply</span>
                                            </div>
                                            <StatusBadge variant={isWaterCurrent ? "success" : "warning"} size="xs">
                                                {isWaterCurrent ? "RECORDED" : "OUTDATED"}
                                            </StatusBadge>
                                        </div>
                                        <div className="flex items-end justify-between gap-4">
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-2xl font-black text-stone-900 font-mono tabular-nums leading-none tracking-tighter">
                                                        {water ? water.value : "0.00"}
                                                        <span className="text-[10px] ml-1 text-stone-300 font-sans tracking-widest">m³</span>
                                                    </span>
                                                    {!isWaterCurrent && water && (
                                                        <span className="flex h-5 items-center px-1.5 rounded bg-blue-50 text-[8px] font-black text-blue-600 border border-blue-100 uppercase tracking-tighter">PREV</span>
                                                    )}
                                                </div>
                                                <span className="text-[9px] font-bold text-stone-400 uppercase mt-1 italic">
                                                    {water ? `${isWaterCurrent ? "Recorded" : "Last recorded"} ${formatDateString(water.date)}` : "No history registry"}
                                                </span>
                                            </div>
                                            <Button 
                                                variant="secondary" 
                                                size="sm" 
                                                onClick={() => handleOpenRecord(room, "water")}
                                                className="!h-10 px-4 rounded-xl border-stone-200 text-[9px] font-black uppercase tracking-[0.15em] flex items-center justify-center shadow-sm active:scale-95 hover:bg-stone-50 transition-transform"
                                            >
                                                <Plus size={14} className="mr-1.5" /> Record
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            </ResourceView>
        </div>

        {/* Record Reading Modal */}
        {showAddModal && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="relative w-full max-w-sm bg-white rounded-[2rem] border border-stone-200 shadow-2xl overflow-hidden"
                >
                    <div className="p-8">
                        <div className="mb-8 flex items-start gap-4">
                            <div className={`flex size-14 shrink-0 items-center justify-center rounded-2xl shadow-sm ${targetUtility === 'electric' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>
                                {targetUtility === 'electric' ? <Zap size={28} strokeWidth={2.5} /> : <Droplets size={28} strokeWidth={2.5} />}
                            </div>
                            <div>
                                <h2 className="text-xl font-black tracking-tight text-stone-900">Record {targetUtility === 'electric' ? 'Electric' : 'Water'}</h2>
                                <div className="mt-1 flex items-center gap-2">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">Unit {selectedRoom?.room_code}</span>
                                    <span className="size-1 rounded-full bg-stone-200" />
                                    <span className="text-[10px] font-mono font-bold text-stone-400">#ROOM-{selectedRoom?.room_id}</span>
                                </div>
                            </div>
                        </div>

                        {actionError && (
                            <Alert variant="error" className="mb-6">
                                {actionError}
                            </Alert>
                        )}

                        <form onSubmit={handleRecordSubmit} className="space-y-6">
                            <div className="p-5 rounded-2xl bg-stone-50 border border-stone-100 flex items-center justify-between">
                                <div>
                                    <p className="text-[9px] font-black uppercase tracking-widest text-stone-400 leading-none mb-1.5">Previous Reading</p>
                                    <p className="text-sm font-black text-stone-900 font-mono tabular-nums leading-none tracking-tight">
                                        {targetUtility === 'electric' 
                                            ? (selectedRoom?.last_meter_readings?.electric?.value ?? "0.00") 
                                            : (selectedRoom?.last_meter_readings?.water?.value ?? "0.00")}
                                        <span className="text-[9px] ml-1 text-stone-300 font-sans tracking-widest">{targetUtility === 'electric' ? 'kWh' : 'm³'}</span>
                                    </p>
                                </div>
                                <Activity size={18} className="text-stone-200" />
                            </div>

                            <Field label="Reading Date" required>
                                <Input 
                                    type="date"
                                    value={formData.reading_date}
                                    onChange={(e) => setFormData({ ...formData, reading_date: e.target.value })}
                                />
                            </Field>

                            <Field label="New Reading Value" helpText={`Must be ≥ previous reading.`} required>
                                <div className="relative">
                                    <Input 
                                        type="number"
                                        step="0.0001"
                                        autoFocus
                                        placeholder="0.0000"
                                        className="!h-14 pl-6 !text-lg !font-black font-mono"
                                        value={formData.reading_value}
                                        onChange={(e) => setFormData({ ...formData, reading_value: e.target.value })}
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase tracking-widest text-stone-300">
                                        {targetUtility === 'electric' ? 'kWh' : 'm³'}
                                    </span>
                                </div>
                            </Field>

                            <div className="pt-4 flex flex-col gap-3">
                                <Button 
                                    type="submit" 
                                    className="!h-14 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-teal-900/10"
                                    loading={isSubmitting}
                                >
                                    Confirm Registration
                                </Button>
                                <Button 
                                    type="button" 
                                    variant="ghost" 
                                    onClick={() => setShowAddModal(false)}
                                    className="!h-12 text-[10px] font-bold uppercase tracking-widest text-stone-400"
                                >
                                    Cancel
                                </Button>
                            </div>
                        </form>
                    </div>
                </motion.div>
            </div>
        )}
      </div>
    </StandardPage>
  );
}
