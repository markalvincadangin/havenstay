"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Keyboard, X } from "lucide-react";
import { Card } from "./Card";

/**
 * KeyboardHelpModal - Centralized system shortcuts documentation overlay.
 * Modal backdrop — slate-style overlay; see design-system/havenstay/MASTER.md Section 2 (chrome) / Section 5.15.
 *
 * @param {boolean} isOpen - Whether the modal is visible.
 * @param {Function} onClose - Callback to close the modal.
 */
export default function KeyboardHelpModal({ isOpen, onClose }) {
  const shortcuts = [
    { key: "?", label: "Toggle help overlay" },
    { key: "G + D", label: "Go to Operations" },
    { key: "G + T", label: "Go to Tenants" },
    { key: "G + R", label: "Go to Rooms" },
    { key: "G + C", label: "Go to Contracts" },
    { key: "G + B", label: "Go to Billing" },
    { key: "G + P", label: "Go to Payments" },
    { key: "G + O", label: "Go to Reports" },
    { key: "G + L", label: "Go to Audit Logs" },
    { key: "G + U", label: "Go to Users" },
    { key: "Ctrl + P", label: "Open New Payment Form" },
    { key: "Ctrl + R", label: "Refresh Page" },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop — slate overlay per MASTER.md (modal pattern) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            className="relative w-full max-w-md"
          >
            <Card className="!p-0 shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between bg-stone-50/50 px-6 py-5 border-b border-stone-100">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-primary)] text-white shadow-lg shadow-[var(--color-primary)]/20">
                    <Keyboard size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[var(--color-text)] leading-none">System Shortcuts</h3>
                    <p className="mt-1 text-[10px] uppercase tracking-widest text-[var(--color-text-secondary)] font-medium">Power-user Commands</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>

              {/* List */}
              <div className="max-h-[60vh] overflow-y-auto px-6 py-4 scrollbar-hide">
                <div className="space-y-1">
                  {shortcuts.map((item) => (
                    <div
                      key={item.key}
                      className="flex items-center justify-between rounded-lg px-2 py-2.5 hover:bg-stone-50 transition-colors group"
                    >
                      <span className="text-xs font-medium text-stone-600 group-hover:text-stone-900">{item.label}</span>
                      <kbd className="inline-flex min-w-[2.5rem] items-center justify-center rounded-md border-b-2 border-stone-200 bg-white px-2 py-1 font-mono text-[10px] font-black text-stone-600 shadow-sm leading-none uppercase">
                        {item.key}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div className="bg-stone-50/30 px-6 py-4 border-t border-stone-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full rounded-xl bg-stone-900 py-3 text-xs font-black uppercase tracking-[0.2em] text-white shadow-xl shadow-stone-900/10 transition-all hover:bg-stone-800 active:scale-[0.98]"
                >
                  Got it
                </button>
              </div>
            </Card>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
