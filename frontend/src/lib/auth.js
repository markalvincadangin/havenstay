import { apiRequest } from "./api";

/**
 * Authorization Helpers
 * Sanitizes role comparison to prevent jank during replication or case-mismatches.
 */
const getRole = (user) => String(user?.role?.role_name || "").toLowerCase().trim();

export function canManageContracts(user) {
  const role = getRole(user);
  return role === "admin" || role === "staff";
}

export function canManageTenants(user) {
  const role = getRole(user);
  return role === "admin" || role === "staff";
}

export function canManageRooms(user) {
  const role = getRole(user);
  return role === "admin" || role === "staff";
}

export function canManageBilling(user) {
  const role = getRole(user);
  return role === "admin" || role === "staff";
}

export function canManageUsers(user) {
  const role = getRole(user);
  return role === "admin";
}

export function canViewBilling(user) {
  const role = getRole(user);
  return ["admin", "staff", "viewer"].includes(role);
}

export function canViewReports(user) {
  const role = getRole(user);
  return ["admin", "staff", "viewer"].includes(role);
}

export async function fetchCurrentUser() {
  const data = await apiRequest("/api/auth/me", { method: "GET" });
  if (!data) return null;
  return data?.user || data;
}
