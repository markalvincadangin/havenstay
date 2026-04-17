"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Search, ShieldCheck, Wallet, Receipt, PlusCircle } from "lucide-react";

import useSWR from "swr";
import { fetcher } from "../../lib/api";
import { canManageContracts } from "../../lib/auth";
import { useTableSort } from "../../hooks/useTableSort";
import { sortClientRows } from "../../lib/tableSort";
import {
  compareTenantDirectoryName,
  formatDateString,
  formatPHP,
  formatTenantDirectoryName,
} from "../../lib/formatters";
import { Card } from "../_components/ui/Card";
import FilterPanelCard from "../_components/ui/FilterPanelCard";
import TablePagination from "../_components/ui/TablePagination";
import Button from "../_components/ui/Button";
import { Field, Input, Select } from "../_components/ui/Fields";
import FilterChips from "../_components/ui/FilterChips";
import Breadcrumbs from "../_components/ui/Breadcrumbs";
import { primaryLinkCtaClass } from "../_components/ui/LinkTokens";
import PageHeaderActions from "../_components/ui/PageHeaderActions";
import { Table } from "../_components/ui/Table";
import { StatusBadge } from "../_components/ui/StatusBadge";
import { KpiCard } from "../_components/ui/KpiCard";
import ResourceView from "../_components/ui/ResourceView";
import {
  normalizePaginatedList,
  normalizeReportRows,
} from "../../lib/pagination";
import { CONTRACT_STATUS_LABELS } from "../../lib/constants";
import StandardPage from "../_components/ui/StandardPage";
import ResourceIdCell from "../_components/ui/ResourceIdCell";
import { useAuth } from "../_context/AuthContext";
import { usePaginatedFilters } from "../../hooks/usePaginatedFilters";
import RowOpenIndicator from "../_components/ui/RowOpenIndicator";
import { interactiveTableRowClass, stopRowClick } from "../../lib/tableRows";

export default function ContractsListPage() {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const { filters, updateFilter, resetFilters, page, setPage, perPage, setPerPage, queryString } =
    usePaginatedFilters({
      initialFilters: { search: "", status: "all" },
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

  const { sortColumn, sortDirection, onSortChange } = useTableSort();


  const { data: reportData, isValidating: reportValidating } = useSWR(
    currentUser ? "/api/reports/active-contracts" : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  );

  const kpis = useMemo(() => {
    const reportRows = normalizeReportRows(reportData, "rows").rows;
    const potentialRevenue = reportRows.reduce((s, r) => s + Number(r?.monthly_rate || 0), 0);
    const activeCount = reportData?.summary?.contract_count ?? reportRows.length;
    const totalDeposits = reportRows.reduce((s, c) => s + Number(c?.deposit_amount || 0), 0);
    return { 
      activeCount: Number(activeCount) || 0, 
      totalDeposits: Number(totalDeposits) || 0, 
      potentialRevenue: Number(potentialRevenue) || 0 
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

  const sortedRows = useMemo(() => {
    if (!sortColumn) return contracts;
    if (sortColumn === "tenant") {
      const list = [...contracts];
      const dir = sortDirection === "asc" ? 1 : -1;
      list.sort((a, b) => {
        const ta = a.tenant;
        const tb = b.tenant;
        if (!ta && !tb) return 0;
        if (!ta) return 1;
        if (!tb) return -1;
        return compareTenantDirectoryName(ta, tb) * dir;
      });
      return list;
    }
    return sortClientRows(contracts, sortColumn, sortDirection, (c) => {
      switch (sortColumn) {
        case "contract_id": return Number(c.contract_id) || 0;
        case "move_in_date": return c.move_in_date || "";
        case "room": return c.room?.room_code || "";
        case "monthly_rate": return Number(c.monthly_rate) || 0;
        case "status": return c.status || "";
        default: return "";
      }
    });
  }, [contracts, sortColumn, sortDirection]);

  const canWrite = canManageContracts(currentUser);
  const hasActiveFilters = Boolean(String(searchQuery ?? "").trim()) || statusFilter !== "all";

  return (
    <StandardPage
      title="Contracts"
      subtitle="View active and past lease agreements."
      breadcrumbs={<Breadcrumbs items={[{ label: "Contracts" }]} />}
      loading={loading}
      error={contractError}
      actions={
        <PageHeaderActions
          ctaHref={canWrite ? "/contracts/new" : null}
          ctaLabel="Register Contract"
          ctaIcon={PlusCircle}
          user={currentUser}
        />
      }
    >
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <KpiCard
            label="Active Agreements"
            icon={ShieldCheck}
            value={kpis.activeCount}
            sub="OPERATIONAL LEASES"
            isSuccess={kpis.activeCount > 0}
            isLoading={!reportData}
            isSyncing={reportValidating}
          />
          <KpiCard
            label="Security Deposits"
            icon={Wallet}
            value={formatPHP(kpis.totalDeposits)}
            sub="TOTAL ESCROWED AMOUNT"
            isLoading={!reportData}
            isSyncing={reportValidating}
          />
          <KpiCard
            label="Monthly Revenue"
            icon={Receipt}
            value={formatPHP(kpis.potentialRevenue)}
            sub="PROJECTED ACTIVE YIELD"
            isLoading={!reportData}
            isSyncing={reportValidating}
          />
        </div>

        <FilterPanelCard icon={FileText}>
            <div className="grid items-end gap-6 md:grid-cols-12">
              <div className="md:col-span-8 lg:col-span-9">
                <Field label="Search">
                  <div className="group relative">
                    <Search
                      className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-stone-400 transition-colors group-focus-within:text-teal-600"
                      aria-hidden
                    />
                    <Input
                      placeholder="Search tenant name, room code, or contract ID…"
                      className="!h-12 border-stone-200 pl-11 transition-[border-color,box-shadow] focus:border-teal-500/50 focus:ring-4 focus:ring-teal-500/5"
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
                    <option value="all">All Contracts</option>
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
                  label: "Query",
                  value: searchQuery,
                  onClear: () => updateFilter("search", ""),
                },
                {
                  key: "status",
                  label: "Status",
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
              message: "Adjust filters or register a new contract agreement when a resident moves in.",
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
                    Register Contract
                  </Button>
                )
              ) : null
            }}
          >
            <Card className="overflow-hidden rounded-2xl border-stone-200 !p-0 shadow-sm">
              <Table
                embedded
                caption={`Contract list - ${listMeta?.total ?? sortedRows.length} matching`}
                columns={[
                  { key: "contract_id", label: "CONTRACT ID", sortable: true, sortKey: "contract_id", className: "w-32" },
                  { key: "tenant", label: "TENANT", sortable: true, sortKey: "tenant" },
                  { key: "move_in_date", label: "MOVE-IN", sortable: true, sortKey: "move_in_date", className: "w-36" },
                  { key: "room", label: "ROOM / BED SPACE", sortable: true, sortKey: "room" },
                  { key: "monthly_rate", label: "MONTHLY RATE", sortable: true, sortKey: "monthly_rate", className: "text-right" },
                  { key: "status", label: "STATUS", sortable: true, sortKey: "status" },
                  { key: "actions", label: "", className: "text-right w-16" },
                ]}
                sortColumn={sortColumn}
                sortDirection={sortDirection}
                onSortChange={onSortChange}
                rows={sortedRows.map((c) => {
                  const tenant = c.tenant;
                  const tenantName = tenant ? formatTenantDirectoryName(tenant) : "—";
                  const roomLabel = c.room?.room_code ? `${c.room.room_code}` : "—";
                  const bedLabel = c.bed_space?.bed_label || c.bedSpace?.bed_label;

                  return (
                    <tr
                      key={c.contract_id}
                      title="Open contract detail"
                      className={interactiveTableRowClass}
                      onClick={() => router.push(`/contracts/${c.contract_id}`)}
                    >
                      <td className="px-6 py-4">
                        <ResourceIdCell id={c.contract_id} prefix="CONTRACT" />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          {tenant ? (
                            <Link
                              href={`/tenants/${tenant.tenant_id}`}
                              className="text-sm font-bold text-stone-900 transition-colors hover:text-teal-700 leading-tight"
                              onClick={stopRowClick}
                            >
                              {tenantName}
                            </Link>
                          ) : (
                            <span className="text-sm text-stone-600">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-sm tabular-nums text-stone-700">
                          {c.move_in_date ? formatDateString(c.move_in_date) : "—"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          {c.room ? (
                            <Link
                              href={`/rooms/${c.room.room_id}`}
                              className="text-sm font-bold text-stone-900 transition-colors hover:text-teal-700 leading-tight"
                              onClick={stopRowClick}
                            >
                              {roomLabel}
                            </Link>
                          ) : (
                            <span className="text-sm text-stone-600">—</span>
                          )}
                          {bedLabel && (
                            <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400 leading-none mt-1">
                              {bedLabel}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                         <span className="font-mono text-sm font-bold tabular-nums text-stone-900">
                          {c.monthly_rate != null ? formatPHP(c.monthly_rate) : "—"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge size="sm">{c.status}</StatusBadge>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <RowOpenIndicator />
                      </td>
                    </tr>
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
              />
            </Card>
          </ResourceView>
        </section>
      </div>
    </StandardPage>
  );
}
