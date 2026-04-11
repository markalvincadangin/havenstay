"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * useKeyboardShortcuts - Standardized navigation shortcuts (G+key).
 * @param {Function} onHelp - Callback triggered when '?' is pressed.
 */
export function useKeyboardShortcuts(onHelp) {
  const router = useRouter();
  const gPressed = useRef(false);
  const timer = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger if typing in input/textarea
      const active = document.activeElement;
      const isInput = active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.contentEditable === "true";
      if (isInput) return;

      const key = e.key.toLowerCase();

      // Help shortcut (?)
      if (e.key === "?" && onHelp) {
        e.preventDefault();
        onHelp();
        return;
      }

      if (key === "g") {
        gPressed.current = true;
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          gPressed.current = false;
        }, 800);
        return;
      }

      if (gPressed.current) {
        const routes = {
          d: "/dashboard",
          t: "/tenants",
          r: "/rooms",
          c: "/contracts",
          b: "/billing",
          p: "/payments",
          l: "/audit-logs",
          u: "/users",
          o: "/reports",
        };

        if (routes[key]) {
          e.preventDefault();
          router.push(routes[key]);
          gPressed.current = false;
          if (timer.current) clearTimeout(timer.current);
        } else {
          // Reset if any other key is pressed
          gPressed.current = false;
          if (timer.current) clearTimeout(timer.current);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [router, onHelp]);
}
