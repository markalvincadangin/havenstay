import { normalizeErrors } from "./errors";

/**
 * Bind backend validation errors to react-hook-form consistently.
 */
export function applyServerFieldErrors(error, setError, { setApiError, fallbackMessage } = {}) {
  const normalized = normalizeErrors(error);
  if (normalized.general?.length) {
    if (setApiError) setApiError(normalized.general[0]);
    return;
  }

  Object.entries(normalized).forEach(([field, messages]) => {
    setError(field, { type: "manual", message: messages?.[0] || "Invalid value" });
  });

  if (setApiError) {
    setApiError(fallbackMessage || "Please correct the validation errors below.");
  }
}
