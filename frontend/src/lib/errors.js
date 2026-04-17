export function flattenApiErrors(error, _field = null) {
  if (!error) {
    return "Request failed.";
  }

  if (error.errors && typeof error.errors === "object") {
    return Object.entries(error.errors)
      .flatMap(([_field, messages]) => {
        const list = Array.isArray(messages) ? messages : [String(messages)];
        return list.map((msg) => String(msg));
      })
      .join(" ");
  }

  return error.message || "Request failed.";
}

/**
 * Standardize 422 error parsing as per Blueprint Section 17.
 * Returns an object keyed by field name with arrays of messages.
 */
export const normalizeErrors = (err) => {
  if (err?.status === 422 && err.info?.errors) {
    return err.info.errors;
  }
  // If it's the standard Laravel format but the status code isn't 422 (unlikely for validation but possible)
  if (err?.errors && typeof err.errors === 'object') {
     return err.errors;
  }
  return { general: [err?.message || 'Action failed'] };
};
