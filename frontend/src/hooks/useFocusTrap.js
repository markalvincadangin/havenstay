"use client";

import { useEffect, useRef } from "react";

/**
 * useFocusTrap - Standard hook for trapping focus within a container (e.g., modals).
 * @param {boolean} isActive - Whether the trap should be active.
 * @returns {import("react").RefObject} rootRef - Ref to be attached to the container.
 */
export function useFocusTrap(isActive) {
  const rootRef = useRef(null);

  useEffect(() => {
    if (!isActive || !rootRef.current) return;

    const root = rootRef.current;
    
    // Find all focusable elements
    const focusableElements = root.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    
    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleKeyDown = (e) => {
      if (e.key !== "Tab") return;

      if (e.shiftKey) {
        // Tab + Shift: focus previous
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab: focus next
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    // Auto-focus first element or the container if no focusable items
    firstElement.focus();

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isActive]);

  return rootRef;
}
