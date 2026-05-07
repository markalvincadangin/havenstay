"use client";
import { User, Search, Phone, Mail, Users, PlusCircle, UserPlus, CalendarDays, FileArchive } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/api";
import { flattenApiErrors } from "@/lib/errors";
import { canManageTenants } from "@/lib/auth";
import Alert from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import FilterPanelCard from "@/components/ui/FilterPanelCard";
import FilterChips from "@/components/ui/FilterChips";
import { Field, Input, Select } from "@/components/ui/Fields";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import { Table } from "@/components/ui/Table";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { KpiCard } from "@/components/ui/KpiCard";
import ResourceView from "@/components/ui/ResourceView";
import CurrencyCell from "@/components/ui/CurrencyCell";
import StandardPage from "@/components/ui/StandardPage";
import Avatar from "@/components/ui/Avatar";
import ResourceIdCell from "@/components/ui/ResourceIdCell";
import { TENANT_STATUS_LABELS, SEARCH_LABELS, SEARCH_PLACEHOLDERS, FILTER_ALL_OPTION } from "@/lib/constants";
import {
  normalizePaginatedList,
} from "@/lib/pagination";
import TablePagination from "@/components/ui/TablePagination";
import {
  formatTenantDirectoryName,
  compareTenantDirectoryName,
  formatPII,
} from "@/lib/formatters";


import { useAuth } from "@/context/AuthContext";
import PageHeaderActions from "@/components/ui/PageHeaderActions";
import { usePaginatedFilters } from "@/hooks/usePaginatedFilters";
import RowOpenIndicator from "@/components/ui/RowOpenIndicator";
import { interactiveTableRowClass } from "@/lib/tableRows";
import { SideSheetOverlay } from "@/components/ui/SideSheetOverlay";
import { QuickEditRowAction } from "@/components/ui/QuickEditRowAction";
import { TenantQuickEditForm } from '@/features/tenants/components/TenantQuickEditForm';
import { CorrelationIdCell } from "@/components/ui/CorrelationIdCell";
export default function TenantsPage() {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const [editingTenant, setEditingTenant] = useState(null);
  const {
    filters,
    updateFilter,
    resetFilters,
    sort,
    onSortChange,
    page,
    setPage,
    perPage,
    setPerPage,
    queryString,
  } = usePaginatedFilters({
    initialFilters: { query: "", status: "all" },
    initialSort: { by: "id", dir: "desc" },
    debounceKeys: ["query"],
    buildExtraParams: ({ filters: current, debounced }) => {
      const extra = {};
      const q = String(debounced.query ?? "").trim();
      if (q) extra.q = q;
      if (current.status !== "all") extra.status = current.status;
      return extra;
    },
  });
  const query = filters.query;
  const statusFilter = filters.status;
  
  const { data: tenantSummaryData, isValidating: summaryValidating } = useSWR(
    currentUser ? "/api/tenants/summary" : null,
    fetcher,
    { revalidateOnFocus: false }
  );
  const { data: tenantData, error: tenantError, isValidating: isSyncing, mutate: refetchTenants } = useSWR(
    currentUser ? `/api/tenants${queryString}` : null,
    fetcher,
    { keepPreviousData: true }
  );
  const { rows: tenants = [], meta: listMeta = null } = useMemo(() => {
    if (!tenantData) return { rows: [], meta: null };
    return normalizePaginatedList(tenantData);
  }, [tenantData]);
  
  // Tenants are sorted on the server, we just pass them directly.
  const sortedFiltered = tenants;
  
  const stats = useMemo(() => ({
    activeCount: Number(tenantSummaryData?.active_tenants ?? 0),
    newOnboarded: Number(tenantSummaryData?.new_onboarded_mtd ?? 0),
    pendingExits: Number(tenantSummaryData?.pending_move_outs ?? 0),
    archivedCount: Number(tenantSummaryData?.archived_count ?? 0),
  }), [tenantSummaryData]);
  const loading = !tenantData && !tenantError;
  const error = tenantError ? flattenApiErrors(tenantError) : "";
  return (
    <StandardPage
      title="Tenant Directory"
      subtitle="Manage tenant profiles, contact info, and history."
      breadcrumbs={<Breadcrumbs items={[{ label: "Tenant Directory" }]} />}
      loading={loading}
      error={error}
      actions={
        <PageHeaderActions
          ctaHref={canManageTenants(currentUser) ? "/tenants/new" : null}
          ctaLabel="Register Tenant"
          ctaIcon={PlusCircle}
          user={currentUser}
        />
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Active Tenants"
          value={stats.activeCount}
          sub="Total active leases"
          icon={Users}
          isSuccess={stats.activeCount > 0}
          isLoading={!tenantSummaryData}
          isSyncing={summaryValidating || isSyncing}
          className="hs-glass-effect"
        />
        <KpiCard
          label="New Tenants"
          value={stats.newOnboarded}
          sub="Registered this month"
          icon={UserPlus}
          isLoading={!tenantSummaryData}
          isSyncing={summaryValidating || isSyncing}
          className="hs-glass-effect"
        />
        <KpiCard
          label="Expiring Leases"
          value={stats.pendingExits}
          sub="Departures next 30 days"
          icon={CalendarDays}
          isWarning={stats.pendingExits > 0}
          isLoading={!tenantSummaryData}
          isSyncing={summaryValidating || isSyncing}
          href="/contracts"
          className="hs-glass-effect"
        />
        <KpiCard
          label="Archived Tenants"
          value={stats.archivedCount}
          sub="Archived historical records"
          icon={FileArchive}
          isLoading={!tenantSummaryData}
          isSyncing={summaryValidating || isSyncing}
          className="hs-glass-effect"
        />
      </div>
      <FilterPanelCard icon={User}>
        {!canManageTenants(currentUser) && (
          <div className="mb-6">
            <Alert variant="info" title="Restricted access">
              Your current session is restricted to viewing records only.
            </Alert>
          </div>
        )}
        <div className="grid gap-6 md:grid-cols-12 items-end">
          <div className="md:col-span-9">
            <Field label={SEARCH_LABELS.tenants}>
              <Input
                icon={Search}
                placeholder={SEARCH_PLACEHOLDERS.tenants}
                className="!h-12 border-stone-200 font-bold focus:ring-4 focus:ring-teal-500/5 transition-[border-color,box-shadow]"
                value={query}
                onChange={(e) => {
                  updateFilter("query", e.target.value);
                }}
              />
            </Field>
          </div>
          <div className="md:col-span-3">
            <Field label="Profile Status">
              <Select
                value={statusFilter}
                onChange={(e) => {
                  updateFilter("status", e.target.value);
                }}
                className="!h-12 border-stone-200 font-bold focus:border-teal-500/50"
              >
                <option value="all">{FILTER_ALL_OPTION}</option>
                {Object.entries(TENANT_STATUS_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </Select>
            </Field>
          </div>
        </div>
        <FilterChips
          className="mt-6"
          items={[
            {
              key: "query",
              label: "Tenants",
              value: query,
              onClear: () => {
                updateFilter("query", "");
              },
            },
            {
              key: "status",
              label: "Tenant Status",
              value: statusFilter !== "all" ? TENANT_STATUS_LABELS[statusFilter] || statusFilter : "",
              onClear: () => {
                updateFilter("status", "all");
              },
            },
          ]}
          onClearAll={resetFilters}
        />
      </FilterPanelCard>
      <div className="mt-6">
        <ResourceView
          isLoading={loading}
          isSyncing={isSyncing}
          error={error}
          isEmpty={sortedFiltered.length === 0}
          onRetry={() => refetchTenants()}
          emptyProps={{
            title: "No tenants found",
            description: "No records matching your search or filters. Try adjusting your search criteria."
          }}
        >
          <Card className="overflow-hidden rounded-2xl border-stone-200 !p-0 shadow-md hs-glass-effect">
            <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/50 px-8 py-4">
              <h2 className="hs-strip-title uppercase tracking-[0.2em] text-[10px] font-black text-stone-400">TENANT DIRECTORY</h2>
              <div className="text-[10px] font-mono font-bold text-stone-400 uppercase tracking-widest leading-none">
                {listMeta?.total ?? sortedFiltered.length} TENANTS MATCHING
              </div>
            </div>
            <Table
              embedded
              sortable
              sortColumn={sort.by}
              sortDirection={sort.dir}
              onSortChange={onSortChange}
              columns={[
                { key: "id", label: "TENANT ID", sortable: true, className: "pl-8" },
                { key: "name", label: "TENANT", sortable: true },
                { key: "contact", label: "CONTACT" },
                { key: "room", label: "ROOM/BED", sortable: true, className: "text-center" },
                { key: "balance", label: "BALANCE", sortable: true, className: "text-right" },
                { key: "status", label: "STATUS", sortable: true, className: "text-center" },
                { key: "actions", label: "", className: "text-right w-16 px-8" },
              ]}
              rows={sortedFiltered.map((tenant) => (
                <tr
                  key={tenant.tenant_id}
                  className={interactiveTableRowClass}
                  onClick={() => router.push(`/tenants/${tenant.tenant_id}`)}
                >
                  <td className="px-8 py-5">
                    <ResourceIdCell id={tenant.tenant_id} type="tenant" />
                  </td>
                  <td className="py-5">
                    <div className="flex items-center gap-4">
                      <Avatar tenant={tenant} />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-stone-900 group-hover:text-teal-700 transition-colors leading-none flex items-center gap-2">
                          {formatTenantDirectoryName(tenant)}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-5">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2 text-[10px] font-mono tabular-nums font-bold text-stone-700">
                        <Phone size={12} className="text-stone-300" />
                        <span className="tracking-tight">
                          {formatPII(tenant.contact_number, "phone", canManageTenants(currentUser))}
                        </span>
                      </div>
                      {tenant.email && (
                        <div className="flex items-center gap-2 text-[10px] font-mono tabular-nums font-medium text-stone-400">
                          <Mail size={11} className="text-stone-300" />
                          <span className="truncate max-w-[140px] tracking-tight">
                            {formatPII(tenant.email, "email", canManageTenants(currentUser))}
                          </span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="py-5 text-center">
                    <div className="flex items-center justify-center">
                      {tenant.room_code ? (
                        <div className="flex flex-col items-center">
                          <span className="text-xs font-black text-stone-900 uppercase tracking-wide">{tenant.room_code}</span>
                          <span className="text-[10px] font-mono font-bold text-stone-400 uppercase tracking-widest leading-none mt-1">{tenant.bed_label || "No Bed"}</span>
                        </div>
                      ) : (
                        <span className="text-[10px] font-bold text-stone-300 uppercase tracking-widest border border-stone-100 rounded px-2 py-0.5">Unassigned</span>
                      )}
                    </div>
                  </td>
                  <td className="py-5 text-right">
                    <CurrencyCell amount={tenant.outstanding_balance ?? 0} />
                  </td>
                  <td className="py-5 text-center">
                    <StatusBadge>{tenant.status || "active"}</StatusBadge>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <QuickEditRowAction
                        disabled={!canManageTenants(currentUser)}
                        onClick={() => setEditingTenant(tenant)}
                        title="Update details"
                      />
                      <RowOpenIndicator />
                    </div>
                  </td>
                </tr>
              ))}
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
              disabled={loading || isSyncing}
            />
          </Card>
        </ResourceView>
      </div>
      <SideSheetOverlay
        isOpen={!!editingTenant}
        onClose={() => setEditingTenant(null)}
        title="Quick Update"
      >
        {editingTenant && (
          <TenantQuickEditForm
            tenant={editingTenant}
            onSuccess={() => {
              setEditingTenant(null);
              refetchTenants();
            }}
            onCancel={() => setEditingTenant(null)}
          />
        )}
      </SideSheetOverlay>
    </StandardPage>
  );
}
