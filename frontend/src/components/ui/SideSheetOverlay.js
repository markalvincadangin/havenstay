"use client";

import React, { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { createPortal } from "react-dom";

/**
 * Next Gen (v7.0) SideSheetOverlay
 * Provides a context-aware slide-over for rapid edits.
 * Complies with the new floating elevation spec (backdrop-blur).
 */
export function SideSheetOverlay({ isOpen, onClose, title, children }) {
  const overlayRef = useRef(null);

  // Lock body scroll and handle Escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      document.addEventListener("keydown", handleEscape);
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  const handleBackdropClick = (e) => {
    if (e.target === overlayRef.current) {
      onClose();
    }
  };

  const content = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          ref={overlayRef}
          onClick={handleBackdropClick}
          className="fixed inset-0 z-[60] flex justify-end backdrop-blur-sm bg-white/70"
        >
          <motion.div
            key="panel"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="h-full w-full max-w-md bg-white shadow-[0_0_40px_rgba(0,0,0,0.1)] flex flex-col pointer-events-auto border-l border-stone-200"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-8 py-5 border-b border-stone-100 bg-white z-10 shrink-0 shadow-sm shadow-stone-900/5">
              <h2 className="hs-strip-title uppercase tracking-[0.2em] text-[10px] font-black text-stone-400">
                {title}
              </h2>
              <button
                onClick={onClose}
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-stone-400 hover:bg-stone-100 hover:text-stone-700 transition-colors border border-stone-200"
                title="Close summary"
              >
                <X size={16} strokeWidth={2.5} />
              </button>
            </div>
            
            {/* Content Body */}
            <div className="flex-1 overflow-y-auto p-8 relative">
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // Use portal strictly on client to avoid hydration mismatch
  const [mounted, setMounted] = React.useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);
  if (!mounted) return null;
  
  return createPortal(content, document.body);
}
