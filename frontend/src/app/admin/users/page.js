"use client";

import { useMemo, useState } from "react";
import { Edit2, Search, Shield, Users, UserPlus, UserCheck, ShieldCheck, Eye } from "lucide-react";
import useSWR from "swr";
import { apiRequest, fetcher } from "../../../lib/api";
import { flattenApiErrors } from "../../../lib/errors";
import { canManageUsers } from "../../../lib/auth";
import { useAuthGuard } from "../../../hooks/useAuthGuard";
import { useTableSort } from "../../../hooks/useTableSort";
import { sortClientRows } from "../../../lib/tableSort";
import Alert from "../../_components/ui/Alert";
import Breadcrumbs from "../../_components/ui/Breadcrumbs";
import Button from "../../_components/ui/Button";
import { Card } from "../../_components/ui/Card";
import FilterChips from "../../_components/ui/FilterChips";
import { Field, Input, Select } from "../../_components/ui/Fields";
import { SkeletonListPage } from "../../_components/ui/Skeleton";
import PageHeaderActions from "../../_components/ui/PageHeaderActions";
import { StatusBadge } from "../../_components/ui/StatusBadge";
import { Table } from "../../_components/ui/Table";
import { KpiCard } from "../../_components/ui/KpiCard";
import ResourceView from "../../_components/ui/ResourceView";
import TablePagination from "../../_components/ui/TablePagination";
import StandardPage from "../../_components/ui/StandardPage";
import ResourceIdCell from "../../_components/ui/ResourceIdCell";
import { ROLE_NAME_LABELS, USER_ACCOUNT_STATUS_FILTER_LABELS } from "../../../lib/constants";
import {
  normalizePaginatedList,
} from "../../../lib/pagination";
import { usePaginatedFilters } from "../../../hooks/usePaginatedFilters";

function safeLower(value) {
  return String(value ?? "").toLowerCase();
}

export default function UsersPage() {
  const { user: currentUser, authLoading, isUnauthorized } = useAuthGuard();
  const { filters, updateFilter, resetFilters, page, setPage, perPage, setPerPage, queryString } =
    usePaginatedFilters({
      initialFilters: { query: "", role: "all", status: "all" },
      debounceKeys: ["query"],
      buildExtraParams: ({ filters: current, debounced }) => {
        const extra = {};
        const q = String(debounced.query ?? "").trim();
        if (q) extra.q = q;
        if (current.role !== "all") extra.role = current.role;
        if (current.status === "active") extra.account_status = "active";
        else if (current.status === "inactive") extra.account_status = "inactive";
        return extra;
      },
    });
  const query = filters.query;
  const roleFilter = filters.role;
  const statusFilter = filters.status;
  const [apiError, setApiError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [confirmToggleUser, setConfirmToggleUser] = useState(null);
  const [confirmInput, setConfirmInput] = useState("");

  const { sortColumn, sortDirection, onSortChange } = useTableSort();

  const canAccess = useMemo(() => canManageUsers(currentUser), [currentUser]);
  const viewDenied = !authLoading && currentUser !== null && !canAccess;

  const { data: usersData, error: usersError, isValidating: isSyncing, mutate: refetchUsers } = useSWR(
    !authLoading && currentUser && canAccess ? `/api/users${queryString}` : null,
    fetcher,
    { keepPreviousData: true }
  );

  const { rows: users = [], meta: listMeta = null } = useMemo(() => {
    if (!usersData) return { rows: [], meta: null };
    return normalizePaginatedList(usersData);
  }, [usersData]);

  const loading = !usersData && !usersError;

  const fetchUsers = () => refetchUsers();

  const activeCount = useMemo(() => users.filter((u) => u.is_active).length, [users]);
  const adminCount = useMemo(
    () => users.filter((u) => safeLower(u?.role?.role_name) === "admin").length,
    [users],
  );

  const sortedRows = useMemo(() => {
    if (!sortColumn) return users;
    return sortClientRows(users, sortColumn, sortDirection, (u) => {
      switch (sortColumn) {
        case "user_id": return Number(u.user_id) || 0;
        case "user": return [u.first_name, u.last_name].filter(Boolean).join(" ").toLowerCase();
        case "username": return (u.username || "").toLowerCase();
        case "email": return (u.email || "").toLowerCase();
        case "role": return (u?.role?.role_name || "").toLowerCase();
        case "status": return u.is_active ? "active" : "inactive";
        default: return "";
      }
    });
  }, [users, sortColumn, sortDirection]);

  async function handleToggleActive(user) {
    if (user.username !== confirmInput) {
       setApiError(`Forensic rejection: Input '${confirmInput}' does not match username '${user.username}'.`);
       return;
    }
    const nextActive = !user.is_active;
    const action = nextActive ? "reactivate" : "deactivate";
    setActionLoading(user.user_id);
    setApiError(null);
    try {
      await apiRequest(`/api/users/${user.user_id}/${action}`, {
        method: "POST",
      });
      setConfirmToggleUser(null);
      setConfirmInput("");
      refetchUsers();
    } catch (uError) {
      setApiError(flattenApiErrors(uError));
      console.error("Request Error:", uError);
    } finally {
      setActionLoading(null);
    }
  }

  if (isUnauthorized) return null;

  return (
    <StandardPage
      title="User Directory"
      subtitle="STAFF ACCOUNT PROVISIONING AND ROLE ASSIGNMENT"
      breadcrumbs={<Breadcrumbs items={[{ label: "Administration" }, { label: "User Accounts" }]} />}
      loading={authLoading || loading}
      skeleton={<SkeletonListPage rows={6} />}
      actions={
        <PageHeaderActions
          ctaHref="/admin/users/new"
          ctaLabel="Register Account"
          ctaIcon={UserPlus}
          ctaClassName="!h-11 rounded-xl bg-teal-600 px-8 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-teal-900/10"
          user={currentUser}
        />
      }
    >
      <div className="space-y-6">
            {apiError && (
              <Alert variant="error" title="Request Error">
                {apiError}
              </Alert>
            )}
            {viewDenied ? (
          <Alert variant="warning" title="Access restricted" data-testid="access-denied-users">
            You do not have permission to view this page. Only administrators can open the user directory.
            Contact an admin if you need changes to accounts or roles.
          </Alert>
        ) : null}

        {!viewDenied && (
          <>
               {confirmToggleUser && (
                 <Card className="mb-6 border-rose-200 bg-rose-50/50 p-8 shadow-xl">
                   <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                     <div className="space-y-2">
                       <h3 className="text-xs font-black uppercase tracking-widest text-rose-700 flex items-center gap-2">
                         <Shield size={16} />
                         Security Confirmation Required
                       </h3>
                       <p className="text-sm font-medium text-rose-600/80 leading-relaxed max-w-xl">
                         Deactivating <span className="font-bold">@{confirmToggleUser.username}</span> will immediately revoke all system session tokens. 
                         Type the username below to confirm this destructive action.
                       </p>
                     </div>
                     <div className="flex flex-col sm:flex-row items-center gap-3">
                       <Input
                         value={confirmInput}
                         onChange={(e) => setConfirmInput(e.target.value)}
                         placeholder={confirmToggleUser.username}
                         className="!h-10 border-rose-200 bg-white placeholder:text-rose-200 text-rose-900 font-bold"
                       />
                       <div className="flex items-center gap-2">
                        <Button variant="secondary" onClick={() => setConfirmToggleUser(null)} className="!h-10 rounded-xl px-4">
                          Cancel
                        </Button>
                        <Button 
                          variant="danger" 
                          onClick={() => handleToggleActive(confirmToggleUser)} 
                          disabled={confirmInput !== confirmToggleUser.username || actionLoading !== null}
                          loading={actionLoading !== null}
                          className="!h-10 rounded-xl px-6 shadow-lg shadow-rose-900/10"
                        >
                          Confirm Deactivation
                        </Button>
                       </div>
                     </div>
                   </div>
                 </Card>
               )}

              <ResourceView
                isLoading={loading}
                isSyncing={isSyncing}
                error={usersError}
                isEmpty={users.length === 0}
                onRetry={fetchUsers}
                skeleton={<SkeletonListPage rows={10} />}
                emptyProps={{
                  title: "No staff accounts match filters",
                  message: "Clear filters or adjust search criteria to see system accounts."
                }}
              >
                <div className="grid gap-4 sm:grid-cols-3">
                  <KpiCard 
                    label="Total Accounts" 
                    value={listMeta?.total ?? users.length} 
                    icon={Users}
                    sub="Matching filters"
                    isSyncing={isSyncing}
                  />
                  <KpiCard 
                    label="Active" 
                    value={activeCount} 
                    icon={UserCheck}
                    sub="On this page"
                    isSyncing={isSyncing}
                  />
                  <KpiCard 
                    label="Administrators" 
                    value={adminCount} 
                    icon={ShieldCheck}
                    sub="On this page"
                    isSyncing={isSyncing}
                  />
                </div>

                <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
                  <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/50 px-6 py-4 sm:px-8 sm:py-5">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-stone-100 text-stone-600">
                        <Users size={14} aria-hidden />
                      </div>
                      <h2 className="hs-strip-title text-stone-400 tracking-widest uppercase font-black text-[10px]">
                        Filters
                      </h2>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => { resetFilters(); fetchUsers(); }}
                      className="!h-8 px-3 text-[10px] font-black uppercase tracking-widest text-stone-400 hover:text-teal-600 border border-stone-200 rounded-lg bg-white"
                    >
                      Reset & Refresh
                    </Button>
                  </div>
                  <div className="p-8">
                    <div className="grid items-end gap-6 md:grid-cols-12">
                      <div className="md:col-span-12 lg:col-span-5">
                        <Field label="Search Registry">
                          <div className="group relative">
                            <Search
                              className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-stone-400 transition-colors group-focus-within:text-teal-600"
                              aria-hidden
                            />
                            <Input
                              value={query}
                              onChange={(e) => updateFilter("query", e.target.value)}
                              placeholder="Name, username, email, or user ID…"
                              className="!h-12 border-stone-200 pl-11 font-medium transition-[border-color,box-shadow] focus:border-teal-500/50 focus:ring-4 focus:ring-teal-500/5"
                            />
                          </div>
                        </Field>
                      </div>
                      <div className="md:col-span-6 lg:col-span-3">
                        <Field label="Access Level">
                          <Select
                            value={roleFilter}
                            onChange={(e) => {
                              updateFilter("role", e.target.value);
                            }}
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
                        <Field label="Account Status">
                          <Select
                            value={statusFilter}
                            onChange={(e) => {
                              updateFilter("status", e.target.value);
                            }}
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
                        { key: "q", label: "Query", value: query, onClear: () => updateFilter("query", "") },
                        {
                          key: "role",
                          label: "Access",
                          value: roleFilter !== "all" ? ROLE_NAME_LABELS[roleFilter] || roleFilter : "",
                          onClear: () => updateFilter("role", "all"),
                        },
                        {
                          key: "status",
                          label: "Status",
                          value:
                            statusFilter !== "all"
                              ? USER_ACCOUNT_STATUS_FILTER_LABELS[statusFilter] || statusFilter
                              : "",
                          onClear: () => updateFilter("status", "all"),
                        },
                      ]}
                      onClearAll={resetFilters}
                    />
                  </div>
                </Card>

                <Card className="mt-6 overflow-hidden border-stone-200 !p-0 shadow-sm rounded-2xl">
                    <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/50 px-8 py-4">
                      <h2 className="hs-strip-title uppercase tracking-[0.2em] text-[10px] font-black text-stone-400">System Accounts</h2>
                      <div className="text-[10px] font-mono font-bold text-stone-400 uppercase tracking-widest leading-none">
                        {listMeta?.total ?? sortedRows.length} accounts matching
                      </div>
                    </div>
                    <Table
                        embedded={true}
                        caption={`${listMeta?.total ?? users.length} staff accounts`}
                        ariaLabel="User accounts and roles"
                        sortColumn={sortColumn}
                        sortDirection={sortDirection}
                        onSortChange={onSortChange}
                        columns={[
                            {
                              key: "user_id",
                              label: "RECORD ID",
                              sortable: true,
                              sortKey: "user_id",
                              className: "pl-8 w-32",
                            },
                            { key: "user", label: "NAME", sortable: true, sortKey: "user" },
                            { key: "username", label: "USERNAME", sortable: true, sortKey: "username", className: "text-center" },
                            { key: "email", label: "EMAIL", sortable: true, sortKey: "email" },
                            { key: "role", label: "ACCESS", sortable: true, sortKey: "role", className: "text-center" },
                            { key: "status", label: "STATUS", sortable: true, sortKey: "status", className: "text-center" },
                            { key: "actions", label: "", className: "text-right px-8 w-32" },
                        ]}
                    rows={sortedRows.map((row) => {
                        const displayName = [row.first_name, row.last_name].filter(Boolean).join(" ").trim() || "—";
                        const isSelf = row.user_id === currentUser?.user_id;
                        return (
                         <tr
                            key={row.user_id}
                            className="border-t border-stone-100 transition-colors hover:bg-stone-50"
                        >
                            <td className="pl-8 py-5 align-middle">
                              <ResourceIdCell id={row.user_id} prefix="USER" />
                            </td>
                            <td className="py-5">
                              <span className="text-xs font-bold text-stone-900 leading-tight">{displayName}</span>
                            </td>
                            <td className="py-5 text-center font-mono text-[11px] text-stone-600 font-bold">{row.username}</td>
                            <td className="py-5 text-xs tabular-nums text-stone-500 font-medium">{row.email || "—"}</td>

                            <td className="py-5 text-center">
                                <StatusBadge size="sm">{row?.role?.role_name || "—"}</StatusBadge>
                            </td>
                            <td className="py-5 text-center">
                                <StatusBadge size="sm">{row.is_active ? "active" : "inactive"}</StatusBadge>
                            </td>
                            <td className="px-8 py-5 text-right">
                                <div className="flex items-center justify-end gap-2">
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => (window.location.href = `/admin/users/${row.user_id}`)}
                                        aria-label={`View user ${row.username}`}
                                        className="!h-8 !w-8 !p-0 flex items-center justify-center rounded-lg border-stone-200"
                                        title="View Details"
                                    >
                                        <Eye size={12} className="text-stone-600" />
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => (window.location.href = `/admin/users/${row.user_id}/edit`)}
                                        aria-label={`Edit user ${row.username}`}
                                        className={`!h-8 !w-8 !p-0 flex items-center justify-center rounded-lg border-stone-200 ${isSelf ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        title={isSelf ? "Account management restricted for active session." : "Edit Profile"}
                                        disabled={isSelf}
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
                                        onClick={() => {
                                            setConfirmToggleUser(row);
                                            setConfirmInput("");
                                        }}
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
              </ResourceView>
          </>
        )}
      </div>
    </StandardPage>
  );
}
