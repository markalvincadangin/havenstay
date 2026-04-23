"use client";
import React, { useEffect,  } from "react";
import { motion,  } from "framer-motion";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
const TOAST_VARIANTS = {
  success: {
    icon: CheckCircle2,
    className: "bg-emerald-50 border-emerald-100 text-emerald-800",
    iconClassName: "text-emerald-500",
  },
  error: {
    icon: AlertCircle,
    className: "bg-rose-50 border-rose-100 text-rose-800",
    iconClassName: "text-rose-500",
  },
  info: {
    icon: Info,
    className: "bg-teal-50 border-teal-100 text-teal-800",
    iconClassName: "text-teal-500",
  },
};
export default function Toast({ message, type = "success", onClose, duration = 4000 }) {
  const variant = TOAST_VARIANTS[type] || TOAST_VARIANTS.info;
  const Icon = variant.icon;
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
      className={`flex items-center gap-3 rounded-2xl border p-4 shadow-xl shadow-stone-900/5 ${variant.className} min-w-[320px] pointer-events-auto`}
    >
      <div className={`flex shrink-0 h-8 w-8 items-center justify-center rounded-lg bg-white/60 ${variant.iconClassName}`}>
        <Icon size={18} strokeWidth={2.5} />
      </div>
      <p className="flex-1 text-[11px] font-bold uppercase tracking-widest">{message}</p>
      <button
        onClick={onClose}
        className="ml-2 rounded-lg p-1 transition-colors hover:bg-black/5 text-stone-400 hover:text-stone-600"
      >
        <X size={14} />
      </button>
    </motion.div>
  );
}
