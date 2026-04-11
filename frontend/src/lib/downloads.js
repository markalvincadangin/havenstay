import { API_BASE_URL } from "./config";
import { ApiError } from "./api";

function getToken() {
  if (typeof window === "undefined") {
    return null;
  }

  return localStorage.getItem("havenstay_token");
}

export async function downloadCsvWithAuth(path, fileName) {
  const token = getToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "GET",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = await response.json();
      throw new ApiError(body?.message || "CSV export failed.", response.status, body?.errors || null);
    }
    throw new ApiError("CSV export failed.", response.status);
  }

  const blob = await response.blob();
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(href);
}
