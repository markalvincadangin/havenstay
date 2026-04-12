"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Search, Plus, User, Mail, Phone, ArrowUpRight, Users, Bed, Calendar } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { apiRequest } from "../../lib/api";
import { flattenApiErrors } from "../../lib/errors";
import { canManageTenants } from "../../lib/auth";
import { useAuthGuard } from "../../hooks/useAuthGuard";
import { useTableSort } from "../../hooks/useTableSort";
import { sortClientRows } from "../../lib/tableSort";
import Alert from "../_components/ui/Alert";
import { AppMain } from "../_components/ui/AppShell";
import { Card } from "../_components/ui/Card";
import FilterChips from "../_components/ui/FilterChips";
import { Field, Input, Select } from "../_components/ui/Fields";
import Breadcrumbs from "../_components/ui/Breadcrumbs";
import PageHeader from "../_components/ui/PageHeader";
import { SkeletonListPage } from "../_components/ui/Skeleton";
import { Table } from "../_components/ui/Table";
import UserRoleBadge from "../_components/ui/UserRoleBadge";
import { StatusBadge } from "../_components/ui/StatusBadge";
import { KpiCard } from "../_components/ui/KpiCard";
import EmptyState from "../_components/ui/EmptyState";
import { TENANT_STATUS_LABELS } from "../../lib/constants";
import {
  buildPaginationQuery,
  normalizePaginatedList,
  readStoredPerPage,
} from "../../lib/pagination";
import TablePagination from "../_components/ui/TablePagination";
import {
  compareTenantDirectoryName,
  formatTenantDirectoryName,
  getTenantInitials,
} from "../../lib/formatters";
import { primaryLinkCtaClass } from "../_components/ui/LinkTokens";

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.2, ease: "easeOut" },
};

function TenantAvatar({ tenant }) {
  const initials = getTenantInitials(tenant);
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-[10px] font-bold text-stone-500 ring-1 ring-stone-200">
      {initials}
    </div>
  );
}

export default function TenantsPage() {
  const router = useRouter();
  const { user: currentUser, authLoading } = useAuthGuard();
  const shouldReduceMotion = useReducedMotion();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tenants, setTenants] = useState([]);
  const [listMeta, setListMeta] = useState(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(() => readStoredPerPage());
  const { sortColumn, sortDirection, onSortChange } = useTableSort();

  // Summary Metrics State (Master §18.2)
  const [stats, setStats] = useState({
    activeCount: 0,
    totalBeds: 0,
    pendingExits: 0
  });

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const fetchStats = useCallback(async () => {
    try {
      const [activePage, reportData] = await Promise.all([
        apiRequest("/api/tenants?status=active&per_page=1", { method: "GET" }),
        apiRequest("/api/reports/occupancy", { method: "GET" }).catch(() => null),
      ]);
      const activeTotal = normalizePaginatedList(activePage).meta?.total ?? 0;
      const totalBeds = reportData?.summary?.total_beds ?? 0;
      setStats({
        activeCount: activeTotal,
        totalBeds,
        pendingExits: 0,
      });
    } catch {
      /* KPIs best-effort */
    }
  }, []);

  const fetchTenants = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const extra = {};
      if (debouncedQuery) extra.q = debouncedQuery;
      if (statusFilter !== "all") extra.status = statusFilter;
      const qs = buildPaginationQuery(page, perPage, extra);
      const tenantData = await apiRequest(`/api/tenants${qs}`, { method: "GET" });
      const { rows, meta } = normalizePaginatedList(tenantData);
      setTenants(rows);
      setListMeta(meta);
    } catch (err) {
      setError(flattenApiErrors(err));
    } finally {
      setLoading(false);
    }
  }, [page, perPage, debouncedQuery, statusFilter]);

  useEffect(() => {
    if (authLoading || !currentUser) return;
    fetchStats();
  }, [authLoading, currentUser, fetchStats]);

  useEffect(() => {
    if (authLoading || !currentUser) return;
    fetchTenants();
  }, [authLoading, currentUser, fetchTenants]);

  useEffect(() => {
    flushSync(() => {
      setPage(1);
    });
  }, [debouncedQuery, statusFilter]);

  const sortedRows = useMemo(() => {
    if (!sortColumn) return tenants;
    if (sortColumn === "name") {
      const list = [...tenants];
      const dir = sortDirection === "asc" ? 1 : -1;
      list.sort((a, b) => compareTenantDirectoryName(a, b) * dir);
      return list;
    }
    return sortClientRows(tenants, sortColumn, sortDirection, (t) => {
      switch (sortColumn) {
        case "id":
          return Number(t.tenant_id) || 0;
        case "contact":
          return t.contact_number || "";
        case "room":
          return t.room_code || "";
        case "status":
          return t.status || "";
        default:
          return "";
      }
    });
  }, [tenants, sortColumn, sortDirection]);

  if (authLoading || loading) {
    return (
      <AppMain>
        <SkeletonListPage rows={10} />
      </AppMain>
    );
  }

  const saturation = stats.totalBeds > 0 
    ? Math.round((stats.activeCount / stats.totalBeds) * 100) 
    : 0;

  return (
    <AppMain>
      <motion.div
        initial={shouldReduceMotion ? false : pageVariants.initial}
        animate={shouldReduceMotion ? false : pageVariants.animate}
        transition={shouldReduceMotion ? { duration: 0 } : pageVariants.transition}
        className="space-y-6"
      >
        <PageHeader
          title="Tenant Directory"
          subtitle="Manage profile data, contact details, and historical lease statuses."
          breadcrumbs={<Breadcrumbs items={[{ label: "Tenant Directory" }]} />}
          actions={
            <div className="flex items-center gap-3">
              {canManageTenants(currentUser) && (
                <Link href="/tenants/new" className={primaryLinkCtaClass}>
                  <Plus size={18} aria-hidden />
                  <span>Register Tenant</span>
                </Link>
              )}
              <div className={`flex items-center ${canManageTenants(currentUser) ? "border-l border-stone-200 pl-3" : ""}`}>
                <UserRoleBadge username={currentUser?.username} roleName={currentUser?.role?.role_name} />
              </div>
            </div>
          }
        />

        {/* Operational KPIs (Master §18.2) */}
        <div className="grid gap-4 md:grid-cols-3">
          <KpiCard 
            label="Active Residents" 
            value={stats.activeCount} 
            sub="Currently staying"
            icon={Users}
          />
          <KpiCard 
            label="Bed Saturation" 
            value={`${saturation}%`} 
            sub={`${stats.activeCount} of ${stats.totalBeds} beds used`}
            icon={Bed}
            progress={saturation}
          />
          <KpiCard 
            label="Pending Move-outs" 
            value={stats.pendingExits} 
            sub="Next 30 days"
            icon={Calendar}
          />
        </div>

        <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
          <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/50 px-8 py-5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-stone-100 text-stone-600">
                <User size={14} aria-hidden />
              </div>
              <h2 className="hs-strip-title text-stone-400 tracking-widest uppercase font-black text-sm">Filter Tenants</h2>
            </div>
          </div>

          <div className="p-8">
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
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </Field>
              </div>

              <div className="md:col-span-3">
                <Field label="Status">
                  <Select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
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
                  onClear: () => setQuery(""),
                },
                {
                  key: "status",
                  label: "Status",
                  value: statusFilter !== "all" ? TENANT_STATUS_LABELS[statusFilter] || statusFilter : "",
                  onClear: () => setStatusFilter("all"),
                },
              ]}
              onClearAll={() => {
                setQuery("");
                setStatusFilter("all");
              }}
            />
          </div>
        </Card>

        <div className="mt-6">
          {error ? (
            <Alert variant="error" title="Failed to load tenants">
              {error}
              <button
                type="button"
                onClick={() => {
                  void fetchTenants();
                }}
                className="mt-2 text-xs font-bold underline"
              >
                Retry
              </button>
            </Alert>
          ) : sortedRows.length === 0 ? (
            <EmptyState 
              title="No tenants found"
              message="No records matching your search or filters. Try adjusting your search criteria."
            />
          ) : (
            <Card className="overflow-hidden rounded-2xl border-stone-200 !p-0 shadow-sm">
            <Table
                embedded
                caption={`Directory of current and former resident records — ${listMeta?.total ?? sortedRows.length} matching`}
                columns={[
                  {
                    key: "id",
                    label: "Tenant ID",
                    sortable: true,
                    sortKey: "id",
                    className: "w-[4.5rem]",
                    headerClassName: "!px-4",
                  },
                  { key: "name", label: "Name", sortable: true, sortKey: "name" },
                  { key: "contact", label: "Contact", sortable: true, sortKey: "contact" },
                  { key: "room", label: "Room", sortable: true, sortKey: "room" },
                  { key: "status", label: "Status", sortable: true, sortKey: "status" },
                  { key: "actions", label: "", className: "text-right w-16" },
                ]}
                sortColumn={sortColumn}
                sortDirection={sortDirection}
                onSortChange={onSortChange}
                rows={sortedRows.map((tenant) => (
                  <tr
                    key={tenant.tenant_id}
                    className="group cursor-pointer border-t border-stone-100 transition-colors hover:bg-stone-50 active:bg-stone-100"
                    onClick={() => router.push(`/tenants/${tenant.tenant_id}`)}
                  >
                    <td className="px-4 py-4 align-middle">
                      <span
                        className="font-mono text-[10px] font-bold uppercase tracking-tighter text-stone-400 tabular-nums"
                        title={`Tenant ID ${tenant.tenant_id}`}
                      >
                        #TENANT-{tenant.tenant_id}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <TenantAvatar tenant={tenant} />
                        <p className="text-sm font-bold text-stone-900 leading-snug">
                          {formatTenantDirectoryName(tenant)}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-[11px] font-mono tabular-nums text-stone-600">
                          <Phone size={11} className="text-stone-300" />
                          <span className="tracking-tighter">{tenant.contact_number || "—"}</span>
                        </div>
                        {tenant.email && (
                          <div className="flex items-center gap-2 text-xs text-stone-400">
                            <Mail size={11} className="text-stone-300" />
                            <span className="truncate max-w-[150px]">{tenant.email}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-stone-600">
                          {tenant.room_code ? (
                            <span className="font-bold text-stone-900">Room {tenant.room_code}</span>
                          ) : (
                            <span className="text-stone-400 italic">Unassigned</span>
                          )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge>{tenant.status || "active"}</StatusBadge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {/* Registry Action Pattern (Master §5.8) */}
                      <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-400 transition-[border-color,background-color,color] group-hover:border-teal-200 group-hover:bg-teal-50 group-hover:text-teal-600">
                        <ArrowUpRight size={16} />
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
                disabled={loading}
              />
            </Card>
          )}
        </div>
      </motion.div>
    </AppMain>
  );
}
