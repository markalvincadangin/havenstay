import { API_BASE_URL } from "./config";

export class ApiError extends Error {
  constructor(message, status, errors = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors;
  }
}

function getToken() {
  if (typeof window === "undefined") {
    return null;
  }

  const localToken = localStorage.getItem("havenstay_token");
  if (localToken) {
    return localToken;
  }

  return null;
}

/** Dispatched once per 401 burst so React can redirect without full reload or parallel storms. */
export const UNAUTHORIZED_EVENT = "havenstay:unauthorized";

/**
 * Normalize API success envelopes to a single consumer contract.
 * Backend standard: { message, data }. We unwrap to `data`.
 */
function unwrapSuccessBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return body;
  }

  // Keep top-level pagination meta shape used by list endpoints.
  if (
    Object.prototype.hasOwnProperty.call(body, "data") &&
    Object.prototype.hasOwnProperty.call(body, "meta")
  ) {
    return body;
  }

  if (
    Object.prototype.hasOwnProperty.call(body, "data") &&
    Object.prototype.hasOwnProperty.call(body, "message")
  ) {
    return body.data;
  }

  return body;
}

export async function apiRequest(path, options = {}) {
  const { skipAuthRedirect = false, ...fetchOptions } = options;
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(fetchOptions.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...fetchOptions,
      headers,
    });
  } catch (networkError) {
    throw new ApiError(
      networkError?.message || "Network error — backend may be unreachable.",
      0,
      null,
    );
  }

  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const body = isJson ? await response.json() : null;

  if (!response.ok) {
    if (response.status === 401) {
      clearAuthToken();
      if (typeof window !== "undefined") {
        try {
          localStorage.removeItem("havenstay_user");
        } catch {
          /* ignore */
        }
        if (!skipAuthRedirect) {
          window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
        }
      }
    }

    throw new ApiError(
      body?.message || "Request failed.",
      response.status,
      body?.errors || null,
    );
  }

  return unwrapSuccessBody(body);
}

export function setAuthToken(token) {
  if (typeof window !== "undefined") {
    localStorage.setItem("havenstay_token", token);
  }
}

export function clearAuthToken() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("havenstay_token");
  }
}

export function hasAuthToken() {
  return Boolean(getToken());
}

export const fetcher = (url) => apiRequest(url, { method: "GET" });
