"use client";
import { Shield, User, Mail, ShieldCheck, Activity, Edit2, Calendar, History } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import useSWR from "swr";
import { fetcher, apiRequest } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { canManageUsers } from "@/lib/auth";
import { formatDateString } from "@/lib/formatters";
import { normalizePaginatedList } from "@/lib/pagination";
import Alert from "@/components/ui/Alert";
import RecordStateAlert from "@/components/ui/RecordStateAlert";
import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import { Table } from "@/components/ui/Table";
import { formatTimestamp } from "@/lib/formatters";
import TablePagination from "@/components/ui/TablePagination";
import ResourceView from "@/components/ui/ResourceView";
import StandardPage from "@/components/ui/StandardPage";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { FormSection } from "@/components/ui/FormSection";
import ResourceIdCell from "@/components/ui/ResourceIdCell";
import { usePaginatedFilters } from "@/hooks/usePaginatedFilters";
import { SideSheetOverlay } from "@/components/ui/SideSheetOverlay";
import { UserQuickEditForm } from '@/features/admin/users/components/UserQuickEditForm';
import LifecycleActions from "@/components/ui/LifecycleActions";
import ConfirmationDialog from "@/components/ui/ConfirmationDialog";
import DetailHeader from "@/components/ui/DetailHeader";
import { useToasts } from "@/context/ToastContext";
import { flattenApiErrors } from "@/lib/errors";
import { Input } from "@/components/ui/Fields";
import Avatar from "@/components/ui/Avatar";
import MetricItem from "@/components/ui/MetricItem";
import DetailRow from "@/components/ui/DetailRow";
export default function UserDetailPage() {
    const router = useRouter();
    const params = useParams();
    const userId = params?.id;
    const { user: currentUser, authLoading } = useAuth();
    const { showToast } = useToasts();
    const { page, setPage, perPage, setPerPage, queryString } = usePaginatedFilters({
        initialFilters: {},
        buildExtraParams: () => ({ user_id: userId }),
    });
    const canManage = useMemo(() => canManageUsers(currentUser), [currentUser]);
    const { data: uData, error: uError, mutate: mutateUser } = useSWR(
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
    const [busyAction, setBusyAction] = useState("");
    const [isDeactivating, setIsDeactivating] = useState(false);
    const [isArchiving, setIsArchiving] = useState(false);
    const [confirmInput, setConfirmInput] = useState("");
    if (authLoading || loading) {
        return <StandardPage title="Loading User..." loading={true} />;
    }
    if (uError) {
        return (
            <StandardPage title="Error" breadcrumbs={<Breadcrumbs items={[{ label: "Administration" }, { label: "User Directory", href: "/admin/users" }]} />}>
                <Alert variant="error" title="Failed to load user account">
                    {uError?.status === 404 ? "This user account does not exist or has been permanently removed." : (uError?.message || "Internal system error occurred while retrieving user profile.")}
                </Alert>
            </StandardPage>
        );
    }
    const isArchived = !!uData?.deleted_at;
    const isActive = !!uData?.is_active;

    async function handleDeactivate() {
        if (uData.username !== confirmInput) {
            showToast("Username mismatch.", "error");
            return;
        }
        setBusyAction("deactivate");
        try {
            await apiRequest(`/api/users/${userId}/deactivate`, { method: "POST" });
            setIsDeactivating(false);
            setConfirmInput("");
            await mutateUser();
            showToast("User deactivated.", "success");
        } catch (e) {
            showToast(flattenApiErrors(e), "error");
        } finally {
            setBusyAction("");
        }
    }

    async function handleReactivate() {
        setBusyAction("reactivate");
        try {
            await apiRequest(`/api/users/${userId}/reactivate`, { method: "POST" });
            await mutateUser();
            showToast("Access restored.", "success");
        } catch (e) {
            showToast(flattenApiErrors(e), "error");
        } finally {
            setBusyAction("");
        }
    }

    async function handleArchive() {
        setBusyAction("archive");
        try {
            await apiRequest(`/api/users/${userId}/archive`, { method: "POST" });
            setIsArchiving(false);
            await mutateUser();
            showToast("User account archived.", "success");
        } catch (e) {
            showToast(flattenApiErrors(e), "error");
        } finally {
            setBusyAction("");
        }
    }

    async function handleRestore() {
        setBusyAction("restore");
        try {
            await apiRequest(`/api/users/${userId}/restore`, { method: "POST" });
            await mutateUser();
            showToast("User account restored.", "success");
        } catch (e) {
            showToast(flattenApiErrors(e), "error");
        } finally {
            setBusyAction("");
        }
    }
    const header = DetailHeader({
        type: "user",
        id: userId,
        title: uData ? `${uData.first_name} ${uData.last_name}` : "User Profile",
        subtitle: "User account details and forensic activity log.",
        status: isArchived ? "archived" : (isActive ? "active" : "inactive"),
        loading: authLoading || loading,
        listHref: "/admin/users",
        listLabel: "Users",
        detailLabel: uData?.username || "Detail"
    });

    return (
        <StandardPage
            {...header}
            actions={
                <div className="flex items-center gap-3">
                    <LifecycleActions
                        mode="user"
                        canManage={canManage}
                        isActive={isActive}
                        isArchived={isArchived}
                        isSelf={isSelf}
                        busyAction={busyAction}
                        onDeactivate={() => setIsDeactivating(true)}
                        onReactivate={handleReactivate}
                        onArchive={() => setIsArchiving(true)}
                        onRestore={handleRestore}
                    />
                    <div className="h-8 w-px bg-stone-200 mx-1" />
                    <Button
                        variant="primary"
                        onClick={() => setEditingUser(uData)}
                        disabled={isSelf || isArchived}
                        className="!h-11 px-8 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-teal-900/10 border-0"
                    >
                        <Edit2 size={14} className="mr-2" />
                        Edit User
                    </Button>
                </div>
            }
        >
            <div className="space-y-8">
                {!canManage && (
                    <Alert variant="warning" title="Access Restricted">
                        Only administrators are authorized to view detailed system user profiles.
                    </Alert>
                )}

                <RecordStateAlert show={isArchived} variant="archived">
                    This user account has been archived and soft-deleted. Access is revoked and the account is hidden from standard directory listings. Use "Restore Account" above to re-enable.
                </RecordStateAlert>

                <RecordStateAlert show={!isArchived && !isActive} variant="inactive">
                    This account is currently deactivated. System access is revoked across all platforms. Profile details remain visible for auditing purposes.
                </RecordStateAlert>

                <div className="grid gap-8 lg:grid-cols-12">
                    {/* --- Left Column: Overview & Security --- */}
                    <aside className="lg:col-span-4 space-y-6">
                        <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm hs-glass-effect">
                            <div className="bg-stone-50/50 border-b border-stone-100 px-8 py-8 flex flex-col items-center text-center">
                                <Avatar user={uData} size="xl" className="ring-4 ring-white shadow-xl" />
                                <h2 className="mt-6 text-xl font-black text-stone-900 tracking-tight flex flex-col items-center gap-2">
                                    {uData.first_name} {uData.last_name}
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-100">@{uData?.username}</span>
                                        {uData.oauth_provider === 'google' && (
                                            <div className="flex items-center gap-1 bg-blue-50 text-blue-600 text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border border-blue-100" title="Identity verified via Google OAuth">
                                                <ShieldCheck size={10} />
                                                Verified
                                            </div>
                                        )}
                                    </div>
                                </h2>
                                <div className="mt-4 flex flex-wrap justify-center gap-2">
                                    <StatusBadge size="sm">{uData?.role?.role_name}</StatusBadge>
                                    <StatusBadge variant={isArchived ? "neutral" : (isActive ? "success" : "neutral")} size="sm">
                                        {isArchived ? "archived" : (isActive ? "active" : "inactive")}
                                    </StatusBadge>
                                </div>
                            </div>
                            <div className="flex justify-center border-b border-stone-100 bg-stone-50/30 px-4 py-3">
                                <span className="text-xs font-bold uppercase tracking-widest text-stone-400">Quick Profile</span>
                            </div>
                            <div className="p-8 space-y-2">
                                <MetricItem
                                    label="Total Actions"
                                    value={auditMeta?.total || 0}
                                    icon={Activity}
                                />
                                <MetricItem
                                    label="Member Since"
                                    value={formatDateString(uData?.created_at)}
                                    icon={Calendar}
                                />
                                <MetricItem
                                    label="Last Access"
                                    value={uData?.last_login_at ? formatTimestamp(uData.last_login_at) : "NEVER"}
                                    icon={ShieldCheck}
                                />
                            </div>
                        </Card>

                        <Card className="bg-stone-50 border-stone-200 p-8 hs-glass-effect relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                <Shield size={80} className="text-teal-900" />
                            </div>
                            <h3 className="hs-strip-title text-stone-400 uppercase tracking-widest font-black text-[9px] mb-4">Account Security</h3>
                            <div className="space-y-4 relative z-10">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-stone-500 font-medium">Auth Method</span>
                                    <span className="font-bold text-stone-900 uppercase tracking-widest text-[10px]">
                                        {uData.oauth_provider ? `OAuth (${uData.oauth_provider})` : "Local Password"}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-stone-500 font-medium">Verification</span>
                                    <span className={`font-bold ${uData.oauth_provider ? 'text-teal-600' : 'text-amber-600'} uppercase tracking-widest text-[10px]`}>
                                        {uData.oauth_provider ? "Provider Verified" : "Pending Manual"}
                                    </span>
                                </div>
                            </div>
                        </Card>
                    </aside>

                    {/* --- Right Column: Details & Logs --- */}
                    <main className="lg:col-span-8 space-y-8">
                        <FormSection title="Identity & Permissions" icon={User} className="hs-glass-effect">
                            <div className="grid gap-x-12 gap-y-2 md:grid-cols-2">
                                <DetailRow label="First Name" value={uData?.first_name} icon={User} />
                                <DetailRow label="Last Name" value={uData?.last_name} icon={User} />
                                <DetailRow label="Email Address" value={uData?.email} icon={Mail} />
                                <DetailRow label="Username" value={`@${uData?.username}`} icon={Shield} mono />
                                <div className="md:col-span-2">
                                    <DetailRow label="System Resource ID" value={userId} icon={ShieldCheck} mono />
                                </div>
                            </div>
                        </FormSection>
                        <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm mt-0 hs-glass-effect">
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
                                        <StatusBadge
                                            size="sm"
                                            variant={
                                                log.action === 'created' || log.action === 'restored' ? 'success' :
                                                    log.action === 'deleted' || log.action === 'archived' || log.action === 'deactivated' ? 'danger' :
                                                        log.action === 'updated' ? 'warning' : 'neutral'
                                            }
                                        >
                                            {log.action}
                                        </StatusBadge>
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
                    </main>
                </div>

                <ConfirmationDialog
                    open={isDeactivating}
                    title="Confirm Account Deactivation"
                    description={`You are about to revoke all system access for @${uData?.username}. This will invalidate all active sessions immediately.`}
                    confirmLabel="CONFIRM DEACTIVATION"
                    isDanger
                    isLoading={busyAction === "deactivate"}
                    onConfirm={handleDeactivate}
                    onCancel={() => {
                        setIsDeactivating(false);
                        setConfirmInput("");
                    }}
                >
                    <div className="space-y-4">
                        <p className="text-xs font-medium text-stone-500">
                            Type the username <span className="font-bold text-rose-600">{uData?.username}</span> below to confirm.
                        </p>
                        <Input
                            autoFocus
                            value={confirmInput}
                            onChange={(e) => setConfirmInput(e.target.value)}
                            placeholder={uData?.username}
                            className="!h-11 border-stone-200 focus:border-rose-500/50"
                        />
                    </div>
                </ConfirmationDialog>

                <ConfirmationDialog
                    open={isArchiving}
                    title="Confirm Account Archival"
                    description={`You are about to archive @${uData?.username}. Archived users are hidden from the directory and cannot access the system until restored.`}
                    confirmLabel="ARCHIVE ACCOUNT"
                    isDanger
                    isLoading={busyAction === "archive"}
                    onConfirm={handleArchive}
                    onCancel={() => setIsArchiving(false)}
                />
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
