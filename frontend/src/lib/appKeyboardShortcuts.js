/**
 * Application shortcuts implemented in `useKeyboardShortcuts.js`.
 * Do not use browser-reserved combos for app actions (e.g. Ctrl+P = Print, Ctrl+R = reload).
 */
export const APP_KEYBOARD_SHORTCUTS = [
  { id: "payment-new", keys: "Alt + Shift + P", label: "Open new payment form" },
  { id: "refresh", keys: "Alt + Shift + R", label: "Refresh application data" },
];
