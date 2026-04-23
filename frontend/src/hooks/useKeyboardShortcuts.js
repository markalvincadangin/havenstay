"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { G_KEY_ROUTES } from "@/lib/keyboardNav";

/**
 * useKeyboardShortcuts — G+letter navigation, help (?), and app shortcuts.
 * Avoids Ctrl+P (print) and Ctrl+R (browser reload); see `keyboardNav.js`.
 *
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

      // Alt+Shift+P → new payment (not Ctrl+P — reserved for Print)
      if (e.altKey && e.shiftKey && key === "p") {
        e.preventDefault();
        router.push("/payments/new");
        return;
      }

      // Alt+Shift+R → soft refresh (not Ctrl+R — browser reload)
      if (e.altKey && e.shiftKey && key === "r") {
        e.preventDefault();
        router.refresh();
        return;
      }

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
        if (G_KEY_ROUTES[key]) {
          e.preventDefault();
          router.push(G_KEY_ROUTES[key]);
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
