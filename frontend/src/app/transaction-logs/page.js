"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Activity, Search, X, CheckCircle2, XCircle, Clock, ClipboardList, RefreshCw } from "lucide-react";
import { apiRequest } from "../../lib/api";
import { canManageUsers } from "../../lib/auth";
import { flattenApiErrors } from "../../lib/errors";
import { useAuthGuard } from "../../hooks/useAuthGuard";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import Alert from "../_components/ui/Alert";
import { AppMain } from "../_components/ui/AppShell";
import Breadcrumbs from "../_components/ui/Breadcrumbs";
import Button from "../_components/ui/Button";
import { Card } from "../_components/ui/Card";
import { Field, Input, Select } from "../_components/ui/Fields";
import FilterChips from "../_components/ui/FilterChips";
import PageHeader from "../_components/ui/PageHeader";
import { SkeletonListPage } from "../_components/ui/Skeleton";
import UserRoleBadge from "../_components/ui/UserRoleBadge";
import { Table } from "../_components/ui/Table";

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.2, ease: "easeOut" },
};

function formatStatus(status) {
  switch (status) {
    case "committed": return { label: "Committed", color: "text-emerald-700 bg-emerald-50 border-emerald-100", Icon: CheckCircle2 };
    case "failed": return { label: "Failed", color: "text-rose-700 bg-rose-50 border-rose-100", Icon: XCircle };
    case "rolled_back": return { label: "Rolled Back", color: "text-amber-700 bg-amber-50 border-amber-100", Icon: XCircle };
    default: return { label: "In Progress", color: "text-stone-700 bg-stone-50 border-stone-100", Icon: Clock };
  }
}

function formatTxName(name) {
  if (!name) return "—";
  // Remove technical prefixes like 'sp_' or 'trg_' if any
  const clean = name.replace(/^(sp_|trg_)/, "");
  return clean.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const ENTITY_LABELS = {
  tenants: "Tenant Registry",
  rooms: "Room Management",
  contracts: "Contract History",
  billing: "Financial Billing",
  payments: "Payment Records",
  users: "User Access",
};

function formatEntity(entity) {
  return ENTITY_LABELS[entity] || entity?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "—";
}

function formatDuration(start, end) {
  if (!start || !end) return null;
  const s = new Date(start);
  const e = new Date(end);
  const diff = e.getTime() - s.getTime();
  if (diff < 0) return null;
  if (diff < 1000) return `${diff}ms`;
  return `${(diff / 1000).toFixed(2)}s`;
}

function formatTimestamp(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-PH", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

export default function TransactionLogsPage() {
  const { user: currentUser, authLoading } = useAuthGuard();
  const shouldReduceMotion = useReducedMotion();

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterQuery, setFilterQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isMounted, setIsMounted] = useState(false);

  const [selectedLog, setSelectedLog] = useState(null);
  const modalRef = useFocusTrap(!!selectedLog);

  const canAccess = useMemo(() => canManageUsers(currentUser), [currentUser]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest("/api/transaction-logs");
      setLogs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load transaction logs:", flattenApiErrors(err));
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && currentUser && canAccess && isMounted) {
      loadLogs();
    }
  }, [authLoading, currentUser, canAccess, loadLogs, isMounted]);

  const filteredLogs = useMemo(() => {
    let result = logs;
    
    if (statusFilter !== "all") {
      result = result.filter(l => l.status === statusFilter);
    }

    if (filterQuery) {
      const q = filterQuery.toLowerCase();
      result = result.filter(l => 
        (l.tx_name || "").toLowerCase().includes(q) || 
        (l.user_username || "").toLowerCase().includes(q) ||
        (l.reference_id || "").toLowerCase().includes(q) ||
        (l.reference_entity || "").toLowerCase().includes(q)
      );
    }
    
    return result;
  }, [logs, filterQuery, statusFilter]);

  const showSkeleton = authLoading || (currentUser && canAccess && loading && !logs.length);

  if (showSkeleton) {
    return <SkeletonListPage rows={10} />;
  }

  return (
    <AppMain>
      <motion.div
        className="space-y-6"
        initial={shouldReduceMotion ? false : pageVariants.initial}
        animate={shouldReduceMotion ? false : pageVariants.animate}
        transition={shouldReduceMotion ? { duration: 0 } : pageVariants.transition}
      >
        <PageHeader
          title="Transaction Logs"
          subtitle="Real-time monitoring of atomic business processes and state transitions."
          breadcrumbs={<Breadcrumbs items={[{ label: "Monitoring", href: "/transaction-logs" }, { label: "Process History" }]} />}
          actions={<UserRoleBadge username={currentUser?.username} roleName={currentUser?.role?.role_name} />}
        />

        {!canAccess ? (
          <Alert variant="warning" title="Restricted access" data-testid="access-denied-transaction-logs">
            You do not have permission to view this page. Only administrators can view system transaction logs.
          </Alert>
        ) : (
          <>
            <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
               <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 bg-stone-50/50 px-6 py-4 sm:px-8 sm:py-5">
                 <div className="flex items-center gap-2.5">
                   <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                     <ClipboardList size={16} aria-hidden />
                   </div>
                   <h2 className="hs-strip-title">Registry Filters</h2>
                 </div>
                <div className="flex items-center gap-4">
                    <Button 
                      variant="outline" 
                      onClick={loadLogs} 
                      disabled={loading}
                      className="!h-9 text-[10px] font-black uppercase tracking-widest px-4 border-stone-200"
                    >
                      {loading ? <RefreshCw className="w-3 h-3 mr-2 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-2" />}
                      Refresh History
                    </Button>
                </div>
              </div>
              <div className="p-6 sm:p-8">
                <div className="grid gap-6 lg:grid-cols-12">
                   <div className="lg:col-span-8">
                      <Field label="Search Processes">
                         <Input 
                           icon={Search}
                           placeholder="Filter by process, user, or reference ID..."
                           value={filterQuery}
                           onChange={(e) => setFilterQuery(e.target.value)}
                           className="!h-12 border-stone-200 transition-[border-color,box-shadow] focus:ring-4 focus:ring-teal-500/5"
                         />
                      </Field>
                   </div>
                   <div className="lg:col-span-4">
                     <Field label="Status">
                        <Select 
                          value={statusFilter} 
                          onChange={(e) => setStatusFilter(e.target.value)}
                          className="!h-12 border-stone-200"
                        >
                          <option value="all">All Statuses</option>
                          <option value="started">In Progress</option>
                          <option value="committed">Committed</option>
                          <option value="failed">Failed</option>
                          <option value="rolled_back">Rolled Back</option>
                        </Select>
                     </Field>
                   </div>
                </div>
              </div>
            </Card>

            <FilterChips 
              items={[
                { key: "q", label: "Search", value: filterQuery, onClear: () => setFilterQuery("") },
                { key: "status", label: "Status", value: statusFilter !== "all" ? statusFilter : "", onClear: () => setStatusFilter("all") }
              ]}
              onClearAll={() => {
                setFilterQuery("");
                setStatusFilter("all");
              }}
            />

        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-stone-400">
          <Activity className="h-3 w-3 shrink-0 text-stone-300" aria-hidden />
          <span>{filteredLogs.length} process entries monitored</span>
        </div>

        <Table
          columns={[
            { key: "started", label: "Started" },
            { key: "process", label: "Business Process" },
            { key: "user", label: "Initiated By" },
            { key: "ref", label: "Reference" },
            { key: "status", label: "Status" },
          ]}
          rows={filteredLogs.map((log) => {
            const statusInfo = formatStatus(log.status);
            const StatusIcon = statusInfo.Icon;
            
            return (
              <tr 
                key={log.tx_log_id} 
                className="group cursor-pointer border-t border-stone-100 transition-colors hover:bg-stone-50 active:bg-stone-100"
                onClick={() => setSelectedLog(log)}
              >
                    <td className="px-6 py-4 text-xs tabular-nums text-stone-500 whitespace-nowrap">
                      {isMounted ? formatTimestamp(log.started_at) : "—"}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Activity size={14} className="text-teal-500" />
                        <span className="text-sm font-semibold text-stone-900">{formatTxName(log.tx_name)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-stone-600">
                      {log.user_username || "System"}
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-stone-400">
                      <span className="font-sans font-bold text-stone-500 mr-1">{formatEntity(log.reference_entity)}</span>
                      <span className="text-stone-300">#</span>{log.reference_id}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-tight border ${statusInfo.color}`}>
                        <StatusIcon size={12} strokeWidth={2.5} />
                        {statusInfo.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
              emptyTitle="No transaction logs found"
              emptyDescription={filterQuery || statusFilter !== 'all' ? "Try adjusting your filters or search terms." : "Processes will appear here once business transactions are initiated."}
            />
          </>
        )}
      </motion.div>

      {selectedLog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <motion.div 
            ref={modalRef}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="HS-card-shadow bg-white rounded-3xl w-full max-w-2xl overflow-hidden border border-stone-200"
          >
            <div className="px-8 py-6 border-b border-stone-100 flex items-start justify-between bg-stone-50/50">
              <div>
                <h3 className="text-sm font-black text-stone-900 uppercase tracking-widest">Process Inspector</h3>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider tabular-nums">Log ID: TX-{selectedLog.tx_log_id} · {isMounted ? formatTimestamp(selectedLog.started_at) : "—"}</p>
                  {selectedLog.completed_at && (
                    <span className="inline-flex h-1 w-1 rounded-full bg-stone-300" />
                  )}
                  {selectedLog.completed_at && (
                    <p className="text-[10px] font-bold text-teal-600 uppercase tracking-widest">Duration: {formatDuration(selectedLog.started_at, selectedLog.completed_at)}</p>
                  )}
                </div>
              </div>
              <button 
                onClick={() => setSelectedLog(null)} 
                className="p-2.5 hover:bg-stone-200 rounded-xl transition-all duration-200 group"
                aria-label="Close details"
              >
                <X size={20} className="text-stone-400 group-hover:text-stone-900" />
              </button>
            </div>
            
            <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto HS-scrollbar">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <p className="text-[10px] font-bold tracking-widest text-stone-400 mb-2 uppercase">Business Process</p>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-teal-50 rounded-xl flex items-center justify-center text-teal-600">
                         <Activity size={20} />
                      </div>
                      <p className="text-xl font-black text-slate-900 leading-tight">{formatTxName(selectedLog.tx_name)}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold tracking-widest text-stone-400 mb-2 uppercase">Execution Status</p>
                    {(() => {
                      const s = formatStatus(selectedLog.status);
                      const StatusIcon = s.Icon;
                      return (
                        <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border ${s.color}`}>
                          <StatusIcon size={14} strokeWidth={3} />
                          {s.label}
                        </span>
                      );
                    })()}
                  </div>
               </div>

               <div className="space-y-4">
                  <p className="text-[10px] font-bold tracking-widest text-stone-400 uppercase">Contextual Meta</p>
                  <div className="rounded-2xl border border-stone-100 bg-stone-50/50 p-6 space-y-4">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-stone-500 font-bold uppercase text-[10px] tracking-wider">Started At</span>
                      <span className="text-stone-900 font-mono font-bold bg-white px-2 py-1 rounded border border-stone-100">{isMounted ? formatTimestamp(selectedLog.started_at) : "—"}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-stone-500 font-bold uppercase text-[10px] tracking-wider">Completed At</span>
                      <span className="text-stone-900 font-mono font-bold bg-white px-2 py-1 rounded border border-stone-100">{isMounted ? formatTimestamp(selectedLog.completed_at) : "—"}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-stone-500 font-bold uppercase text-[10px] tracking-wider">Reference Entity</span>
                      <span className="text-teal-700 font-black px-2 py-1 bg-teal-50 rounded border border-teal-100 uppercase text-[9px] tracking-widest">{formatEntity(selectedLog.reference_entity)} #{selectedLog.reference_id}</span>
                    </div>
                  </div>
               </div>

               <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold tracking-widest text-stone-400 uppercase">Input / Output State</p>
                    <span className="text-[10px] font-bold text-stone-300">application/json</span>
                  </div>
                  <div className="relative group">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl blur opacity-20 group-hover:opacity-30 transition duration-1000"></div>
                    <pre className="relative p-6 bg-slate-900 rounded-2xl font-mono text-[11px] leading-relaxed text-emerald-400 overflow-x-auto border border-white/5 HS-scrollbar">
                      {selectedLog.details_json ? JSON.stringify(JSON.parse(selectedLog.details_json), null, 2) : "// No state data recorded for this phase"}
                    </pre>
                  </div>
               </div>
            </div>

            <div className="px-8 py-6 bg-stone-50/50 border-t border-stone-100 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setSelectedLog(null)} className="rounded-xl !h-11 px-6 font-black text-[10px] uppercase tracking-widest">
                Close Inspector
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AppMain>
  );
}
