import { normalizeErrors } from './errors';

/**
 * Bind backend validation errors to react-hook-form consistently.
 */
export function applyServerFieldErrors(
  error,
  setError,
  { setApiError, showToast, fallbackMessage } = {}
) {
  const normalized = normalizeErrors(error);

  if (normalized.general?.length) {
    const msg = normalized.general[0];
    if (showToast) showToast(msg, 'error');
    if (setApiError) setApiError(msg);
    return;
  }

  Object.entries(normalized).forEach(([field, messages]) => {
    setError(field, {
      type: 'manual',
      message: messages?.[0] || 'Please check this field.',
    });
  });

  const fallback =
    fallbackMessage ||
    'Some information is missing or incorrect. Please check the highlighted fields.';
  if (showToast) showToast(fallback, 'error');
  if (setApiError) setApiError(fallback);
}
