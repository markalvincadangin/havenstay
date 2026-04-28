"use client";

import { X, ShieldAlert, ChevronRight, ShieldCheck, Fingerprint } from "lucide-react";
import Button from "@/components/ui/Button";
import ResourceIdCell from "@/components/ui/ResourceIdCell";
import { safeParseJson } from "@/lib/formatters";

/**
 * Audit Log Diff Modal — v7.3.0 Command Center Standard
 * Implements the 3-column forensic diff standard from MASTER.md §26.1
 */
export const AuditLogDiffModal = ({ audit, onClose }) => {
  if (!audit) return null;

  const oldVals = safeParseJson(audit.old_value) || {};
  const newVals = safeParseJson(audit.new_value) || {};

  // Detect Event-Only Mode (Logins/Logouts or no schema change)
  const isEventOnly = ["login", "logout", "access_denied"].includes(audit.action?.toLowerCase()) ||
    (Object.keys(oldVals).length === 0 && Object.keys(newVals).length === 0);

  // Combine all keys from old and new
  const allKeys = Array.from(new Set([...Object.keys(oldVals), ...Object.keys(newVals)])).sort();

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 sm:p-6 sm:pb-24">
      <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-md" onClick={onClose} aria-hidden />

      <div className="relative flex w-full max-w-4xl flex-col bg-white/90 backdrop-blur-xl shadow-2xl rounded-2xl border border-white/20 overflow-hidden animate-in fade-in zoom-in-95 duration-200 hs-glass-effect">
        {/* Header Section */}
        <div className="flex items-center justify-between border-b border-stone-200 bg-stone-50/80 px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-teal-50 text-teal-600 shadow-inner border border-teal-100/50">
              <ShieldAlert size={20} />
            </div>
            <div>
              <h3 className="hs-strip-title text-[10px] uppercase font-bold tracking-[0.2em] text-stone-900 leading-none">
                Activity Details
              </h3>
              <div className="mt-2 font-mono text-[10px] text-stone-500 font-bold uppercase tracking-widest flex items-center gap-2">
                <ResourceIdCell id={audit.id} type="audit" />
                <ChevronRight size={10} className="text-stone-300" />
                <span className="text-stone-900">{audit.target_table}</span>
                <span className="text-stone-300">/</span>
                <span className="text-stone-500 font-medium tracking-normal font-sans">TXN #{audit.record_id}</span>
              </div>
            </div>
          </div>
          <Button variant="ghost" onClick={onClose} className="!h-10 !w-10 !p-0 rounded-xl hover:bg-stone-100/80 transition-colors">
            <X size={20} className="text-stone-400" />
          </Button>
        </div>

        {/* Content Section */}
        <div className="flex-1 overflow-auto bg-white max-h-[65vh]">
          {isEventOnly ? (
            <div className="flex flex-col items-center justify-center py-20 px-8 text-center space-y-8">
              <div className="relative">
                <div className="absolute -inset-6 bg-teal-100/40 rounded-full blur-2xl animate-pulse" />
                <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-teal-50 text-teal-600 shadow-inner border border-teal-100">
                  <ShieldCheck size={48} strokeWidth={1.5} />
                </div>
              </div>
              <div className="max-w-md space-y-3">
                <h4 className="text-xl font-bold text-stone-900 uppercase tracking-tight">
                  No Data Changed
                </h4>
                <p className="text-sm text-stone-500 leading-relaxed font-medium">
                  This is a standard system event (like logging in or out). No records or settings were changed during this action.
                </p>
              </div>
              <div className="flex items-center gap-12 pt-6">
                <div className="flex flex-col items-center">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-stone-400 mb-2">Event Status</span>
                  <div className="px-4 py-1.5 bg-emerald-50 text-emerald-700 rounded-xl text-[10px] font-bold uppercase tracking-widest border border-emerald-100 shadow-sm">
                    Verified
                  </div>
                </div>
                <div className="w-px h-12 bg-stone-100" />
                <div className="flex flex-col items-center">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-stone-400 mb-2">Reference ID</span>
                  <div className="flex items-center gap-2.5">
                    <Fingerprint size={14} className="text-stone-300" />
                    <span className="font-mono text-[11px] font-bold text-stone-600 tracking-tight">
                      {audit.correlation_id || "SYS-AUTH-TRACE"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <table className="w-full text-left text-sm whitespace-nowrap border-collapse">
              <thead className="bg-stone-50/80 sticky top-0 z-10 backdrop-blur-md">
                <tr className="border-b border-stone-100">
                  <th className="px-8 py-4 font-bold text-stone-900 text-[10px] uppercase tracking-widest bg-stone-50/80">Attribute</th>
                  <th className="px-8 py-4 font-bold text-stone-900 text-[10px] uppercase tracking-widest bg-stone-50/80 w-[40%]">Prior State</th>
                  <th className="px-8 py-4 font-bold text-stone-900 text-[10px] uppercase tracking-widest bg-stone-50/80 w-[40%]">Target State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 font-mono text-[11px] font-bold tabular-nums">
                {allKeys.length === 0 && (
                  <tr><td colSpan="3" className="px-8 py-12 text-center text-stone-400 font-sans text-xs">No payload diff captured for this event.</td></tr>
                )}
                {allKeys.map(key => {
                  const oldV = oldVals[key];
                  const newV = newVals[key];
                  const oldStr = typeof oldV === 'object' ? JSON.stringify(oldV) : String(oldV);
                  const newStr = typeof newV === 'object' ? JSON.stringify(newV) : String(newV);
                  const isChanged = oldStr !== newStr;

                  return (
                    <tr key={key} className="hover:bg-stone-50 transition-colors group">
                      <td className="px-8 py-4 font-bold text-stone-900 border-r border-stone-50 group-hover:bg-stone-50/50">{key}</td>
                      <td className={`px-8 py-4 ${isChanged ? 'bg-rose-50/30' : ''}`}>
                        {oldV !== undefined ? (
                          <span className={isChanged ? 'text-rose-600 line-through decoration-rose-400/50' : 'text-stone-400'}>
                            {oldStr}
                          </span>
                        ) : (
                          <span className="text-stone-300 italic font-sans text-[10px] uppercase tracking-widest font-bold">Null</span>
                        )}
                      </td>
                      <td className={`px-8 py-4 ${isChanged ? 'bg-emerald-50/30' : ''}`}>
                        {newV !== undefined ? (
                          <span className={isChanged ? 'text-emerald-800 font-bold' : 'text-stone-400 font-medium'}>
                            {newStr}
                          </span>
                        ) : (
                          <span className="text-stone-300 italic font-sans text-[10px] uppercase tracking-widest font-bold">Null</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer Section */}
        <div className="border-t border-stone-200/60 bg-stone-50/80 px-8 py-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400">End of log record</span>
          </div>
          <Button variant="secondary" onClick={onClose} className="!h-10 px-8 border-stone-200 bg-white rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-sm active:scale-95 transition-transform">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};
