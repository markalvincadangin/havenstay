"use client";

import { User, Search, Phone, Mail, Calendar, Users, PlusCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import useSWR from "swr";
import { fetcher } from "../../lib/api";
import { flattenApiErrors } from "../../lib/errors";
import { canManageTenants } from "../../lib/auth";
import Alert from "../_components/ui/Alert";
import { Card } from "../_components/ui/Card";
import FilterPanelCard from "../_components/ui/FilterPanelCard";
import FilterChips from "../_components/ui/FilterChips";
import { Field, Input, Select } from "../_components/ui/Fields";
import Breadcrumbs from "../_components/ui/Breadcrumbs";
import { Table } from "../_components/ui/Table";
import { StatusBadge } from "../_components/ui/StatusBadge";
import { KpiCard } from "../_components/ui/KpiCard";
import ResourceView from "../_components/ui/ResourceView";
import CurrencyCell from "../_components/ui/CurrencyCell";
import StandardPage from "../_components/ui/StandardPage";
import Avatar from "../_components/ui/Avatar";
import ResourceIdCell from "../_components/ui/ResourceIdCell";

import { TENANT_STATUS_LABELS } from "../../lib/constants";
import {
  normalizePaginatedList,
} from "../../lib/pagination";
import TablePagination from "../_components/ui/TablePagination";
import {
  formatTenantDirectoryName,
  compareTenantDirectoryName,
} from "../../lib/formatters";
import { useTableSort } from "../../hooks/useTableSort";
import { sortClientRows } from "../../lib/tableSort";
import { useAuth } from "../_context/AuthContext";
import PageHeaderActions from "../_components/ui/PageHeaderActions";
import { usePaginatedFilters } from "../../hooks/usePaginatedFilters";
import RowOpenIndicator from "../_components/ui/RowOpenIndicator";
import { interactiveTableRowClass } from "../../lib/tableRows";

export default function TenantsPage() {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const { filters, updateFilter, resetFilters, page, setPage, perPage, setPerPage, queryString } =
    usePaginatedFilters({
      initialFilters: { query: "", status: "all" },
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
  const { sortColumn, sortDirection, onSortChange } = useTableSort();

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

  const sortedFiltered = useMemo(() => {
    if (!sortColumn) return tenants;

    if (sortColumn === "name") {
      const list = [...tenants];
      const dir = sortDirection === "asc" ? 1 : -1;
      list.sort((a, b) => compareTenantDirectoryName(a, b) * dir);
      return list;
    }

    return sortClientRows(tenants, sortColumn, sortDirection, (t) => {
      switch (sortColumn) {
        case "id": return Number(t.tenant_id) || 0;
        case "room": return t.room_code || "";
        case "balance": return Number(t.outstanding_balance) || 0;
        case "status": return t.status || "";
        default: return "";
      }
    });
  }, [tenants, sortColumn, sortDirection]);

  const stats = useMemo(() => ({
    activeCount: Number(tenantSummaryData?.active_tenants ?? 0),
    totalRecords: Number(tenantSummaryData?.total_records ?? 0),
    pendingExits: Number(tenantSummaryData?.pending_move_outs ?? 0),
  }), [tenantSummaryData]);

  const loading = !tenantData && !tenantError;
  const error = tenantError ? flattenApiErrors(tenantError) : "";

  return (
    <StandardPage
      title="Tenant Directory"
      subtitle="Manage profile data, contact details, and historical lease statuses."
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
      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard
          label="Active Tenants"
          value={stats.activeCount}
          sub="CURRENTLY ON-PREMISE"
          icon={Users}
          isSuccess={stats.activeCount > 0}
          isLoading={!tenantSummaryData}
          isSyncing={summaryValidating || isSyncing}
        />
        <KpiCard
          label="Total History"
          value={stats.totalRecords}
          sub="REGISTERED PROFILES"
          icon={Users}
          isLoading={!tenantSummaryData}
          isSyncing={summaryValidating || isSyncing}
        />
        <KpiCard
          label="Pending Move-outs"
          value={stats.pendingExits}
          sub="SCHEDULED NEXT 30 DAYS"
          icon={Calendar}
          isWarning={stats.pendingExits > 0}
          isLoading={!tenantSummaryData}
          isSyncing={summaryValidating || isSyncing}
        />
      </div>

      <FilterPanelCard icon={User}>
        {!canManageTenants(currentUser) && (
          <div className="mb-6">
            <Alert variant="info" title="Read-only Access">
              Your current session is restricted to viewing records only.
            </Alert>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-12 items-end">
          <div className="md:col-span-9">
            <Field label="Search">
              <Input
                icon={Search}
                placeholder="Name, phone, email, or tenant ID…"
                className="!h-11 border-stone-200 focus:ring-4 focus:ring-teal-500/5 transition-[border-color,box-shadow]"
                value={query}
                onChange={(e) => {
                  updateFilter("query", e.target.value);
                }}
              />
            </Field>
          </div>

          <div className="md:col-span-3">
            <Field label="Status">
              <Select
                value={statusFilter}
                onChange={(e) => {
                  updateFilter("status", e.target.value);
                }}
                className="!h-11 border-stone-200 focus:border-teal-500/50"
              >
                <option value="all">All Statuses</option>
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
              label: "Search",
              value: query,
              onClear: () => {
                updateFilter("query", "");
              },
            },
            {
              key: "status",
              label: "Status",
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
            message: "No records matching your search or filters. Try adjusting your search criteria."
          }}
        >
          <Card className="overflow-hidden rounded-2xl border-stone-200 !p-0 shadow-sm">
            <Table
              embedded
              caption={`Directory of current and former resident records — ${listMeta?.total ?? sortedFiltered.length} matching`}
              columns={[
                { key: "id", label: "TENANT ID", sortable: true, className: "w-32 pl-6" },
                { key: "name", label: "TENANT", sortable: true },
                { key: "contact", label: "CONTACT DETAILS" },
                { key: "room", label: "ROOM / BED SPACE", sortable: true },
                { key: "balance", label: "OUTSTANDING BALANCE", sortable: true, className: "text-right" },
                { key: "status", label: "STATUS", sortable: true },
                { key: "actions", label: "", className: "text-right w-16" },
              ]}
              sortColumn={sortColumn}
              sortDirection={sortDirection}
              onSortChange={onSortChange}
              rows={sortedFiltered.map((tenant) => (
                <tr
                  key={tenant.tenant_id}
                  className={interactiveTableRowClass}
                  onClick={() => router.push(`/tenants/${tenant.tenant_id}`)}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <Avatar entity={tenant} />
                      <div className="min-w-0">
                        <p className="text-sm font-black text-stone-900 group-hover:text-teal-700 transition-colors leading-none">
                          {formatTenantDirectoryName(tenant)}
                        </p>
                        <div className="mt-1.5">
                          <ResourceIdCell id={tenant.tenant_id} prefix="TENANT" />
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2 text-[11px] font-mono tabular-nums font-bold text-stone-700">
                        <Phone size={12} className="text-stone-300" />
                        <span className="tracking-tight">{tenant.contact_number || "—"}</span>
                      </div>
                      {tenant.email && (
                        <div className="flex items-center gap-2 text-[10px] font-medium text-stone-400">
                          <Mail size={11} className="text-stone-300" />
                          <span className="truncate max-w-[140px] tracking-tight">{tenant.email}</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {tenant.room_code ? (
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-stone-900 uppercase tracking-wide">Room {tenant.room_code}</span>
                          <span className="text-[10px] font-bold text-teal-600/80 uppercase tracking-widest leading-none mt-1">{tenant.bed_label || "No Bed"}</span>
                        </div>
                      ) : (
                        <span className="text-[10px] font-bold text-stone-300 uppercase tracking-widest border border-stone-100 rounded px-2 py-0.5">Unassigned</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <CurrencyCell amount={tenant.outstanding_balance ?? 0} />
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge variant="pastel">{tenant.status || "active"}</StatusBadge>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <RowOpenIndicator />
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
    </StandardPage>
  );
}
