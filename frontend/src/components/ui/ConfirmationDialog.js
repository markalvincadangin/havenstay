"use client";
import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle,  } from "lucide-react";
import Button from "./Button";
/**
 * ConfirmationDialog — Premium replacement for window.confirm.
 * 
 * @param {boolean} open
 * @param {string} title
 * @param {string} description
 * @param {string} confirmLabel
 * @param {string} cancelLabel
 * @param {function} onConfirm
 * @param {function} onCancel
 * @param {boolean} isLoading
 * @param {boolean} isDanger
 */
export default function ConfirmationDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  isLoading = false,
  isDanger = false,
  children,
}) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && !isLoading) onCancel();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, isLoading, onCancel]);
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm cursor-default"
            onClick={onCancel}
            disabled={isLoading}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative w-full max-w-[440px] rounded-3xl border border-stone-200 bg-white p-8 shadow-2xl shadow-stone-950/20"
          >
            <div className="flex items-start gap-4">
              <div className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${isDanger ? 'bg-red-50 text-red-600' : 'bg-teal-50 text-teal-600'}`}>
                <AlertTriangle size={24} strokeWidth={2.5} />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-black tracking-tight text-stone-900 leading-none mb-2">
                  {title}
                </h3>
                <p className="text-sm font-medium leading-relaxed text-stone-500">
                  {description}
                </p>
                {children && <div className="mt-6">{children}</div>}
              </div>
            </div>
            <div className="mt-8 flex items-center justify-end gap-3">
              <Button
                variant="outline"
                className="rounded-xl px-6 !h-11 text-[10px] font-black uppercase tracking-widest border-stone-200 text-stone-500 hover:bg-stone-50"
                onClick={onCancel}
                disabled={isLoading}
              >
                {cancelLabel}
              </Button>
              <Button
                variant={isDanger ? "danger" : "primary"}
                className="rounded-xl px-8 !h-11 text-[10px] font-black uppercase tracking-widest shadow-lg"
                onClick={onConfirm}
                isLoading={isLoading}
              >
                {confirmLabel}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
