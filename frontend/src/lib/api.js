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

  const cookieToken = document.cookie
    .split("; ")
    .find((row) => row.startsWith("havenstay_token="))
    ?.split("=")[1];

  return cookieToken ? decodeURIComponent(cookieToken) : null;
}

export async function apiRequest(path, options = {}) {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const body = isJson ? await response.json() : null;

  if (!response.ok) {
    if (response.status === 401) {
      clearAuthToken();
      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }

    throw new ApiError(
      body?.message || "Request failed.",
      response.status,
      body?.errors || null,
    );
  }

  return body;
}

export function setAuthToken(token) {
  if (typeof window !== "undefined") {
    localStorage.setItem("havenstay_token", token);
    document.cookie = `havenstay_token=${encodeURIComponent(token)}; Path=/; Max-Age=2592000; SameSite=Lax`;
  }
}

export function clearAuthToken() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("havenstay_token");
    document.cookie = "havenstay_token=; Path=/; Max-Age=0; SameSite=Lax";
  }
}

export function hasAuthToken() {
  return Boolean(getToken());
}
