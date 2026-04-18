"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { PlusCircle, Wallet, LayoutGrid, AlertCircle, Search, PackageCheck } from "lucide-react";
import useSWR from "swr";
import { motion } from "framer-motion";

import { fetcher } from "../../../lib/api";
import { canManageUsers } from "../../../lib/auth";
import { formatPHP, formatDateString } from "../../../lib/formatters";
import Alert from "../../_components/ui/Alert";
import Breadcrumbs from "../../_components/ui/Breadcrumbs";
import Button from "../../_components/ui/Button";
import { Card } from "../../_components/ui/Card";
import { Table } from "../../_components/ui/Table";
import { StatusBadge } from "../../_components/ui/StatusBadge";
import StandardPage from "../../_components/ui/StandardPage";
import FilterPanelCard from "../../_components/ui/FilterPanelCard";
import ResourceIdCell from "../../_components/ui/ResourceIdCell";
import { useAuth } from "../../_context/AuthContext";
import { usePaginatedFilters } from "../../../hooks/usePaginatedFilters";
import FilterChips from "../../_components/ui/FilterChips";
import { Field, Input, Select } from "../../_components/ui/Fields";
import { KpiCard } from "../../_components/ui/KpiCard";
import ResourceView from "../../_components/ui/ResourceView";
import PageHeaderActions from "../../_components/ui/PageHeaderActions";
import { SkeletonListPage } from "../../_components/ui/Skeleton";
import { interactiveTableRowClass } from "../../../lib/tableRows";
import { normalizePaginatedList } from "../../../lib/pagination";
import TablePagination from "../../_components/ui/TablePagination";
import { useTableSort } from "../../../hooks/useTableSort";
import { sortClientRows } from "../../../lib/tableSort";
import RowOpenIndicator from "../../_components/ui/RowOpenIndicator";

export default function ItemRegistryPage() {
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
        if (current.status !== "all") extra.is_active = current.status === "active";
        return extra;
      },
    });

  const { data: applianceData, error, isValidating, mutate } = useSWR(
    currentUser ? `/api/appliances${queryString}` : null,
    fetcher,
    { keepPreviousData: true, dedupingInterval: 30000 }
  );

  const { rows: appliances = [], meta = null } = useMemo(() => {
    if (!applianceData) return { rows: [], meta: null };
    return normalizePaginatedList(applianceData);
  }, [applianceData]);

  const { sortColumn, sortDirection, onSortChange } = useTableSort();

  const sortedRows = useMemo(() => {
    return sortClientRows(appliances, sortColumn, sortDirection, (item) => {
      switch (sortColumn) {
        case "id": return Number(item.add_on_id);
        case "name": return item.item_name;
        case "active_count": return Number(item.active_contracts_count ?? 0);
        case "rate": return Number(item.default_monthly_rate);
        case "status": return item.is_active ? 1 : 0;
        case "updated": return item.updated_at;
        default: return "";
      }
    });
  }, [appliances, sortColumn, sortDirection]);

  const loading = !applianceData && !error;
  const canManage = useMemo(() => canManageUsers(currentUser), [currentUser]);

  const { data: stats, isValidating: statsValidating } = useSWR(
    currentUser ? "/api/appliances/stats" : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  );

  return (
    <StandardPage
      title="Assets & Services"
      subtitle="OPERATIONAL REGISTRY OF AMENITIES AND BILLABLE ADD-ONS"
      breadcrumbs={
        <Breadcrumbs items={[
          { label: "Administration", href: "/admin/items" },
          { label: "Assets & Services" }
        ]} />
      }
      loading={loading}
      skeleton={<SkeletonListPage rows={10} />}
      error={error}
      actions={
        <PageHeaderActions
          ctaHref={canManage ? "/admin/items/new" : null}
          ctaLabel="Add New Item"
          ctaIcon={PlusCircle}
          user={currentUser}
        />
      }
    >
      <div className="space-y-6">
        <ResourceView
          isLoading={loading}
          isSyncing={isValidating}
          error={error}
          isEmpty={appliances.length === 0 && !isValidating}
          onRetry={() => mutate()}
          skeleton={<SkeletonListPage rows={10} />}
          emptyProps={{
            title: "No Items Found",
            message: "Current search criteria returned zero results. Try adjusting the availability filter."
          }}
        >
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <KpiCard
                label="Monthly Yield"
                icon={Wallet}
                value={formatPHP(stats?.projected_monthly_yield || 0)}
                sub="PROJECTED REVENUE"
                isLoading={!stats}
                isSyncing={statsValidating}
              />
              <KpiCard
                label="Active Assignments"
                value={stats?.active_assignments || 0}
                icon={LayoutGrid}
                isLoading={!stats}
                isSyncing={statsValidating}
              />
              <KpiCard
                label="Total Catalog"
                value={stats?.total_items || 0}
                icon={PackageCheck}
                isLoading={!stats}
                isSyncing={statsValidating}
              />
            </div>

            <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
              <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/50 px-6 py-4 sm:px-8 sm:py-5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-stone-100 text-stone-600">
                    <Search size={14} aria-hidden />
                  </div>
                  <h2 className="hs-strip-title text-stone-400 tracking-widest uppercase font-black text-[10px]">
                    Search & Filters
                  </h2>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={resetFilters}
                  className="!h-8 px-3 text-[10px] font-black uppercase tracking-widest text-stone-400 hover:text-teal-600 border border-stone-200 rounded-lg bg-white"
                >
                  Reset Filters
                </Button>
              </div>
              <div className="p-8">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:gap-8">
                  <div className="flex-1">
                    <Field label="Search Registry">
                      <div className="group relative">
                        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400 group-focus-within:text-teal-600 transition-colors" />
                        <Input
                          placeholder="Search by asset name..."
                          value={filters.query}
                          onChange={(e) => updateFilter("query", e.target.value)}
                          className="!h-12 border-stone-200 pl-10 font-bold transition-[border-color,box-shadow] focus:border-teal-500/50 focus:ring-4 focus:ring-teal-500/5"
                        />
                      </div>
                    </Field>
                  </div>
                  <div className="w-full lg:w-64">
                    <Field label="Availability Status">
                      <Select
                        value={filters.status}
                        onChange={(e) => updateFilter("status", e.target.value)}
                        className="!h-12 border-stone-200 font-bold focus:border-teal-500/50"
                      >
                        <option value="all">ALL ITEMS</option>
                        <option value="active">AVAILABLE ONLY</option>
                        <option value="inactive">HIDDEN ONLY</option>
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
                      value: filters.query,
                      onClear: () => updateFilter("query", "")
                    },
                    {
                      key: "status",
                      label: "Availability",
                      value: filters.status !== "all" ? (filters.status === "active" ? "Available" : "Hidden") : "",
                      onClear: () => updateFilter("status", "all"),
                    },
                  ]}
                  onClearAll={resetFilters}
                />
              </div>
            </Card>

            <Card className="!p-0 overflow-hidden border-stone-200 rounded-2xl shadow-sm">
              <div className="bg-stone-50/50 px-8 py-4 border-b border-stone-100 flex items-center justify-between">
                <h2 className="hs-strip-title uppercase tracking-[0.2em] text-[10px] font-black text-stone-400">Inventory Status</h2>
                <span className="font-mono text-[9px] font-bold text-stone-400 uppercase tracking-widest">{meta?.total || 0} Records</span>
              </div>
              <Table
                embedded
                columns={[
                  { key: "id", label: "ID", sortable: true, className: "pl-8 w-32", headerClassName: "hs-strip-title !text-[10px] tracking-[0.2em]" },
                  { key: "name", label: "DESCRIPTION", sortable: true, headerClassName: "hs-strip-title !text-[10px] tracking-[0.2em]" },
                  { key: "active_count", label: "CURRENTLY IN USE", sortable: true, className: "text-center", headerClassName: "hs-strip-title !text-[10px] tracking-[0.2em] text-center" },
                  { key: "rate", label: "MONTHLY FEE", sortable: true, className: "text-right", headerClassName: "hs-strip-title !text-[10px] tracking-[0.2em] text-right" },
                  { key: "status", label: "AVAILABILITY", sortable: true, className: "w-32 text-center", headerClassName: "hs-strip-title !text-[10px] tracking-[0.2em] text-center" },
                  { key: "updated", label: "UPDATED", sortable: true, className: "text-right px-8", headerClassName: "hs-strip-title !text-[10px] tracking-[0.2em] text-right" },
                  { key: "actions", label: "", className: "w-16 px-8", headerClassName: "hs-strip-title !text-[10px] tracking-[0.2em]" },
                ]}
                sortColumn={sortColumn}
                sortDirection={sortDirection}
                onSortChange={onSortChange}
                rows={sortedRows.map((item) => (
                  <tr
                    key={item.add_on_id}
                    className={interactiveTableRowClass}
                    onClick={() => router.push(`/admin/items/${item.add_on_id}`)}
                  >
                    <td className="px-8 py-5">
                      <ResourceIdCell id={item.add_on_id} prefix="ITM" />
                    </td>
                    <td className="py-5">
                      <span className="text-sm font-bold text-stone-900 group-hover:text-teal-700 transition-colors uppercase tracking-tight">
                        {item.item_name}
                      </span>
                    </td>
                    <td className="py-5 text-center">
                      <div className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-3 py-1 border border-stone-200/50">
                        <div className="size-1.5 rounded-full bg-teal-500 animate-pulse" />
                        <span className="font-mono text-xs font-black text-stone-700">{item.active_contracts_count ?? 0}</span>
                      </div>
                    </td>
                    <td className="py-5 text-right font-mono text-sm font-black text-stone-900 tabular-nums">
                      {formatPHP(item.default_monthly_rate)}
                    </td>
                    <td className="py-5 text-center">
                      <StatusBadge variant={item.is_active ? "success" : "neutral"} size="sm">
                        {item.is_active ? "AVAILABLE" : "HIDDEN"}
                      </StatusBadge>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <span className="font-mono text-[10px] font-bold uppercase tracking-tighter text-stone-400">
                        {item.updated_at ? formatDateString(item.updated_at) : "—"}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <RowOpenIndicator />
                    </td>
                  </tr>
                ))}
              />
              <TablePagination
                meta={meta}
                page={page}
                perPage={perPage}
                onPageChange={setPage}
                onPerPageChange={(n) => {
                  setPage(1);
                  setPerPage(n);
                }}
                disabled={loading || isValidating}
              />
            </Card>
          </div>
        </ResourceView>
      </div>
    </StandardPage>
  );
}
