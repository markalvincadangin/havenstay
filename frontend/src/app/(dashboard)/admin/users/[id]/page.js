"use client";
import { Shield, User, Mail, ShieldCheck, Activity, Edit2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { canManageUsers } from "@/lib/auth";
import { formatDateString } from "@/lib/formatters";
import { normalizePaginatedList } from "@/lib/pagination";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import { Table } from "@/components/ui/Table";
import TablePagination from "@/components/ui/TablePagination";
import ResourceView from "@/components/ui/ResourceView";
import StandardPage from "@/components/ui/StandardPage";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { FormSection } from "@/components/ui/FormSection";
import ResourceIdCell from "@/components/ui/ResourceIdCell";
import { usePaginatedFilters } from "@/hooks/usePaginatedFilters";
import { SideSheetOverlay } from "@/components/ui/SideSheetOverlay";
import { UserQuickEditForm } from '@/features/admin/users/components/UserQuickEditForm';
export default function UserDetailPage() {
    const router = useRouter();
    const params = useParams();
    const userId = params?.id;
    const { user: currentUser, authLoading } = useAuth();
    const { page, setPage, perPage, setPerPage, queryString } = usePaginatedFilters({
        initialFilters: {},
        buildExtraParams: () => ({ user_id: userId }),
    });
    const canManage = useMemo(() => canManageUsers(currentUser), [currentUser]);
    const { data: uData, error: uError } = useSWR(
        currentUser && userId && canManage ? `/api/users/${userId}` : null,
        fetcher
    );
    const { data: aData, error: aError, isValidating: isSyncingActions, mutate: refetchActions } = useSWR(
        currentUser && userId && canManage ? `/api/audit-logs${queryString}` : null,
        fetcher,
        { fallbackData: { data: [], meta: { total: 0 } }, keepPreviousData: true }
    );
    const loading = !uData && !uError;
    const { rows: auditLogsList, meta: auditMeta } = useMemo(() => normalizePaginatedList(aData), [aData]);
    const isSelf = String(userId) === String(currentUser?.user_id);
    const [editingUser, setEditingUser] = useState(null);
    if (authLoading || loading) {
        return <StandardPage title="Loading User..." loading={true} />;
    }
    if (uError) {
        return (
            <StandardPage title="Error" breadcrumbs={<Breadcrumbs items={[{ label: "Administration" }, { label: "User Directory", href: "/admin/users" }]} />}>
                <Alert variant="error" title="Failed to load user account">
                    {uError?.message || "Internal system error occurred while retrieving user profile."}
                </Alert>
            </StandardPage>
        );
    }
    return (
        <StandardPage
            title={uData ? `${uData.first_name} ${uData.last_name}` : "User Profile"}
            subtitle="User account details and recent activity."
            breadcrumbs={
                <Breadcrumbs
                    items={[
                        { label: "Users", href: "/admin/users" },
                        { label: uData?.username || "Detail" }
                    ]}
                />
            }
            actions={
                <div className="flex items-center gap-3">
                    <Button
                        variant="secondary"
                        onClick={() => router.push("/admin/users")}
                        className="!h-11 px-6 text-[10px] font-black uppercase tracking-widest border-stone-200"
                    >
                        Back to Directory
                    </Button>
                    <Button
                        variant="primary"
                        onClick={() => setEditingUser(uData)}
                        disabled={isSelf} // Self-management restricted as per security audit
                        className="!h-11 px-8 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-teal-900/10 border-0"
                    >
                        <Edit2 size={14} className="mr-2" />
                        Edit User
                    </Button>
                </div>
            }
        >
            <div className="mx-auto w-full max-w-4xl space-y-8">
                {!canManage && (
                    <Alert variant="warning" title="Access Restricted">
                        Only administrators are authorized to view detailed system user profiles.
                    </Alert>
                )}
                <div className="grid gap-6 lg:grid-cols-3">
                    <div className="lg:col-span-2 space-y-6">
                        <FormSection title="User Details" icon={User} className="hs-glass-effect">
                            <div className="grid gap-8 sm:grid-cols-2">
                                <div>
                                    <span className="block text-[9px] font-black uppercase tracking-widest text-stone-400 mb-1">Name</span>
                                    <span className="text-sm font-bold text-stone-900">{uData?.first_name} {uData?.last_name}</span>
                                </div>
                                <div>
                                    <span className="block text-[9px] font-black uppercase tracking-widest text-stone-400 mb-1">Email</span>
                                    <div className="flex items-center gap-2">
                                        <Mail size={12} className="text-stone-400" />
                                        <span className="text-sm font-medium text-stone-700">{uData?.email || "—"}</span>
                                    </div>
                                </div>
                                <div>
                                    <span className="block text-[9px] font-black uppercase tracking-widest text-stone-400 mb-1">Username</span>
                                    <span className="font-mono text-sm font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-100">@{uData?.username}</span>
                                </div>
                                <div>
                                    <span className="block text-[9px] font-black uppercase tracking-widest text-stone-400 mb-1">Resource ID</span>
                                    <ResourceIdCell id={userId} type="user" />
                                </div>
                            </div>
                        </FormSection>
                        <FormSection title="Role & Status" icon={Shield} className="hs-glass-effect">
                            <div className="grid gap-8 sm:grid-cols-2">
                                <div>
                                    <span className="block text-[9px] font-black uppercase tracking-widest text-stone-400 mb-1">Role</span>
                                    <StatusBadge>{uData?.role?.role_name}</StatusBadge>
                                </div>
                                <div>
                                    <span className="block text-[9px] font-black uppercase tracking-widest text-stone-400 mb-1">Account Status</span>
                                    <div className="flex items-center gap-2">
                                        <StatusBadge>{uData?.is_active ? "active" : "inactive"}</StatusBadge>
                                        {isSelf && (
                                            <span className="text-[10px] font-bold text-stone-400 uppercase italic">Active Session</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </FormSection>
                    </div>
                    <div className="space-y-6">
                        <Card className="bg-stone-50 border-stone-200 p-6 hs-glass-effect">
                            <h3 className="hs-strip-title text-stone-400 uppercase tracking-widest font-black text-[9px] mb-4">Activity Summary</h3>
                            <div className="space-y-4">
                                <div className="flex items-start gap-3">
                                    <Activity size={16} className="text-teal-600 mt-0.5" />
                                    <div>
                                        <span className="block text-xs font-black text-stone-900">Total Actions</span>
                                        <span className="block text-xl font-mono font-black text-stone-900 tabular-nums mt-0.5">
                                            {auditMeta?.total || 0}
                                        </span>
                                        <span className="block text-[10px] text-stone-400 font-bold uppercase tracking-widest mt-1">Logged Events</span>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>
                <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm mt-8 hs-glass-effect">
                    <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/50 px-8 py-5">
                        <div className="flex items-center gap-3">
                            <div className="flex size-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 shadow-sm border border-indigo-100/50">
                                <Activity size={16} />
                            </div>
                            <h3 className="hs-strip-title uppercase tracking-[0.2em] text-[10px] font-black text-stone-400">Activity Log</h3>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="text-[10px] font-bold text-stone-400 uppercase tracking-widest leading-none">
                                Showing {auditLogsList.length} of {auditMeta?.total || 0} actions
                            </div>
                        </div>
                    </div>
                    <ResourceView
                        isLoading={!aData && !aError}
                        isSyncing={isSyncingActions}
                        error={aError}
                        isEmpty={auditLogsList.length === 0}
                        onRetry={refetchActions}
                        skeleton={
                            <div className="p-8 space-y-4">
                                {[...Array(5)].map((_, i) => (
                                    <div key={i} className="h-10 w-full animate-pulse bg-stone-100 rounded-lg" />
                                ))}
                            </div>
                        }
                        emptyProps={{
                            title: "No activity recorded",
                            description: "This account has not triggered any logged events yet."
                        }}
                    >
                        <Table
                            embedded
                            columns={[
                                { key: 'date', label: 'Date', className: "pl-8 w-48" },
                                { key: 'action', label: 'Action', className: "text-center" },
                                { key: 'entity', label: 'Resource', className: "text-center pr-8" }
                            ]}
                            rows={auditLogsList.map((log) => (
                                <tr key={log.id} className="border-t border-stone-100/80 hover:bg-stone-50/50 transition-colors">
                                    <td className="pl-8 py-5">
                                        <div className="flex flex-col">
                                            <span className="font-mono text-[10px] font-black text-stone-900 tabular-nums leading-none">
                                                {formatDateString(log.changed_at)}
                                            </span>
                                            <span className="font-mono text-[9px] font-bold text-stone-400 uppercase tracking-tight tabular-nums mt-1.5">
                                                {new Date(log.changed_at).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit", second: "2-digit" })}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="py-5 text-center">
                                        <StatusBadge size="sm">{log.action}</StatusBadge>
                                    </td>
                                    <td className="pr-8 py-5">
                                        <div className="flex flex-col items-center gap-1.5">
                                            <span className="text-[10px] font-black text-stone-500 uppercase tracking-widest leading-none">{log.target_table}</span>
                                            <ResourceIdCell
                                                id={log.record_id}
                                                type={
                                                    log.target_table === 'users' ? 'user' :
                                                        log.target_table === 'tenants' ? 'tenant' :
                                                            log.target_table === 'contracts' ? 'contract' :
                                                                log.target_table === 'bills' ? 'bill' :
                                                                    log.target_table === 'bill_line_items' ? 'bill' :
                                                                        log.target_table === 'payments' ? 'payment' :
                                                                            log.target_table === 'rooms' ? 'room' :
                                                                                log.target_table === 'bed_spaces' ? 'bed_space' : 'user'
                                                }
                                            />
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        />
                    </ResourceView>
                    <TablePagination
                        meta={auditMeta}
                        page={page}
                        perPage={perPage}
                        onPageChange={setPage}
                        onPerPageChange={(n) => {
                            setPage(1);
                            setPerPage(n);
                        }}
                        disabled={loading || isSyncingActions}
                        className="hs-glass-effect"
                    />
                </Card>
            </div>
            <SideSheetOverlay
                isOpen={!!editingUser}
                onClose={() => setEditingUser(null)}
                title="USER DETAILS"
            >
                {editingUser && (
                    <UserQuickEditForm
                        user={editingUser}
                        onSuccess={() => {
                            setEditingUser(null);
                            // mutate handled internally by UserQuickEditForm or we can refresh parent
                            router.refresh();
                        }}
                        onCancel={() => setEditingUser(null)}
                    />
                )}
            </SideSheetOverlay>
        </StandardPage>
    );
}
