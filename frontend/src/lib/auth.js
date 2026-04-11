import { apiRequest, clearAuthToken } from "./api";

export function canManageContracts(user) {
  const roleName = user?.role?.role_name;
  return roleName === "admin" || roleName === "staff";
}

export function canManageTenants(user) {
  const roleName = user?.role?.role_name;
  return roleName === "admin" || roleName === "staff";
}

export function canManageRooms(user) {
  const roleName = user?.role?.role_name;
  return roleName === "admin" || roleName === "staff";
}

export function canManageBilling(user) {
  const roleName = user?.role?.role_name;
  return roleName === "admin" || roleName === "staff";
}

export function canManageUsers(user) {
  const roleName = user?.role?.role_name;
  return roleName === "admin";
}

export function canViewBilling(user) {
  const roleName = user?.role?.role_name;
  return roleName === "admin" || roleName === "staff" || roleName === "viewer";
}

export function canViewReports(user) {
  const roleName = user?.role?.role_name;
  return roleName === "admin" || roleName === "staff" || roleName === "viewer";
}

export async function fetchCurrentUser() {
  try {
    const data = await apiRequest("/api/auth/me", { method: "GET" });
    return data?.user || null;
  } catch (error) {
    if (error?.status === 401) {
      clearAuthToken();
    }
    throw error;
  }
}
