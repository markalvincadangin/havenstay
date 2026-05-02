"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  _Edit2, Search, Shield, Users, UserPlus, UserCheck, ShieldCheck,
  _Eye, Mail, _Fingerprint, _ChevronRight, ShieldOff, _Zap
} from "lucide-react";
import useSWR from "swr";
import { apiRequest, fetcher } from "@/lib/api";
import { flattenApiErrors } from "@/lib/errors";
import { canManageUsers } from "@/lib/auth";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { useTableSort } from "@/hooks/useTableSort";
import { sortClientRows } from "@/lib/tableSort";
import { useToasts } from "@/context/ToastContext";
import Alert from "@/components/ui/Alert";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import ConfirmationDialog from "@/components/ui/ConfirmationDialog";
import FilterChips from "@/components/ui/FilterChips";
import { Field, Input, Select } from "@/components/ui/Fields";
import { SkeletonGridPage } from "@/components/ui/Skeleton";
import PageHeaderActions from "@/components/ui/PageHeaderActions";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { KpiCard } from "@/components/ui/KpiCard";
import ResourceView from "@/components/ui/ResourceView";
import TablePagination from "@/components/ui/TablePagination";
import StandardPage from "@/components/ui/StandardPage";
import ResourceIdCell from "@/components/ui/ResourceIdCell";
import FilterPanelCard from "@/components/ui/FilterPanelCard";
import Avatar from "@/components/ui/Avatar";
import Link from "next/link";
import { ROLE_NAME_LABELS, USER_ACCOUNT_STATUS_FILTER_LABELS } from "@/lib/constants";
import { normalizePaginatedList } from "@/lib/pagination";
import { usePaginatedFilters } from "@/hooks/usePaginatedFilters";
import { SideSheetOverlay } from "@/components/ui/SideSheetOverlay";
import { QuickEditRowAction } from "@/components/ui/QuickEditRowAction";
import { UserQuickEditForm } from '@/features/admin/users/components/UserQuickEditForm';
function safeLower(value) {
  return String(value ?? "").toLowerCase();
}
export default function UsersPage() {
  const _router = useRouter();
  const { user: currentUser, authLoading, isUnauthorized } = useAuthGuard();
  const { showToast } = useToasts();
  const { filters, updateFilter, resetFilters, page, setPage, perPage, setPerPage, queryString } =
    usePaginatedFilters({
      initialFilters: { query: "", role: "all", status: "all" },
      debounceKeys: ["query"],
      buildExtraParams: ({ filters: current, debounced }) => {
        const extra = {};
        const q = String(debounced.query ?? "").trim();
        if (q) extra.q = q;
        if (current.role !== "all") extra.role = current.role;
        if (current.status !== "all") extra.account_status = current.status;
        return extra;
      },
    });
  const [actionLoading, setActionLoading] = useState(null);
  const [confirmDeactivateUser, setConfirmDeactivateUser] = useState(null);
  const [confirmReactivateUser, setConfirmReactivateUser] = useState(null);
  const [confirmRestoreUser, setConfirmRestoreUser] = useState(null);
  const [confirmInput, setConfirmInput] = useState("");
  const [editingUser, setEditingUser] = useState(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const { sortColumn, sortDirection, _onSortChange } = useTableSort();
  const canAccess = useMemo(() => canManageUsers(currentUser), [currentUser]);
  const viewDenied = !authLoading && currentUser !== null && !canAccess;
  const { data: usersData, error: usersError, isValidating: isSyncing, mutate: refetchUsers } = useSWR(
    !authLoading && currentUser && canAccess ? `/api/users${queryString}` : null,
    fetcher,
    { keepPreviousData: true }
  );
  const { data: summaryData, isValidating: summaryValidating } = useSWR(
    !authLoading && currentUser && canAccess ? "/api/users/summary" : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 10000 }
  );
  const { rows: users = [], meta: listMeta = null } = useMemo(() => {
    if (!usersData) return { rows: [], meta: null };
    return normalizePaginatedList(usersData);
  }, [usersData]);
  const loading = !usersData && !usersError;
  const stats = useMemo(() => summaryData?.data || {}, [summaryData]);
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
  async function handleDeactivate(user) {
    if (user.username !== confirmInput) {
      showToast(`Access Denied: Input '${confirmInput}' does not match username '${user.username}'.`, "error");
      return;
    }
    setActionLoading(user.user_id);
    try {
      await apiRequest(`/api/users/${user.user_id}/deactivate`, { method: "POST" });
      setConfirmDeactivateUser(null);
      setConfirmInput("");
      refetchUsers();
      showToast(`User @${user.username} deactivated.`, "success");
    } catch (uError) {
      showToast(flattenApiErrors(uError), "error");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReactivate(user) {
    setActionLoading(user.user_id);
    try {
      await apiRequest(`/api/users/${user.user_id}/reactivate`, { method: "POST" });
      setConfirmReactivateUser(null);
      refetchUsers();
      showToast(`User @${user.username} access restored.`, "success");
    } catch (uError) {
      showToast(flattenApiErrors(uError), "error");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRestore(user) {
    setActionLoading(user.user_id);
    try {
      await apiRequest(`/api/users/${user.user_id}/restore`, { method: "POST" });
      setConfirmRestoreUser(null);
      refetchUsers();
      showToast(`User @${user.username} account restored.`, "success");
    } catch (uError) {
      showToast(flattenApiErrors(uError), "error");
    } finally {
      setActionLoading(null);
    }
  }
  if (isUnauthorized) return null;
  return (
    <StandardPage
      title="Users"
      subtitle="Manage staff and admin accounts."
      loading={authLoading || loading}
      skeleton={<SkeletonGridPage cards={8} />}
      actions={
        <PageHeaderActions
          onClick={() => setIsRegistering(true)}
          ctaLabel="Register Account"
          ctaIcon={UserPlus}
          ctaClassName="!h-11 rounded-xl bg-teal-600 px-8 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-teal-900/10"
          user={currentUser}
        />
      }
    >
      <div className="space-y-6">
        {viewDenied && (
          <Alert variant="warning" title="Access restricted" data-testid="access-denied-users">
            You do not have permission to view this page. Only administrators can open the user directory.
            Contact an admin if you need changes to accounts or roles.
          </Alert>
        )}
        {!viewDenied && (
          <div className="space-y-6">
            <ConfirmationDialog
              open={!!confirmDeactivateUser}
              title="Confirm Account Deactivation"
              description={`Deactivating @${confirmDeactivateUser?.username} will immediately revoke all system session tokens. They will be unable to log in until reactivated.`}
              confirmLabel="CONFIRM DEACTIVATION"
              isDanger
              isLoading={actionLoading !== null}
              onConfirm={() => handleDeactivate(confirmDeactivateUser)}
              onCancel={() => {
                setConfirmDeactivateUser(null);
                setConfirmInput("");
              }}
            >
              <div className="space-y-4">
                <p className="text-xs font-medium text-stone-500">
                  Type the username <span className="font-bold text-rose-600">{confirmDeactivateUser?.username}</span> below to confirm this security action.
                </p>
                <Input
                  autoFocus
                  value={confirmInput}
                  onChange={(e) => setConfirmInput(e.target.value)}
                  placeholder={confirmDeactivateUser?.username}
                  className="!h-11 border-stone-200 focus:border-rose-500/50"
                />
              </div>
            </ConfirmationDialog>

            <ConfirmationDialog
              open={!!confirmReactivateUser}
              title="Restore System Access"
              description={`Are you sure you want to reactivate @${confirmReactivateUser?.username}? This will allow the user to sign in and perform actions according to their assigned role.`}
              confirmLabel="Reactivate Account"
              isLoading={actionLoading !== null}
              onConfirm={() => handleReactivate(confirmReactivateUser)}
              onCancel={() => setConfirmReactivateUser(null)}
            />

            <ConfirmationDialog
              open={!!confirmRestoreUser}
              title="Restore Archived Account"
              description={`You are about to restore @${confirmRestoreUser?.username} from the historical registry. This will make the profile visible again in the standard directory.`}
              confirmLabel="Restore Account"
              isLoading={actionLoading !== null}
              onConfirm={() => handleRestore(confirmRestoreUser)}
              onCancel={() => setConfirmRestoreUser(null)}
            />

            <div className="grid gap-4 sm:grid-cols-4">
              <KpiCard label="Total Capacity" value={stats.total_users ?? 0} icon={Users} sub="SYSTEM-WIDE" isSyncing={summaryValidating || isSyncing} className="hs-glass-effect" />
              <KpiCard label="Active Accounts" value={stats.active_users ?? 0} icon={UserCheck} sub="SYSTEM-WIDE" isSyncing={summaryValidating || isSyncing} className="hs-glass-effect" />
              <KpiCard label="Inactive Accounts" value={stats.inactive_users ?? 0} icon={ShieldOff} sub="SYSTEM-WIDE" isWarning={stats.inactive_users > 0} isSyncing={summaryValidating || isSyncing} className="hs-glass-effect" />
              <KpiCard label="Administrators" value={stats.admin_count ?? 0} icon={ShieldCheck} sub="SYSTEM-WIDE" isSyncing={summaryValidating || isSyncing} className="hs-glass-effect" />
            </div>
            <FilterPanelCard icon={Users}>
              <div className="grid items-end gap-6 md:grid-cols-12">
                <div className="md:col-span-12 lg:col-span-6">
                  <Field label="Search Users">
                    <div className="group relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-stone-400 transition-colors group-focus-within:text-teal-600" aria-hidden />
                      <Input
                        value={filters.query}
                        onChange={(e) => updateFilter("query", e.target.value)}
                        placeholder="Name, username, email, or user ID…"
                        className="!h-12 border-stone-200 pl-11 font-medium focus:border-teal-500/50 focus:ring-4 focus:ring-teal-500/5 transition-[border-color,box-shadow]"
                      />
                    </div>
                  </Field>
                </div>
                <div className="md:col-span-6 lg:col-span-3">
                  <Field label="Role">
                    <Select
                      value={filters.role}
                      onChange={(e) => updateFilter("role", e.target.value)}
                      className="!h-12 border-stone-200 font-bold focus:border-teal-500/50"
                    >
                      <option value="all">All roles</option>
                      {Object.entries(ROLE_NAME_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </Select>
                  </Field>
                </div>
                <div className="md:col-span-6 lg:col-span-3">
                  <Field label="Account Status">
                    <Select
                      value={filters.status}
                      onChange={(e) => updateFilter("status", e.target.value)}
                      className="!h-12 border-stone-200 font-bold focus:border-teal-500/50"
                    >
                      {Object.entries(USER_ACCOUNT_STATUS_FILTER_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </Select>
                  </Field>
                </div>
              </div>
              <FilterChips
                className="mt-6"
                items={[
                  { key: "q", label: "Query", value: filters.query, onClear: () => updateFilter("query", "") },
                  {
                    key: "role",
                    label: "Role",
                    value: filters.role !== "all" ? ROLE_NAME_LABELS[filters.role] || filters.role : "",
                    onClear: () => updateFilter("role", "all"),
                  },
                  {
                    key: "status",
                    label: "Status",
                    value: filters.status !== "all" ? USER_ACCOUNT_STATUS_FILTER_LABELS[filters.status] || filters.status : "",
                    onClear: () => updateFilter("status", "all"),
                  },
                ]}
                onClearAll={resetFilters}
              />
            </FilterPanelCard>
            <ResourceView
              isLoading={loading}
              isSyncing={isSyncing}
              error={usersError}
              isEmpty={users.length === 0}
              onRetry={() => refetchUsers()}
              skeleton={<SkeletonGridPage cards={8} />}
              emptyProps={{
                title: "No users match filters",
                description: "Clear filters or adjust search criteria to see system accounts."
              }}
            >
              <div className="mt-2 grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {sortedRows.map((row) => {
                  const displayName = [row.first_name, row.last_name].filter(Boolean).join(" ").trim() || "—";
                    const isSelf = row.user_id === currentUser?.user_id;
                    const isArchived = !!row.deleted_at;
                    return (
                      <Link
                        key={row.user_id}
                        href={`/admin/users/${row.user_id}`}
                        className={`group block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 ${
                          isArchived ? 'opacity-60 grayscale-[0.5]' : ''
                        }`}
                      >
                        <Card className={`relative h-full flex flex-col !p-0 overflow-hidden rounded-2xl border-stone-200 bg-white transition-all duration-300 group-hover:border-teal-200 group-hover:shadow-xl group-hover:shadow-teal-900/5 group-hover:-translate-y-1 hs-glass-effect ${
                          isArchived ? 'bg-stone-50/50' : ''
                        }`}>
                          {/* Card Header Strip */}
                          <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/50 px-5 py-3.5">
                            <ResourceIdCell id={row.user_id} type="user" />
                            <StatusBadge size="xs" variant={isArchived ? "neutral" : (row.is_active ? "success" : "neutral")} className="shadow-sm">
                              {isArchived ? "archived" : (row.is_active ? "active" : "inactive")}
                            </StatusBadge>
                          </div>
                        {/* Hero Identity Section */}
                        <div className="p-6 pb-4">
                          <div className="flex items-center gap-4">
                            <Avatar
                              user={{ first_name: row.first_name, last_name: row.last_name }}
                              variant="teal"
                              size="lg"
                              className="group-hover:scale-105 transition-transform"
                            />
                            <div className="min-w-0 flex-1">
                              <h3 className="text-base font-black text-stone-900 leading-[1.2] group-hover:text-teal-700 transition-colors line-clamp-2">
                                {displayName}
                              </h3>
                              <p className="mt-1 text-[10px] font-black tracking-widest text-teal-600/70 uppercase">
                                Role: {row?.role?.role_name || "—"}
                              </p>
                            </div>
                          </div>
                          <div className="mt-5 space-y-2 border-l-2 border-stone-50 pl-4 py-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-mono font-bold text-stone-400">@</span>
                              <span className="text-[11px] font-mono font-bold text-stone-600 tracking-tight lowercase">{row.username}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Mail size={10} className="text-stone-300" />
                              <span className="text-[11px] font-medium text-stone-500 truncate" title={row.email}>
                                {row.email || "—"}
                              </span>
                            </div>
                          </div>
                        </div>
                        {/* Contextual Footer Well */}
                        <div className="flex items-center justify-between border-t border-stone-100 bg-stone-50/30 px-6 py-3.5 mt-auto transition-colors group-hover:bg-teal-50/20">
                          <span className="text-[10px] font-black tracking-[0.15em] text-stone-400 group-hover:text-teal-600 transition-colors uppercase">
                            Actions
                          </span>
                          <div className="flex items-center gap-2">
                            {isArchived ? (
                              <Button
                                variant="primary"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setConfirmRestoreUser(row);
                                }}
                                className="!h-8 rounded-lg px-4 text-[10px] font-black uppercase tracking-widest bg-teal-600 text-white shadow-sm"
                              >
                                Restore
                              </Button>
                            ) : (
                              <>
                                <QuickEditRowAction
                                  disabled={isSelf}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setEditingUser(row);
                                  }}
                                  className="shadow-sm"
                                  title="Update Details"
                                />
                                <Button
                                  variant="ghost"
                                  loading={actionLoading === row.user_id}
                                  disabled={isSelf}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (row.is_active) {
                                      setConfirmDeactivateUser(row);
                                    } else {
                                      setConfirmReactivateUser(row);
                                    }
                                    setConfirmInput("");
                                  }}
                                  className={`!h-8 !w-8 !p-0 border bg-white shadow-sm ring-1 ring-inset ${row.is_active ? 'border-stone-200 ring-transparent text-rose-400 hover:text-rose-600 hover:border-rose-300' : 'border-stone-200 ring-transparent text-emerald-400 hover:text-emerald-600 hover:border-emerald-300'}`}
                                  title={row.is_active ? "Revoke Access" : "Grant Access"}
                                >
                                  {row.is_active ? <ShieldOff size={14} /> : <UserCheck size={14} />}
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </ResourceView>
            {listMeta && listMeta.total > 0 && (
              <TablePagination
                meta={listMeta}
                page={page}
                perPage={perPage}
                onPageChange={setPage}
                onPerPageChange={(v) => { setPage(1); setPerPage(v); }}
                disabled={loading || isSyncing}
                className="mt-4 rounded-2xl border border-stone-200 bg-white hs-glass-effect"
              />
            )}
          </div>
        )}
      </div>
      <SideSheetOverlay
        isOpen={isRegistering || !!editingUser}
        onClose={() => {
          setIsRegistering(false);
          setEditingUser(null);
        }}
        title={isRegistering ? "REGISTER USER" : "USER DETAILS"}
      >
        <UserQuickEditForm
          user={editingUser}
          onSuccess={() => {
            setIsRegistering(false);
            setEditingUser(null);
            refetchUsers();
          }}
          onCancel={() => {
            setIsRegistering(false);
            setEditingUser(null);
          }}
        />
      </SideSheetOverlay>
    </StandardPage>
  );
}
