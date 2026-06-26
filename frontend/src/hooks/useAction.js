'use client';

import { useState, useCallback, useRef } from 'react';
import { apiRequest } from '@/lib/api';
import { useToasts } from '@/context/ToastContext';
import { flattenApiErrors } from '@/lib/errors';

/**
 * useAction — A forensic-grade hook for managing server-side mutations.
 *
 * Features:
 * 1. Stable Idempotency: Key is tied to the component lifecycle or reset manually.
 * 2. Automatic Feedback: Provides isPending, error, and success states.
 * 3. Atomic Guard: Prevents parallel submissions at the client level.
 * 4. Error Normalization: Automatically flattens API errors for UI display.
 *
 * @param {string} url - API endpoint
 * @param {Object} options - { method, onSuccess, onError, successMessage }
 */
export function useAction(url, options = {}) {
  const {
    method = 'POST',
    onSuccess,
    onError,
    successMessage = 'Action completed successfully.',
  } = options;

  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState(null);
  const [lastSuccess, setLastSuccess] = useState(false);
  const { showToast } = useToasts();

  // Stable idempotency key for the life of this "intent"
  const idempotencyKeyRef = useRef(crypto.randomUUID());
  const isExecutingRef = useRef(false);

  const resetAction = useCallback(() => {
    idempotencyKeyRef.current = crypto.randomUUID();
    setIsPending(false);
    setError(null);
    setLastSuccess(false);
    isExecutingRef.current = false;
  }, []);

  const execute = useCallback(
    async (body = {}) => {
      if (isExecutingRef.current) return null;

      isExecutingRef.current = true;
      setIsPending(true);
      setError(null);
      setLastSuccess(false);

      try {
        const response = await apiRequest(url, {
          method,
          idempotencyKey: idempotencyKeyRef.current,
          body: JSON.stringify(body),
        });

        if (successMessage) {
          showToast(successMessage, 'success');
        }

        setLastSuccess(true);
        if (onSuccess) onSuccess(response);
        return response;
      } catch (err) {
        const flattened = flattenApiErrors(err);
        setError(flattened);
        if (onError) onError(err);
        throw err;
      } finally {
        setIsPending(false);
        isExecutingRef.current = false;
      }
    },
    [url, method, successMessage, showToast, onSuccess, onError]
  );

  return {
    execute,
    isPending,
    error,
    success: lastSuccess,
    resetAction,
    idempotencyKey: idempotencyKeyRef.current,
  };
}
