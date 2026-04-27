"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import {
  Plus,
  Zap,
  Droplet,
  Box,
  Activity,
  Search,
  Server,
  AlertCircle,
  ArrowUpRight
} from "lucide-react";
import { fetcher } from "@/lib/api";
import { canManageMeters, canManageUsers } from "@/lib/auth";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { formatPHP } from "@/lib/formatters";
import Alert from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import PageHeaderActions from "@/components/ui/PageHeaderActions";
import { StatusBadge } from "@/components/ui/StatusBadge";
import ResourceView from "@/components/ui/ResourceView";
import StandardPage from "@/components/ui/StandardPage";
import {
  SkeletonGridPage
} from "@/components/ui/Skeleton";
import { KpiCard } from "@/components/ui/KpiCard";
import FilterPanelCard from "@/components/ui/FilterPanelCard";
import { Field, Input } from "@/components/ui/Fields";
import TablePagination from "@/components/ui/TablePagination";
import { SideSheetOverlay } from "@/components/ui/SideSheetOverlay";
import { QuickEditRowAction } from "@/components/ui/QuickEditRowAction";
import { UtilityQuickEditForm } from "@/features/utilities/components/UtilityQuickEditForm";

/**
 * Utility Catalog Hub — /utilities
 *
 * FR: FR-028, FR-031
 * BR: BR-MET-007
 * TC: TC-04
 * API: GET /api/utilities
 */

export default function UtilitiesPage() {
  const { user: currentUser, authLoading, isUnauthorized } = useAuthGuard();
  const [searchQuery, setSearchQuery] = useState("");
  const [editingUtility, setEditingUtility] = useState(null);

  const canAccess = useMemo(() => canManageMeters(currentUser), [currentUser]);
  const isAdmin = useMemo(() => canManageUsers(currentUser), [currentUser]);
  const viewDenied = !authLoading && currentUser !== null && !canAccess;

  const {
    data: utilitiesData,
    error: utilitiesError,
    isValidating: isSyncing,
    mutate: refetchUtilities
  } = useSWR(
    !authLoading && currentUser && canAccess ? `/api/utilities` : null,
    fetcher
  );

  const utilities = useMemo(() => {
    if (!Array.isArray(utilitiesData)) return [];
    if (!searchQuery) return utilitiesData;
    const q = searchQuery.toLowerCase();
    return utilitiesData.filter(u =>
      u.name.toLowerCase().includes(q) ||
      u.unit_of_measurement.toLowerCase().includes(q)
    );
  }, [utilitiesData, searchQuery]);

  const stats = useMemo(() => {
    if (!utilitiesData) return { count: 0, meters: 0, issues: 0 };
    return {
      count: utilitiesData.length,
      meters: utilitiesData.reduce((acc, u) => acc + (u.meters?.length || 0), 0),
      issues: utilitiesData.filter(u => !u.active_rate).length
    };
  }, [utilitiesData]);

  const loading = !utilitiesData && !utilitiesError;

  if (isUnauthorized) return null;

  return (
    <StandardPage
      title="Utility Services"
      subtitle="Manage utility services and rates."
      loading={authLoading || loading}
      skeleton={<SkeletonGridPage cards={3} />}
      actions={
        <PageHeaderActions
          ctaLabel="Register Service"
          ctaHref="/utilities/new"
          ctaIcon={Plus}
          ctaClassName="px-8 shadow-lg shadow-teal-900/10"
          user={currentUser}
          hideCta={viewDenied || !isAdmin}
          secondaryLabel="Meter Directory"
          secondaryHref="/utilities/meters"
          secondaryIcon={Activity}
        />
      }
    >
      <div className="space-y-8">
        {viewDenied && (
          <Alert variant="warning" title="Access restricted" data-testid="access-denied-utilities">
            You do not have permission to view or manage utilities. Only operational staff can access the metrology hub.
          </Alert>
        )}

        {!viewDenied && (
          <>
            {/* KPI Overview */}
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <KpiCard
                label="Provisioned Services"
                value={stats.count}
                sub="Total utility categories"
                icon={Server}
                isLoading={loading}
                className="hs-glass-effect"
              />
              <KpiCard
                label="Active Meters"
                value={stats.meters}
                sub="Total units monitored"
                icon={Activity}
                isLoading={loading}
                isSuccess={stats.meters > 0}
                className="hs-glass-effect"
              />
              <KpiCard
                label="Service Alerts"
                value={stats.issues}
                sub="Missing active rates"
                icon={AlertCircle}
                isLoading={loading}
                isDanger={stats.issues > 0}
                isActiveDecision={stats.issues > 0}
                className="hs-glass-effect"
              />
            </div>

            {/* Filter Section */}
            <FilterPanelCard icon={Search} title="Filters">
              <div className="max-w-md">
                <Field label="Search by name or unit" className="!mb-0">
                  <Input
                    placeholder="Search services..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    icon={Search}
                  />
                </Field>
              </div>
            </FilterPanelCard>

            <ResourceView
              isLoading={loading}
              isSyncing={isSyncing}
              error={utilitiesError}
              isEmpty={utilities.length === 0}
              onRetry={() => refetchUtilities()}
              skeleton={<SkeletonGridPage rows={1} cards={3} />}
              emptyProps={{
                title: searchQuery ? "No results found" : "No utilities registered",
                description: searchQuery
                  ? "Try adjusting your search terms to find a specific service."
                  : "There are no billable services found in the database. Contact an administrator to map a utility.",
              }}
            >
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {utilities.map((utility) => {
                  const isElectric = utility.name.toLowerCase().includes("electric");
                  const isWater = utility.name.toLowerCase().includes("water");
                  const UtilityIcon = isElectric ? Zap : (isWater ? Droplet : Box);

                  const activeRateFormatted = utility.active_rate?.base_rate
                    ? formatPHP(utility.active_rate.base_rate)
                    : "—";

                  return (
                    <Card key={utility.utility_id} className="relative overflow-hidden border-stone-200 !p-0 shadow-sm rounded-2xl flex flex-col hover:border-teal-200 hover:shadow-lg hover:-translate-y-1 transition-all group duration-300 hs-glass-effect">
                      <div className="flex items-start justify-between border-b border-stone-100 bg-stone-50/50 p-6">
                        <div className="flex items-center gap-4">
                          <div className={`flex h-12 w-12 items-center justify-center rounded-xl shadow-inner transition-colors ${isElectric ? 'bg-amber-50 text-amber-500 group-hover:bg-amber-100' : (isWater ? 'bg-sky-50 text-sky-500 group-hover:bg-sky-100' : 'bg-stone-50 text-stone-500')}`}>
                            <UtilityIcon size={24} strokeWidth={2.5} />
                          </div>
                          <div>
                            <h2 className="text-lg font-black text-stone-900 tracking-tight leading-tight group-hover:text-teal-900 transition-colors">{utility.name}</h2>
                            <div className="text-[10px] font-mono font-bold text-stone-400 tracking-widest uppercase mt-1">
                              {utility.unit_of_measurement}
                            </div>
                          </div>
                        </div>
                        <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
                      </div>

                      <div className="p-8 flex-1 flex flex-col justify-center">
                        <div className="mb-2 text-[10px] uppercase font-black tracking-widest text-stone-400">Base Service Rate</div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-mono font-black text-stone-900 tabular-nums tracking-tighter">
                            {activeRateFormatted}
                          </span>
                          <span className="text-xs font-bold text-stone-500">per {utility.unit_of_measurement}</span>
                        </div>

                        {!utility.active_rate && (
                          <div className="mt-4">
                            <StatusBadge size="sm">Rate Missing</StatusBadge>
                          </div>
                        )}

                        <div className="mt-6 grid grid-cols-2 gap-4 border-t border-stone-100 pt-6">
                          <div>
                            <p className="text-[9px] font-bold text-stone-400 uppercase tracking-widest">Meters</p>
                            <p className="text-sm font-black text-stone-900 font-mono">{utility.meters?.length || 0} units</p>
                          </div>
                          <div>
                            <p className="text-[9px] font-bold text-stone-400 uppercase tracking-widest">Pricing</p>
                            <p className="text-sm font-black text-stone-900 font-mono">{utility.rates?.length || 0} rates</p>
                          </div>
                        </div>
                      </div>

                      <Link
                        href={`/utilities/${utility.utility_id}`}
                        className="flex items-center justify-between border-t border-stone-100/50 bg-stone-50/50 px-6 py-3.5 mt-auto"
                      >
                        <span className="text-[10px] font-black tracking-[0.2em] text-stone-400 transition-colors group-hover:text-teal-600 uppercase">
                          View Service Details
                        </span>
                        <div className="flex items-center gap-2.5">
                          <QuickEditRowAction
                            disabled={!canAccess}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setEditingUtility(utility);
                            }}
                            title="Update service configuration"
                          />
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-stone-100 bg-white text-stone-300 transition-[border-color,background-color,color] group-hover:border-teal-200 group-hover:bg-teal-50 group-hover:text-teal-600">
                            <ArrowUpRight size={14} aria-hidden />
                          </div>
                        </div>
                      </Link>
                    </Card>
                  );
                })}
              </div>

              <TablePagination
                meta={{
                  current_page: 1,
                  last_page: 1,
                  per_page: utilities.length,
                  total: utilities.length,
                  from: 1,
                  to: utilities.length
                }}
                page={1}
                perPage={utilities.length}
                onPageChange={() => { }}
                onPerPageChange={() => { }}
                className="mt-8 rounded-2xl border border-stone-200 bg-white shadow-sm hs-glass-effect"
              />
            </ResourceView>
          </>
        )}
      </div>

      <SideSheetOverlay
        isOpen={!!editingUtility}
        onClose={() => setEditingUtility(null)}
        title="Service Configuration"
        subtitle={editingUtility?.name?.toUpperCase()}
      >
        {editingUtility && (
          <UtilityQuickEditForm
            utility={editingUtility}
            onCancel={() => setEditingUtility(null)}
            onSuccess={() => {
              setEditingUtility(null);
              refetchUtilities();
            }}
          />
        )}
      </SideSheetOverlay>
    </StandardPage>
  );
}
