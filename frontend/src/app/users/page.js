"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";
import { Edit2, Search, Shield, Users, UserPlus, UserCheck, ShieldCheck } from "lucide-react";
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
import { StatusBadge } from "../_components/ui/StatusBadge";
import { Table } from "../_components/ui/Table";
import { KpiCard } from "../_components/ui/KpiCard";
import TablePagination from "../_components/ui/TablePagination";
import { ROLE_NAME_LABELS, USER_ACCOUNT_STATUS_FILTER_LABELS } from "../../lib/constants";
import {
  buildPaginationQuery,
  normalizePaginatedList,
  readStoredPerPage,
} from "../../lib/pagination";

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.2, ease: "easeOut" },
};

function safeLower(value) {
  return String(value ?? "").toLowerCase();
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
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(() => readStoredPerPage());
  const [listMeta, setListMeta] = useState(null);

  const canAccess = useMemo(() => canManageUsers(currentUser), [currentUser]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const fetchUsers = useCallback(async () => {
    setApiError("");
    setLoading(true);
    try {
      const extra = {};
      if (debouncedQuery) extra.q = debouncedQuery;
      if (roleFilter !== "all") extra.role = roleFilter;
      if (statusFilter === "active") extra.account_status = "active";
      else if (statusFilter === "inactive") extra.account_status = "inactive";

      const qs = buildPaginationQuery(page, perPage, extra);
      const data = await apiRequest(`/api/users${qs}`, { method: "GET" });
      const { rows, meta } = normalizePaginatedList(data);
      setUsers(rows);
      setListMeta(meta);
    } catch (error) {
      setApiError(flattenApiErrors(error));
    } finally {
      setLoading(false);
    }
  }, [page, perPage, debouncedQuery, roleFilter, statusFilter]);

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
  }, [authLoading, currentUser, canAccess, fetchUsers]);

  useEffect(() => {
    flushSync(() => {
      setPage(1);
    });
  }, [debouncedQuery, roleFilter, statusFilter]);

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
          title="User Directory"
          subtitle="Staff accounts and roles (Admin only)."
          breadcrumbs={<Breadcrumbs items={[{ label: "Administration" }, { label: "User Directory" }]} />}
          actions={
            <div className="flex flex-wrap items-center justify-end gap-3">
              <UserRoleBadge username={currentUser?.username} roleName={currentUser?.role?.role_name} />
              <Button
                variant="primary"
                onClick={() => window.location.href = "/users/new"}
                className="!h-11 rounded-xl bg-teal-600 px-8 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-teal-900/10"
              >
                <UserPlus size={14} className="mr-2" />
                Register Account
              </Button>
            </div>
          }
        />

        {viewDenied ? (
          <Alert variant="warning" title="Access restricted" data-testid="access-denied-users">
            You do not have permission to view this page. Only administrators can open the user directory.
            Contact an admin if you need changes to accounts or roles.
          </Alert>
        ) : null}

        {!viewDenied && (
          <>
            {apiError ? (
              <Alert variant="error" title="Could not load accounts">
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
                  <KpiCard 
                    label="Total Accounts" 
                    value={listMeta?.total ?? users.length} 
                    icon={Users}
                    sub="Matching filters"
                  />
                  <KpiCard 
                    label="Active" 
                    value={activeCount} 
                    icon={UserCheck}
                    sub="On this page"
                  />
                  <KpiCard 
                    label="Administrators" 
                    value={adminCount} 
                    icon={ShieldCheck}
                    sub="On this page"
                  />
                </div>

                <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
                  <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/50 px-6 py-4 sm:px-8 sm:py-5">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-stone-100 text-stone-600">
                        <Users size={14} aria-hidden />
                      </div>
                      <h2 className="hs-strip-title text-stone-400 tracking-widest uppercase font-black text-sm">
                        Filters
                      </h2>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={fetchUsers}
                      className="!h-8 px-3 text-[10px] font-bold uppercase tracking-widest text-stone-400 hover:text-teal-600"
                    >
                      Refresh
                    </Button>
                  </div>
                  <div className="p-8">
                    <div className="grid items-end gap-6 md:grid-cols-12">
                      <div className="md:col-span-12 lg:col-span-5">
                        <Field label="Cross-reference search">
                          <div className="group relative">
                            <Search
                              className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-stone-400 transition-colors group-focus-within:text-teal-600"
                              aria-hidden
                            />
                            <Input
                              value={query}
                              onChange={(e) => setQuery(e.target.value)}
                              placeholder="Name, username, email, or user ID…"
                              className="!h-12 border-stone-200 pl-11 font-medium transition-[border-color,box-shadow] focus:border-teal-500/50 focus:ring-4 focus:ring-teal-500/5"
                            />
                          </div>
                        </Field>
                      </div>
                      <div className="md:col-span-6 lg:col-span-3">
                        <Field label="Role">
                          <Select
                            value={roleFilter}
                            onChange={(e) => setRoleFilter(e.target.value)}
                            className="!h-12 border-stone-200 font-bold focus:border-teal-500/50"
                          >
                            <option value="all">All roles</option>
                            {Object.entries(ROLE_NAME_LABELS).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </Select>
                        </Field>
                      </div>
                      <div className="md:col-span-6 lg:col-span-4">
                        <Field label="Account status">
                          <Select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="!h-12 border-stone-200 font-bold focus:border-teal-500/50"
                          >
                            {Object.entries(USER_ACCOUNT_STATUS_FILTER_LABELS).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </Select>
                        </Field>
                      </div>
                    </div>

                    <FilterChips
                      className="mt-6"
                      items={[
                        { key: "q", label: "Query", value: query, onClear: () => setQuery("") },
                        {
                          key: "role",
                          label: "Role",
                          value: roleFilter !== "all" ? ROLE_NAME_LABELS[roleFilter] || roleFilter : "",
                          onClear: () => setRoleFilter("all"),
                        },
                        {
                          key: "status",
                          label: "Status",
                          value:
                            statusFilter !== "all"
                              ? USER_ACCOUNT_STATUS_FILTER_LABELS[statusFilter] || statusFilter
                              : "",
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

                <Card className="mt-6 overflow-hidden border-stone-200 !p-0 shadow-sm rounded-2xl">
                    <Table
                    embedded={true}
                    caption={`${listMeta?.total ?? users.length} staff accounts`}
                    ariaLabel="User accounts and roles"
                    columns={[
                        {
                          key: "user_id",
                          label: "User ID",
                          className: "w-[7.5rem]",
                          headerClassName: "!px-4",
                        },
                        { key: "user", label: "Name" },
                        { key: "username", label: "Username" },
                        { key: "email", label: "Email" },
                        { key: "role", label: "Role" },
                        { key: "status", label: "Status" },
                        { key: "actions", label: "", className: "text-right min-w-[5.5rem]" },
                    ]}
                    rows={users.map((row) => {
                        const displayName = [row.first_name, row.last_name].filter(Boolean).join(" ").trim() || "—";
                        const isSelf = row.user_id === currentUser?.user_id;
                        return (
                        <tr
                            key={row.user_id}
                            className="border-t border-stone-100 transition-colors hover:bg-stone-50"
                        >
                            <td className="px-4 py-4 align-middle">
                              <span className="font-mono text-[10px] font-bold uppercase tracking-tighter text-stone-400 tabular-nums">
                                #USER-{row.user_id}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-xs font-bold text-stone-900">{displayName}</span>
                            </td>
                            <td className="px-6 py-4 font-mono text-[11px] text-stone-600">{row.username}</td>
                            <td className="px-6 py-4 text-xs tabular-nums text-stone-500 font-medium">{row.email || "—"}</td>
                            <td className="px-6 py-4 text-xs font-mono">
                                <StatusBadge size="sm">{row?.role?.role_name || "—"}</StatusBadge>
                            </td>
                            <td className="px-6 py-4">
                                <StatusBadge size="sm">{row.is_active ? "active" : "inactive"}</StatusBadge>
                            </td>
                            <td className="px-6 py-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => window.location.href = `/users/${row.user_id}/edit`}
                                        aria-label={`Edit user ${row.username}`}
                                        className="!h-8 !w-8 !p-0 flex items-center justify-center rounded-lg border-stone-200"
                                        title="Edit Profile"
                                    >
                                        <Edit2 size={12} className="text-stone-600" />
                                    </Button>
                                    {row.is_active ? (
                                        <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        loading={actionLoading === row.user_id}
                                        disabled={actionLoading !== null || isSelf}
                                        onClick={() => handleToggleActive(row)}
                                        aria-label={`Deactivate user ${row.username}`}
                                        title={isSelf ? "Self-protection enabled" : "Deactivate Account"}
                                        className="!h-8 !w-8 !p-0 flex items-center justify-center rounded-lg border-rose-100 bg-rose-50/30 hover:bg-rose-100 group"
                                        >
                                            <Shield size={12} className="text-rose-600 group-hover:scale-110 transition-transform" />
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
                                        title="Reactivate Account"
                                        className="!h-8 !w-8 !p-0 flex items-center justify-center rounded-lg border-emerald-100 bg-emerald-50/30 hover:bg-emerald-100 group"
                                        >
                                            <UserCheck size={12} className="text-emerald-700 group-hover:scale-110 transition-transform" />
                                        </Button>
                                    )}
                                </div>
                            </td>
                        </tr>
                        );
                    })}
                    emptyTitle="No staff accounts match filters"
                    emptyDescription="Clear filters or adjust search criteria to see system accounts."
                    />
                    <TablePagination
                      meta={listMeta}
                      page={page}
                      perPage={perPage}
                      onPageChange={setPage}
                      onPerPageChange={(n) => {
                        setPage(1);
                        setPerPage(n);
                      }}
                      disabled={loading}
                    />
                </Card>
              </>
            ) : null}
          </>
        )}
      </motion.div>
    </AppMain>
  );
}
