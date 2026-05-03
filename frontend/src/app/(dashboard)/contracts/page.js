"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Search, ShieldCheck, PlusCircle, Hourglass, Landmark, TrendingUp } from "lucide-react";
import useSWR from "swr";
import { fetcher } from "@/lib/api";
import { canManageContracts } from "@/lib/auth";


import {
  compareTenantDirectoryName,
  formatDateString,
  formatTenantDirectoryName,
} from "@/lib/formatters";
import { isContractEnded } from "@/lib/constants";
import CurrencyDisplay from "@/components/ui/CurrencyDisplay";
import { Card } from "@/components/ui/Card";
import FilterPanelCard from "@/components/ui/FilterPanelCard";
import TablePagination from "@/components/ui/TablePagination";
import Button from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Fields";
import FilterChips from "@/components/ui/FilterChips";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import { primaryLinkCtaClass } from "@/components/ui/LinkTokens";
import PageHeaderActions from "@/components/ui/PageHeaderActions";
import { Table } from "@/components/ui/Table";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { KpiCard } from "@/components/ui/KpiCard";
import ResourceView from "@/components/ui/ResourceView";
import {
  normalizePaginatedList,
  normalizeReportRows,
} from "@/lib/pagination";
import { CONTRACT_STATUS_LABELS, SEARCH_LABELS, SEARCH_PLACEHOLDERS, FILTER_ALL_OPTION } from "@/lib/constants";
import StandardPage from "@/components/ui/StandardPage";
import ResourceIdCell from "@/components/ui/ResourceIdCell";
import { useAuth } from "@/context/AuthContext";
import { usePaginatedFilters } from "@/hooks/usePaginatedFilters";
import RowOpenIndicator from "@/components/ui/RowOpenIndicator";
import { interactiveTableRowClass, stopRowClick } from "@/lib/tableRows";
import { SideSheetOverlay } from "@/components/ui/SideSheetOverlay";
import { QuickEditRowAction } from "@/components/ui/QuickEditRowAction";
import { ContractQuickEditForm } from '@/features/contracts/components/ContractQuickEditForm';
import { ExpandableTableRow } from "@/components/ui/ExpandableTableRow";
import { CorrelationIdCell } from "@/components/ui/CorrelationIdCell";
export default function ContractsListPage() {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const [editingContract, setEditingContract] = useState(null);
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
    initialFilters: { search: "", status: "all" },
    initialSort: { by: "id", dir: "desc" },
    debounceKeys: ["search"],
    buildExtraParams: ({ filters: current, debounced }) => {
      const extra = {};
      const q = String(debounced.search ?? "").trim();
      if (q) extra.q = q;
      if (current.status !== "all") extra.status = current.status;
      return extra;
    },
  });
  const searchQuery = filters.search;
  const statusFilter = filters.status;
  
  const { data: reportData, isValidating: reportValidating } = useSWR(
    currentUser ? "/api/reports/active-contracts" : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  );
  const stats = useMemo(() => {
    const _reportRows = normalizeReportRows(reportData, "rows").rows;
    const summary = reportData?.summary;
    // Favor backend-calculated global metrics over client-side row sums
    return {
      activeCount: Number(summary?.contract_count ?? 0) || 0,
      totalDeposits: Number(summary?.total_deposits ?? 0) || 0,
      potentialRevenue: Number(summary?.potential_revenue ?? 0) || 0,
      expiringCount: Number(summary?.pending_move_outs ?? 0) || 0,
    };
  }, [reportData]);
  const { data: contractData, error: contractError, isValidating: listValidating, mutate: refetchContracts } = useSWR(
    currentUser ? `/api/contracts${queryString}` : null,
    fetcher,
    { keepPreviousData: true, dedupingInterval: 30000 }
  );
  const { rows: contracts = [], meta: listMeta = null } = useMemo(() => {
    if (!contractData) return { rows: [], meta: null };
    return normalizePaginatedList(contractData);
  }, [contractData]);
  const loading = !contractData && !contractError;
  const sortedRows = contracts;
  const canWrite = canManageContracts(currentUser);
  const hasActiveFilters = Boolean(String(searchQuery ?? "").trim()) || statusFilter !== "all";
  return (
    <StandardPage
      title="Contract Ledger"
      subtitle="History of leases and agreements."
      breadcrumbs={<Breadcrumbs items={[{ label: "Contracts" }]} />}
      loading={loading}
      error={contractError}
      actions={
        <PageHeaderActions
          ctaHref={canWrite ? "/contracts/new" : null}
          ctaLabel="REGISTER CONTRACT"
          ctaIcon={PlusCircle}
          user={currentUser}
        />
      }
    >
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Active Leases"
            value={stats.activeCount}
            sub="Active agreements"
            icon={ShieldCheck}
            isSuccess={stats.activeCount > 0}
            isLoading={!reportData}
            isSyncing={reportValidating}
            className="hs-glass-effect"
          />
          <KpiCard
            label="Expiring Soon"
            value={stats.expiringCount}
            sub="Departures next 30 days"
            icon={Hourglass}
            isWarning={stats.expiringCount > 0}
            isActiveDecision={stats.expiringCount > 0}
            isLoading={!reportData}
            isSyncing={reportValidating}
            className="hs-glass-effect"
          />
          <KpiCard
            label="Security Deposits"
            value={stats.totalDeposits}
            sub="Total security deposits"
            icon={Landmark}
            isLoading={!reportData}
            isSyncing={reportValidating}
            currency={true}
            className="hs-glass-effect"
          />
          <KpiCard
            label="Expected Income"
            value={stats.potentialRevenue}
            sub="Projected monthly revenue"
            icon={TrendingUp}
            isLoading={!reportData}
            isSyncing={reportValidating}
            currency={true}
            className="hs-glass-effect"
          />
        </div>
        <FilterPanelCard icon={FileText} title="Filters">
          <div className="grid items-end gap-6 md:grid-cols-12">
            <div className="md:col-span-8 lg:col-span-9">
              <Field label={SEARCH_LABELS.contracts}>
                <div className="group relative">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-stone-400 transition-colors group-focus-within:text-teal-600"
                    aria-hidden
                  />
                  <Input
                    placeholder={SEARCH_PLACEHOLDERS.contracts}
                    className="!h-12 border-stone-200 pl-11 font-bold transition-[border-color,box-shadow] focus:border-teal-500/50 focus:ring-4 focus:ring-teal-500/5"
                    value={searchQuery}
                    onChange={(e) => updateFilter("search", e.target.value)}
                  />
                </div>
              </Field>
            </div>
            <div className="md:col-span-4 lg:col-span-3">
              <Field label="Contract Status">
                <Select
                  value={statusFilter}
                  onChange={(e) => updateFilter("status", e.target.value)}
                  className="!h-12 border-stone-200 font-bold focus:border-teal-500/50"
                >
                  <option value="all">{FILTER_ALL_OPTION}</option>
                  {Object.entries(CONTRACT_STATUS_LABELS).map(([key, label]) => (
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
                key: "search",
                label: "Contracts",
                value: searchQuery,
                onClear: () => updateFilter("search", ""),
              },
              {
                key: "status",
                label: "Contract Status",
                value:
                  statusFilter !== "all"
                    ? CONTRACT_STATUS_LABELS[statusFilter] || statusFilter
                    : "",
                onClear: () => updateFilter("status", "all"),
              },
            ]}
            onClearAll={resetFilters}
          />
        </FilterPanelCard>
        <section className="relative">
          <ResourceView
            isLoading={loading}
            isSyncing={listValidating}
            error={contractError}
            isEmpty={sortedRows.length === 0}
            onRetry={() => refetchContracts()}
            emptyProps={{
              title: "No agreements found",
              description: "Adjust filters or register a new contract agreement when a resident moves in.",
              action: canWrite ? (
                hasActiveFilters ? (
                  <Button
                    variant="secondary"
                    className="!h-12 rounded-xl px-10 text-[10px] font-bold uppercase tracking-widest"
                    onClick={() => {
                      resetFilters();
                    }}
                  >
                    Clear filters
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    className={primaryLinkCtaClass}
                    onClick={() => router.push("/contracts/new")}
                  >
                    REGISTER CONTRACT
                  </Button>
                )
              ) : null
            }}
          >
            <Card className="overflow-hidden rounded-2xl border-stone-200 !p-0 shadow-sm hs-glass-effect">
              <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/50 px-8 py-4">
                <h2 className="hs-strip-title uppercase tracking-[0.2em] text-[10px] font-black text-stone-400">CONTRACT DIRECTORY</h2>
                <div className="text-[10px] font-mono font-bold text-stone-400 uppercase tracking-widest leading-none">
                  {listMeta?.total ?? sortedRows.length} CONTRACTS MATCHING
                </div>
              </div>
              <Table
                embedded
                sortable
                sortColumn={sort.by}
                sortDirection={sort.dir}
                onSortChange={onSortChange}
                columns={[
                  { key: "contract_id", label: "CONTRACT ID", sortable: true, sortKey: "contract_id", className: "pl-8" },
                  { key: "tenant", label: "TENANT", sortable: true, sortKey: "tenant" },
                  { key: "move_in_date", label: "MOVE-IN", sortable: true, sortKey: "move_in_date", className: "text-center" },
                  { key: "room", label: "ROOM / BED", sortable: true, sortKey: "room", className: "text-center" },
                  { key: "monthly_rate", label: "MONTHLY RATE", sortable: true, sortKey: "monthly_rate", className: "text-right" },
                  { key: "status", label: "STATUS", sortable: true, sortKey: "status", className: "text-center" },
                  { key: "actions", label: "", className: "text-right w-16 px-8" },
                ]}
                rows={sortedRows.map((c) => {
                  const tenant = c.tenant;
                  const tenantName = tenant ? formatTenantDirectoryName(tenant) : "—";
                  const roomLabel = c.room?.room_code ? `${c.room.room_code}` : "—";
                  const bedLabel = c.bed_space?.bed_label || c.bedSpace?.bed_label;
                  return (
                    <ExpandableTableRow
                      key={c.contract_id}
                      className={interactiveTableRowClass}
                      expandableContent={
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border border-stone-200 bg-white rounded-xl p-6 shadow-sm">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase text-stone-400 tracking-widest">Financial Snapshot</span>
                            <div className="mt-2 text-sm text-stone-900 flex items-center gap-1 font-bold">
                              Security Deposit: {c.deposit_amount ? <CurrencyDisplay amount={c.deposit_amount} /> : "—"} <span className="text-stone-300 mx-3 font-normal">|</span>
                              Base Rate: {c.monthly_rate ? <CurrencyDisplay amount={c.monthly_rate} /> : "—"}
                            </div>
                          </div>
                          <Button onClick={() => router.push(`/contracts/${c.contract_id}`)} variant="secondary" className="!h-10 px-8 text-[10px] font-black tracking-widest uppercase shadow-md active:scale-95 transition-transform">
                            View Details
                          </Button>
                        </div>
                      }
                    >
                      <td className="px-8 py-5">
                        <ResourceIdCell id={c.contract_id} type="contract" />
                        <div className="mt-1.5">
                          <CorrelationIdCell value={c.correlation_id} />
                        </div>
                      </td>
                      <td className="py-5">
                        {tenant ? (
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-stone-900 group-hover:text-teal-700 transition-colors leading-tight flex items-center gap-2">
                              {tenantName}
                              <CorrelationIdCell value={tenant.correlation_id} className="ml-2" />
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-stone-300">—</span>
                        )}
                      </td>
                      <td className="py-5 text-center">
                        <span className="font-mono text-[10px] font-bold uppercase tracking-tight text-stone-700">
                          {c.move_in_date ? formatDateString(c.move_in_date) : "—"}
                        </span>
                      </td>
                      <td className="py-5 text-center">
                        <div className="flex flex-col items-center">
                          {c.room ? (
                            <span className="text-sm font-bold text-stone-900 leading-tight">
                              {roomLabel}
                            </span>
                          ) : (
                            <span className="text-sm text-stone-300">—</span>
                          )}
                          {bedLabel && (
                            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-stone-400 leading-none mt-1">
                              {bedLabel}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-5 text-right">
                        <div className="flex flex-col items-end">
                          {c.monthly_rate_override ? (
                            <>
                              <span className="text-[10px] font-bold text-stone-400 line-through decoration-stone-300">
                                <CurrencyDisplay amount={c.monthly_rate} />
                              </span>
                              <div className="flex items-center gap-1.5">
                                <CurrencyDisplay 
                                  amount={c.monthly_rate_override} 
                                  className="text-sm font-bold text-teal-700" 
                                />
                                <span className="text-[8px] font-black bg-teal-100 text-teal-700 px-1 py-0.5 rounded uppercase tracking-tighter">Custom Rate</span>
                              </div>
                            </>
                          ) : (
                            <div className="text-sm font-bold text-stone-900">
                              {c.monthly_rate != null ? <CurrencyDisplay amount={c.monthly_rate} /> : "—"}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-5 text-center">
                        <StatusBadge>{c.status}</StatusBadge>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div onClick={stopRowClick}>
                            <QuickEditRowAction
                              disabled={!canWrite || isContractEnded(c.status)}
                              onClick={() => setEditingContract(c)}
                              title={isContractEnded(c.status) ? "Contract closed" : "Update details"}
                            />
                          </div>
                          <RowOpenIndicator />
                        </div>
                      </td>
                    </ExpandableTableRow>
                  );
                })}
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
                disabled={loading || listValidating}
                className="hs-glass-effect mt-6"
              />
            </Card>
          </ResourceView>
        </section>
      </div>
      <SideSheetOverlay
        isOpen={!!editingContract}
        onClose={() => setEditingContract(null)}
        title="Update Lease"
      >
        {editingContract && (
          <ContractQuickEditForm
            contract={editingContract}
            currentUser={currentUser}
            onSuccess={() => {
              setEditingContract(null);
              refetchContracts();
            }}
            onCancel={() => setEditingContract(null)}
          />
        )}
      </SideSheetOverlay>
    </StandardPage>
  );
}
