'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

/**
 * ExpandableTableRow Component
 *
 * Provides progressive disclosure capabilities to dense Table registries.
 * Allows an inline <tr> array map to manage internal open/close states
 * and display secondary context (e.g. recent payments on a contract) via `expandableContent`.
 */
export function ExpandableTableRow({
  children,
  expandableContent,
  colSpan = 10,
  className = '',
  defaultExpanded = false,
  ...props
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const shouldReduceMotion = useReducedMotion();

  const handleToggle = (e) => {
    // If user clicked inside an interactable child like a button or link, don't trigger.
    if (e.target.closest('button') || e.target.closest('a')) {
      return;
    }
    e.stopPropagation();
    setIsExpanded((prev) => !prev);
  };

  const expandVariants = {
    hidden: { opacity: 0, height: 0, overflow: 'hidden' },
    visible: {
      opacity: 1,
      height: 'auto',
      overflow: 'hidden',
      transition: {
        duration: shouldReduceMotion ? 0 : 0.3,
        ease: [0.16, 1, 0.3, 1],
      },
    },
  };

  return (
    <>
      <motion.tr
        onClick={handleToggle}
        className={[
          'cursor-pointer group transition-colors',
          isExpanded ? 'bg-stone-50/80' : 'hover:bg-stone-50/50',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...props}
      >
        {children}
      </motion.tr>
      <AnimatePresence>
        {isExpanded && (
          <tr>
            <td
              colSpan={colSpan}
              className="p-0 border-b border-stone-100 bg-stone-50/30"
            >
              <motion.div
                initial="hidden"
                animate="visible"
                exit="hidden"
                variants={expandVariants}
                className="relative"
              >
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-teal-500 shadow-[0_0_8px_rgba(20,184,166,0.5)] z-10" />
                <div className="px-8 py-6">{expandableContent}</div>
              </motion.div>
            </td>
          </tr>
        )}
      </AnimatePresence>
    </>
  );
}

export default ExpandableTableRow;
