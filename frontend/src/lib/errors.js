const HTTP_STATUS_MESSAGES = {
  0: 'Unable to connect to the server. Please check your internet connection or try again later.',
  400: "We couldn't process that request. Please verify your information and try again.",
  401: 'Your session has timed out. Please sign in again to continue.',
  403: "Access Restricted: You don't have the necessary permissions for this action.",
  404: "Record Not Found: The information you're looking for may have been moved or removed.",
  422: 'Incomplete Information: Please review the highlighted fields and correct any errors.',
  429: "High Traffic: We're receiving too many requests. Please wait a moment before trying again.",
  500: 'System Alert: Something went wrong on our end. Our technical team has been notified.',
  503: 'Maintenance in Progress: The system is briefly offline for updates. Please check back in a few minutes.',
};

export function flattenApiErrors(error, _field = null) {
  if (!error) {
    return HTTP_STATUS_MESSAGES[0];
  }

  if (error.errors && typeof error.errors === 'object') {
    return Object.entries(error.errors)
      .flatMap(([_field, messages]) => {
        const list = Array.isArray(messages) ? messages : [String(messages)];
        return list.map((msg) => String(msg));
      })
      .join(' ');
  }

  return (
    error.message ||
    HTTP_STATUS_MESSAGES[error.status] ||
    'Something went wrong. Please try again or contact support.'
  );
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
  return {
    general: [err?.message || 'Something went wrong. Please try again.'],
  };
};
