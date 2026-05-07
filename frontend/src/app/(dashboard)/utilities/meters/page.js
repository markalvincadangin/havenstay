"use client";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Search, Plus, Activity, Zap, Droplet, ShieldAlert, Droplets } from "lucide-react";
import { fetcher } from "@/lib/api";
import { canManageMeters } from "@/lib/auth";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { usePaginatedFilters } from "@/hooks/usePaginatedFilters";
import { normalizePaginatedList } from "@/lib/pagination";
import Alert from "@/components/ui/Alert";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Fields";
import FilterChips from "@/components/ui/FilterChips";
import PageHeaderActions from "@/components/ui/PageHeaderActions";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table } from "@/components/ui/Table";
import TablePagination from "@/components/ui/TablePagination";
import ResourceView from "@/components/ui/ResourceView";
import ResourceIdCell from "@/components/ui/ResourceIdCell";
import StandardPage from "@/components/ui/StandardPage";
import { SkeletonListPage } from "@/components/ui/Skeleton";
import { KpiCard } from "@/components/ui/KpiCard";
import { METER_STATUS_LABELS, SEARCH_LABELS, SEARCH_PLACEHOLDERS, FILTER_ALL_OPTION, UTILITY_TYPE_FILTER_LABELS } from "@/lib/constants";

import { interactiveTableRowClass } from "@/lib/tableRows";
import RowOpenIndicator from "@/components/ui/RowOpenIndicator";
import { MeterQuickEditForm } from '@/features/utilities/components/MeterQuickEditForm';
import { QuickEditRowAction } from "@/components/ui/QuickEditRowAction";
import { SideSheetOverlay } from "@/components/ui/SideSheetOverlay";
import { ExpandableTableRow } from "@/components/ui/ExpandableTableRow";
import { useState } from "react";
export default function MeterRegistryPage() {
  const router = useRouter();
  const { user: currentUser, authLoading, isUnauthorized } = useAuthGuard();
  const [editingMeter, setEditingMeter] = useState(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const canAccess = useMemo(() => canManageMeters(currentUser), [currentUser]);
  const viewDenied = !authLoading && currentUser !== null && !canAccess;
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
    initialFilters: { query: "", status: "all", utility_id: "all" },
    initialSort: { by: "id", dir: "desc" },
    debounceKeys: ["query"],
    buildExtraParams: ({ filters: current, debounced }) => {
      const extra = {};
      const q = String(debounced.query ?? "").trim();
      if (q) extra.q = q;
      if (current.status !== "all") extra.status = current.status;
      if (current.utility_id !== "all") extra.utility_id = current.utility_id;
      return extra;
    },
  });
  const { data: utilitiesData } = useSWR(
    !authLoading && currentUser && canAccess ? `/api/utilities` : null,
    fetcher
  );
  const utilities = Array.isArray(utilitiesData) ? utilitiesData : [];
  const { data: metersData, error: metersError, isValidating: isSyncing, mutate: refetchMeters } = useSWR(
    !authLoading && currentUser && canAccess ? `/api/meters${queryString}` : null,
    fetcher,
    { keepPreviousData: true }
  );
  const { data: summaryData, isValidating: summaryValidating } = useSWR(
    !authLoading && currentUser && canAccess ? "/api/reports/meter-summary" : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  );
  const { rows: meters = [], meta: listMeta = null } = useMemo(() => {
    if (!metersData) return { rows: [], meta: null };
    return normalizePaginatedList(metersData);
  }, [metersData]);
  const sortedRows = meters;
  const loading = (!metersData && !metersError) || authLoading;
  if (isUnauthorized) return null;
  return (
    <StandardPage
      title="Meter Asset Registry"
      subtitle="Track technical infrastructure, service points, and post history."
      breadcrumbs={<Breadcrumbs items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Utilities", href: "/utilities" }, { label: "Meters" }]} />}
      loading={loading}
      skeleton={<SkeletonListPage rows={6} />}
      actions={
        <PageHeaderActions
          onClick={() => setIsRegistering(true)}
          ctaLabel="Register Meter"
          ctaIcon={Plus}
          ctaClassName="px-8 shadow-lg shadow-teal-900/10"
          user={currentUser}
          hideCta={viewDenied}
        />
      }
    >
      <div className="space-y-6">
        {viewDenied && (
          <Alert variant="warning" title="Access restricted" data-testid="access-denied-meters">
            You do not have permission to view or manage meters. Only administrators and staff can access technical infrastructure.
          </Alert>
        )}
        {!viewDenied && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard
                label="Registered Meters"
                value={summaryData?.total_meters ?? 0}
                icon={Zap}
                sub="Total units monitored"
                isLoading={!summaryData}
                isSyncing={summaryValidating}
                className="hs-glass-effect"
              />
              <KpiCard
                label="Meter Coverage"
                value={`${summaryData?.coverage_pct ?? 0}%`}
                icon={Activity}
                sub="Coverage this period"
                isSuccess={(summaryData?.coverage_pct ?? 0) >= 95}
                isWarning={(summaryData?.coverage_pct ?? 0) < 80}
                isLoading={!summaryData}
                isSyncing={summaryValidating}
                className="hs-glass-effect"
              />
              <KpiCard
                label="Consumption Spikes"
                value={summaryData?.anomalous_spikes ?? 0}
                icon={ShieldAlert}
                sub="Anomalous usage alerts"
                isDanger={(summaryData?.anomalous_spikes ?? 0) > 0}
                isActiveDecision={(summaryData?.anomalous_spikes ?? 0) > 0}
                isLoading={!summaryData}
                isSyncing={summaryValidating}
                className="hs-glass-effect"
              />
              <KpiCard
                label="Pending Data"
                value={summaryData?.total_pending ?? 0}
                icon={Droplets}
                sub="Readings remaining"
                isWarning={(summaryData?.total_pending ?? 0) > 0}
                isLoading={!summaryData}
                isSyncing={summaryValidating}
                className="hs-glass-effect"
              />
            </div>
            <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm hs-glass-effect">
              <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/50 px-6 py-4 sm:px-8 sm:py-5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-stone-100 text-stone-600">
                    <Search size={14} aria-hidden />
                  </div>
                  <h2 className="hs-strip-title text-stone-400 tracking-widest uppercase font-black text-[10px]">
                    Filters
                  </h2>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    resetFilters();
                    refetchMeters();
                  }}
                  className="!h-8 px-3 text-[10px] font-black uppercase tracking-widest text-stone-400 hover:text-teal-600 border border-stone-200 rounded-lg bg-white"
                >
                  Reset
                </Button>
              </div>
              <div className="p-8">
                <div className="grid items-end gap-6 md:grid-cols-12">
                  <div className="md:col-span-12 lg:col-span-12 xl:col-span-6">
                    <Field label={SEARCH_LABELS.meters}>
                      <div className="group relative">
                        <Search
                          className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-stone-400 transition-colors group-focus-within:text-teal-600"
                          aria-hidden
                        />
                        <Input
                          value={filters.query}
                          onChange={(e) => updateFilter("query", e.target.value)}
                          placeholder={SEARCH_PLACEHOLDERS.meters}
                          className="!h-12 border-stone-200 pl-11 font-bold focus:border-teal-500/50"
                        />
                      </div>
                    </Field>
                  </div>
                  <div className="md:col-span-6 lg:col-span-6 xl:col-span-3">
                    <Field label="Utility Type">
                      <Select
                        value={filters.utility_id}
                        onChange={(e) => updateFilter("utility_id", e.target.value)}
                        className="!h-12 border-stone-200 font-bold focus:border-teal-500/50"
                      >
                        <option value="all">{UTILITY_TYPE_FILTER_LABELS.all}</option>
                        {utilities.map((u) => (
                          <option key={u.utility_id} value={u.utility_id}>
                            {u.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </div>
                  <div className="md:col-span-6 lg:col-span-6 xl:col-span-3">
                    <Field label="Meter Status">
                      <Select
                        value={filters.status}
                        onChange={(e) => updateFilter("status", e.target.value)}
                        className="!h-12 border-stone-200 font-bold focus:border-teal-500/50"
                      >
                        <option value="all">{FILTER_ALL_OPTION}</option>
                        {Object.entries(METER_STATUS_LABELS).map(([val, label]) => (
                          <option key={val} value={val}>
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
                    { key: "q", label: "Meters", value: filters.query, onClear: () => updateFilter("query", "") },
                    {
                      key: "utility_id",
                      label: "Utility",
                      value:
                        filters.utility_id !== "all"
                          ? utilities.find((u) => u.utility_id == filters.utility_id)?.name
                          : "",
                      onClear: () => updateFilter("utility_id", "all"),
                    },
                    {
                      key: "status",
                      label: "Meter Status",
                      value: filters.status !== "all" ? METER_STATUS_LABELS[filters.status] : "",
                      onClear: () => updateFilter("status", "all"),
                    },
                  ]}
                  onClearAll={resetFilters}
                />
              </div>
            </Card>

            <ResourceView
              isLoading={loading}
              isSyncing={isSyncing}
              error={metersError}
              isEmpty={meters.length === 0}
              onRetry={() => refetchMeters()}
              skeleton={<SkeletonListPage rows={10} />}
              emptyProps={{
                title: "No meters match filters",
                message: "Adjust your search criteria or register a new hardware unit.",
              }}
            >
              <Card className="overflow-hidden border-stone-200 !p-0 shadow-sm rounded-2xl hs-glass-effect">
                <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/50 px-8 py-4">
                  <h2 className="hs-strip-title uppercase tracking-[0.2em] text-[10px] font-black text-stone-400">
                    METER DIRECTORY
                  </h2>
                  <div className="text-[10px] font-mono font-bold text-stone-400 uppercase tracking-widest leading-none">
                    {listMeta?.total ?? sortedRows.length} METERS MATCHING
                  </div>
                </div>
                <Table
                  embedded={true}
                  dense={true}
                  caption="Registered Utility Meters"
                  sortable={true}
                  sortColumn={sort.by}
                  sortDirection={sort.dir}
                  onSortChange={onSortChange}
                  columns={[
                    { key: "serial", label: "METER ID", sortable: true, className: "pl-8 w-48" },
                    { key: "utility", label: "SERVICE TYPE", sortable: true },
                    {
                      key: "assignment",
                      label: "ASSIGNED TO",
                      sortable: true,
                      sortKey: "room",
                      className: "text-center w-64",
                    },
                    { key: "status", label: "STATUS", sortable: true, className: "text-center" },
                    { key: "actions", label: "", className: "text-right px-8 w-24" },
                  ]}
                  rows={sortedRows.map((meter) => {
                    const activeAssignment = (meter.assignments || []).find((a) => a.valid_to === null);
                    const isElectric = (meter.utility?.name || "").toLowerCase().includes("electric");
                    const UtilityIcon = isElectric ? Zap : Droplet;
                    return (
                      <ExpandableTableRow
                        key={meter.meter_id}
                        className={interactiveTableRowClass}
                        expandableContent={
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border border-stone-200 bg-white rounded-xl p-6 shadow-sm">
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black uppercase text-stone-400 tracking-widest">
                                Hardware Intelligence
                              </span>
                              <div className="mt-2 text-sm text-stone-900 font-mono font-bold">
                                Location: {meter.location || "Central Panel"}{" "}
                                <span className="text-stone-300 mx-3">|</span>
                                Last Reading: {meter.last_reading?.reading_value || "0.00"}{" "}
                                {meter.utility?.unit_of_measurement}
                              </div>
                            </div>
                            <Button
                              onClick={() => router.push(`/utilities/meters/${meter.meter_id}`)}
                              variant="primary"
                              className="!h-10 px-8 text-[10px] font-black tracking-widest uppercase shadow-md active:scale-95 transition-transform bg-stone-900 hover:bg-stone-800"
                            >
                              Access Hardware Profile
                            </Button>
                          </div>
                        }
                      >
                        <td className="pl-8 py-6">
                          <div className="flex flex-col">
                            <ResourceIdCell id={meter.meter_id} type="meter" />
                            <span className="mt-1 font-mono text-[10px] font-black text-stone-400 uppercase tracking-widest">
                              Hardware Serial: {meter.serial_number}
                            </span>
                          </div>
                        </td>
                        <td className="py-6">
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex h-8 w-8 items-center justify-center rounded-lg ${isElectric ? "bg-amber-50 text-amber-600" : "bg-sky-50 text-sky-600"
                                }`}
                            >
                              <UtilityIcon size={16} />
                            </div>
                            <span className="text-sm font-bold text-stone-900 group-hover:text-teal-700 transition-colors">
                              {meter.utility?.name || "Generic Utility"}
                            </span>
                          </div>
                        </td>
                        <td className="py-6 text-center">
                          {activeAssignment ? (
                            <div className="flex flex-col items-center">
                              <span className="text-xs font-black text-stone-900 uppercase tracking-wide">
                                {activeAssignment.room_code || activeAssignment.room_id}
                              </span>
                              <span className="mt-1 text-[10px] font-mono font-bold text-stone-400 uppercase tracking-widest leading-none">
                                {meter.location || "Main Panel"}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[10px] font-bold text-stone-300 uppercase tracking-widest border border-stone-100 rounded px-2 py-0.5">
                              Unassigned
                            </span>
                          )}
                        </td>
                        <td className="py-6 text-center">
                          <StatusBadge>{meter.status}</StatusBadge>
                        </td>
                        <td className="px-8 py-6 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-2">
                            <QuickEditRowAction
                              disabled={!canAccess || meter.status === "replaced"}
                              onClick={() => setEditingMeter(meter)}
                              title={
                                meter.status === "replaced"
                                  ? "Replaced meter — historical record only"
                                  : "Update details"
                              }
                            />
                            <RowOpenIndicator />
                          </div>
                        </td>
                      </ExpandableTableRow>
                    );
                  })}
                  emptyTitle="No meters found"
                  emptyDescription="Clear filters or adjust search criteria."
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
                  className="hs-glass-effect"
                />
              </Card>
            </ResourceView>
          </div>
        )}
      </div>
      <SideSheetOverlay
        isOpen={isRegistering || !!editingMeter}
        onClose={() => {
          setIsRegistering(false);
          setEditingMeter(null);
        }}
        title={isRegistering ? "Register Meter" : "Quick Update"}
      >
        <MeterQuickEditForm
          meter={editingMeter}
          currentUser={currentUser}
          onSuccess={() => {
            setIsRegistering(false);
            setEditingMeter(null);
            refetchMeters();
          }}
          onCancel={() => {
            setIsRegistering(false);
            setEditingMeter(null);
          }}
        />
      </SideSheetOverlay>
    </StandardPage>
  );
}
