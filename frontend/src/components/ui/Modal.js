'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

/**
 * Modal — Standard UI wrapper for complex dialogs.
 *
 * @param {boolean} isOpen
 * @param {function} onClose
 * @param {string} [title]
 * @param {string} [maxWidth="520px"]
 * @param {React.ReactNode} children
 */
export default function Modal({
  isOpen,
  onClose,
  title,
  maxWidth = '520px',
  children,
  className = '',
}) {
  // Handle Escape key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            style={{ maxWidth }}
            className={`
              relative w-full max-h-[90vh] overflow-y-auto 
              rounded-3xl border border-stone-200 bg-white 
              shadow-2xl shadow-stone-950/20 transition-all 
              scrollbar-hide ${className}
            `}
          >
            {/* Header if title provided */}
            {title && (
              <div className="flex items-center justify-between border-b border-stone-100 p-6 sm:px-8 sm:py-5">
                <h3 className="text-sm font-black uppercase tracking-widest text-stone-500">
                  {title}
                </h3>
                <button
                  onClick={onClose}
                  className="rounded-lg p-1 text-stone-400 hover:bg-stone-50 hover:text-stone-600 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            )}

            {/* Body */}
            <div className={title ? 'p-6 sm:p-8' : 'p-0'}>{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
