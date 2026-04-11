"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Edit2, Plus, Search, Shield, Users } from "lucide-react";
import { apiRequest } from "../../lib/api";
import { flattenApiErrors } from "../../lib/errors";
import { canManageUsers } from "../../lib/auth";
import { useAuthGuard } from "../../hooks/useAuthGuard";
import Alert from "../_components/ui/Alert";
import { AppMain } from "../_components/ui/AppShell";
import Breadcrumbs from "../_components/ui/Breadcrumbs";
import Button from "../_components/ui/Button";
import { Card } from "../_components/ui/Card";
import FilterChips from "../_components/ui/FilterChips";
import { Field, Input, Select } from "../_components/ui/Fields";
import PageHeader from "../_components/ui/PageHeader";
import { SkeletonListPage } from "../_components/ui/Skeleton";
import UserRoleBadge from "../_components/ui/UserRoleBadge";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { Table } from "../_components/ui/Table";

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.2, ease: "easeOut" },
};

function safeLower(value) {
  return String(value ?? "").toLowerCase();
}

function KpiCard({ label, value, valueClass = "" }) {
  return (
    <div
      className="rounded-2xl border border-stone-200 bg-white px-6 py-5 shadow-sm"
      aria-label={label}
    >
      <div className="mb-2 text-[10px] font-bold tracking-widest text-stone-500">
        {label}
      </div>
      <div className={`text-2xl font-black leading-none tracking-tight tabular-nums text-stone-900 sm:text-3xl ${valueClass}`}>
        {value}
      </div>
    </div>
  );
}

export default function UsersPage() {
  const { user: currentUser, authLoading } = useAuthGuard();
  const shouldReduceMotion = useReducedMotion();
  const [loading, setLoading] = useState(true);
  const [viewDenied, setViewDenied] = useState(false);
  const [apiError, setApiError] = useState("");
  const [users, setUsers] = useState([]);
  const [actionError, setActionError] = useState("");
  const [actionLoading, setActionLoading] = useState(null);

  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const canAccess = useMemo(() => canManageUsers(currentUser), [currentUser]);

  const fetchUsers = useCallback(async () => {
    setApiError("");
    setLoading(true);
    try {
      const data = await apiRequest("/api/users", { method: "GET" });
      setUsers(Array.isArray(data?.users) ? data.users : []);
    } catch (error) {
      setApiError(flattenApiErrors(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!currentUser) {
      setLoading(false);
      return;
    }
    if (!canManageUsers(currentUser)) {
      setViewDenied(true);
      setLoading(false);
      return;
    }
    fetchUsers();
  }, [authLoading, currentUser, fetchUsers]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      const role = safeLower(u?.role?.role_name);
      if (roleFilter !== "all" && role !== roleFilter) return false;

      if (statusFilter === "active" && !u.is_active) return false;
      if (statusFilter === "inactive" && u.is_active) return false;

      if (!q) return true;

      const name = `${u.first_name || ""} ${u.last_name || ""}`.trim().toLowerCase();
      return (
        String(u.user_id).includes(q) ||
        safeLower(u.username).includes(q) ||
        safeLower(u.email).includes(q) ||
        name.includes(q)
      );
    });
  }, [users, query, roleFilter, statusFilter]);

  const activeCount = useMemo(() => users.filter((u) => u.is_active).length, [users]);
  const adminCount = useMemo(
    () => users.filter((u) => safeLower(u?.role?.role_name) === "admin").length,
    [users],
  );

  async function handleToggleActive(user) {
    const nextActive = !user.is_active;
    const action = nextActive ? "reactivate" : "deactivate";
    setActionError("");
    setActionLoading(user.user_id);
    try {
      await apiRequest(`/api/users/${user.user_id}/${action}`, {
        method: "POST",
      });
      setUsers((prev) =>
        prev.map((u) => (u.user_id === user.user_id ? { ...u, is_active: nextActive } : u)),
      );
    } catch (error) {
      setActionError(flattenApiErrors(error));
    } finally {
      setActionLoading(null);
    }
  }

  if (authLoading || loading) {
    return <SkeletonListPage rows={6} />;
  }

  return (
    <AppMain>
      <motion.div
        className="space-y-6"
        initial={shouldReduceMotion ? false : pageVariants.initial}
        animate={shouldReduceMotion ? false : pageVariants.animate}
        transition={shouldReduceMotion ? { duration: 0 } : pageVariants.transition}
      >
        <PageHeader
          title="User Accounts"
          subtitle="Directory of staff accounts, roles, and activation state. Restricted to admin oversight."
          breadcrumbs={<Breadcrumbs items={[{ label: "User Management" }]} />}
          actions={
            <div className="flex items-center gap-3">
              <Button
                variant="primary"
                onClick={() => window.location.href = "/users/new"}
                className="h-10 !text-[10px] bg-teal-600 hover:bg-teal-700"
              >
                <Plus size={14} className="mr-1" />
                Register User
              </Button>
              <div className="border-l border-stone-200 pl-3">
                <UserRoleBadge username={currentUser?.username} roleName={currentUser?.role?.role_name} />
              </div>
            </div>
          }
        />

        {viewDenied ? (
          <Alert variant="warning" title="Access restricted" data-testid="access-denied-users">
            You do not have permission to view this page. Only administrators can open the user directory.
            Contact an admin if you need changes to accounts or roles.
          </Alert>
        ) : null}

        {!viewDenied && apiError ? (
          <Alert variant="error" title="Could not load users">
            {apiError}
            <button
              type="button"
              onClick={() => fetchUsers()}
              className="mt-2 text-xs font-bold underline hover:opacity-80"
            >
              Retry
            </button>
          </Alert>
        ) : null}

        {actionError ? (
          <Alert variant="error" title="Action failed">
            {actionError}
            <button
              type="button"
              onClick={() => setActionError("")}
              className="mt-2 text-xs font-bold underline hover:opacity-80"
            >
              Dismiss
            </button>
          </Alert>
        ) : null}

        {canAccess && !apiError ? (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <KpiCard label="Total Accounts" value={users.length} />
              <KpiCard label="Active" value={activeCount} valueClass="text-emerald-800" />
              <KpiCard label="Administrators" value={adminCount} valueClass="text-stone-900" />
            </div>

            <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 bg-stone-50/50 px-6 py-4 sm:px-8 sm:py-5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                    <Shield size={16} aria-hidden />
                  </div>
                  <h2 className="hs-strip-title">Registry Filters</h2>
                </div>
              </div>
              <div className="p-6">
                <div className="grid items-end gap-6 lg:grid-cols-12">
                  <div className="lg:col-span-5">
                    <Field label="Search">
                      <div className="group relative">
                        <Search
                          className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-stone-400 transition-colors group-focus-within:text-teal-600"
                          aria-hidden
                        />
                        <Input
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          placeholder="Username, name, email or ID…"
                          className="!h-11 border-stone-200 pl-11 focus:border-teal-500/50 focus:ring-4 focus:ring-teal-500/5"
                        />
                      </div>
                    </Field>
                  </div>
                  <div className="lg:col-span-3">
                    <Field label="Role">
                      <Select
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value)}
                        className="!h-11 border-stone-200"
                      >
                        <option value="all">All roles</option>
                        <option value="admin">Admin</option>
                        <option value="staff">Staff</option>
                        <option value="viewer">Viewer</option>
                      </Select>
                    </Field>
                  </div>
                  <div className="lg:col-span-4">
                    <Field label="Account status">
                      <Select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="!h-11 border-stone-200"
                      >
                        <option value="all">All statuses</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </Select>
                    </Field>
                  </div>
                </div>
                <FilterChips
                  className="mt-6"
                  items={[
                    { key: "q", label: "Search", value: query, onClear: () => setQuery("") },
                    {
                      key: "role",
                      label: "Role",
                      value: roleFilter !== "all" ? roleFilter : "",
                      onClear: () => setRoleFilter("all"),
                    },
                    {
                      key: "status",
                      label: "Status",
                      value: statusFilter !== "all" ? statusFilter : "",
                      onClear: () => setStatusFilter("all"),
                    },
                  ]}
                  onClearAll={() => {
                    setQuery("");
                    setRoleFilter("all");
                    setStatusFilter("all");
                  }}
                />
              </div>
            </Card>

            <div className="mt-2 flex items-center gap-2 text-xs font-medium text-stone-500">
              <Users className="h-3.5 w-3.5 shrink-0 text-stone-400" aria-hidden />
              <span>
                Showing {filtered.length} of {users.length} accounts
              </span>
            </div>

            <Table
              caption="User directory"
              ariaLabel="User accounts and roles"
              columns={[
                { key: "id", label: "User ID", className: "whitespace-nowrap" },
                { key: "username", label: "Username" },
                { key: "name", label: "Name" },
                { key: "email", label: "Email" },
                { key: "role", label: "Role" },
                { key: "status", label: "Status" },
                { key: "actions", label: "", className: "text-right" },
              ]}
              rows={filtered.map((row) => {
                const displayName = [row.first_name, row.last_name].filter(Boolean).join(" ").trim() || "—";
                const isSelf = row.user_id === currentUser?.user_id;
                return (
                  <tr
                    key={row.user_id}
                    className="border-t border-stone-100 transition-colors hover:bg-stone-50"
                  >
                    <td className="px-6 py-4 font-mono text-[10px] font-bold tracking-tighter text-stone-400">
                      #{row.user_id}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-stone-900">{row.username}</td>
                    <td className="px-6 py-4 text-sm text-stone-700">{displayName}</td>
                    <td className="px-6 py-4 text-xs font-mono text-stone-500">{row.email || "—"}</td>
                    <td className="px-6 py-4">
                      <StatusBadge>{row?.role?.role_name || "—"}</StatusBadge>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge>{row.is_active ? "active" : "inactive"}</StatusBadge>
                    </td>
                    <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                       <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => window.location.href = `/users/${row.user_id}/edit`}
                        aria-label={`Edit user ${row.username}`}
                        className="!h-8 !px-3"
                      >
                        <Edit2 size={12} className="mr-1" />
                        Edit
                      </Button>
                      {row.is_active ? (
                        <Button
                          type="button"
                          variant="danger"
                          size="sm"
                          loading={actionLoading === row.user_id}
                          disabled={actionLoading !== null || isSelf}
                          onClick={() => handleToggleActive(row)}
                          aria-label={`Deactivate user ${row.username}`}
                          title={isSelf ? "You cannot deactivate your own account" : undefined}
                        >
                          Deactivate
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          loading={actionLoading === row.user_id}
                          disabled={actionLoading !== null || isSelf}
                          onClick={() => handleToggleActive(row)}
                          aria-label={`Reactivate user ${row.username}`}
                        >
                          Reactivate
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
              emptyTitle="No users match filters"
              emptyDescription="Clear filters or adjust search to see accounts."
            />
          </>
        ) : null}
      </motion.div>
    </AppMain>
  );
}
