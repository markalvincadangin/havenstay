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
import Alert from "@/components/ui/Alert";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
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
  const [apiError, setApiError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [confirmToggleUser, setConfirmToggleUser] = useState(null);
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
  const { data: _summaryData, isValidating: _summaryValidating } = useSWR(
    !authLoading && currentUser && canAccess ? "/api/reports/user-summary" : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  );
  const { rows: users = [], meta: listMeta = null } = useMemo(() => {
    if (!usersData) return { rows: [], meta: null };
    return normalizePaginatedList(usersData);
  }, [usersData]);
  const loading = !usersData && !usersError;
  const activeCount = useMemo(() => users.filter((u) => u.is_active).length, [users]);
  const adminCount = useMemo(
    () => users.filter((u) => safeLower(u?.role?.role_name) === "admin").length,
    [users]
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
      title="Users"
      subtitle="Manage staff and admin accounts."
      breadcrumbs={<Breadcrumbs items={[{ label: "Administration" }, { label: "Users" }]} />}
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
        {apiError && (
          <Alert variant="error" title="Request Error">
            {apiError}
          </Alert>
        )}
        {viewDenied && (
          <Alert variant="warning" title="Access restricted" data-testid="access-denied-users">
            You do not have permission to view this page. Only administrators can open the user directory.
            Contact an admin if you need changes to accounts or roles.
          </Alert>
        )}
        {!viewDenied && (
          <div className="space-y-6">
            {confirmToggleUser && (
              <Card className="border-rose-200 bg-rose-50/50 p-8 shadow-xl">
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
            <div className="grid gap-4 sm:grid-cols-3">
              <KpiCard label="Total Personnel" value={listMeta?.total ?? users.length} icon={Users} sub="Matching filters" isSyncing={isSyncing} className="hs-glass-effect" />
              <KpiCard label="Active Sessions" value={activeCount} icon={UserCheck} sub="On this page" isSyncing={isSyncing} className="hs-glass-effect" />
              <KpiCard label="Administrators" value={adminCount} icon={ShieldCheck} sub="On this page" isSyncing={isSyncing} className="hs-glass-effect" />
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
                  return (
                    <Link
                      key={row.user_id}
                      href={`/admin/users/${row.user_id}`}
                      className="group block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
                    >
                      <Card className="relative h-full flex flex-col !p-0 overflow-hidden rounded-2xl border-stone-200 bg-white transition-all duration-300 group-hover:border-teal-200 group-hover:shadow-xl group-hover:shadow-teal-900/5 group-hover:-translate-y-1 hs-glass-effect">
                        {/* Card Header Strip */}
                        <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/50 px-5 py-3.5">
                          <ResourceIdCell id={row.user_id} type="user" />
                          <StatusBadge size="xs" variant={row.is_active ? "success" : "neutral"} className="shadow-sm">
                            {row.is_active ? "active" : "inactive"}
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
                                setConfirmToggleUser(row);
                                setConfirmInput("");
                              }}
                              className={`!h-8 !w-8 !p-0 border bg-white shadow-sm ring-1 ring-inset ${row.is_active ? 'border-stone-200 ring-transparent text-rose-400 hover:text-rose-600 hover:border-rose-300' : 'border-stone-200 ring-transparent text-emerald-400 hover:text-emerald-600 hover:border-emerald-300'}`}
                              title={row.is_active ? "Revoke Access" : "Grant Access"}
                            >
                              {row.is_active ? <ShieldOff size={14} /> : <UserCheck size={14} />}
                            </Button>
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
        title={isRegistering ? "Register Staff" : "Administer Account"}
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
