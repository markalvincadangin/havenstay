const HTTP_STATUS_MESSAGES = {
  0: "Unable to connect to the registry. Please check your internet connection.",
  400: "The request was invalid. Please check your input.",
  401: "Your session has expired. Please sign in again.",
  403: "You do not have permission to perform this action.",
  404: "The requested record could not be found.",
  422: "Please correct the validation errors below.",
  429: "Too many requests. Please wait a moment and try again.",
  500: "A system error occurred. Our team has been notified.",
  503: "The system is briefly undergoing maintenance. Please try again in a few minutes.",
};

export function flattenApiErrors(error, _field = null) {
  if (!error) {
    return HTTP_STATUS_MESSAGES[0];
  }

  if (error.errors && typeof error.errors === "object") {
    return Object.entries(error.errors)
      .flatMap(([_field, messages]) => {
        const list = Array.isArray(messages) ? messages : [String(messages)];
        return list.map((msg) => String(msg));
      })
      .join(" ");
  }

  return error.message || HTTP_STATUS_MESSAGES[error.status] || "Request failed.";
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
