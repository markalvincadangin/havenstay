"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Search, Plus, User, Mail, Phone, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
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
import { StatusBadge } from "../../components/ui/StatusBadge";

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.2, ease: "easeOut" },
};

function TenantAvatar({ label }) {
  const initials = label
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

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
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const { sortColumn, sortDirection, onSortChange } = useTableSort();

  useEffect(() => {
    if (authLoading || !currentUser) return;

    const fetchTenants = async () => {
      try {
        const data = await apiRequest("/api/tenants", { method: "GET" });
        setTenants(Array.isArray(data) ? data : data?.tenants || []);
      } catch (err) {
        setError(flattenApiErrors(err));
      } finally {
        setLoading(false);
      }
    };
    fetchTenants();
  }, [authLoading, currentUser]);

  const rows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return tenants.filter((tenant) => {
      const matchesSearch =
        !normalizedQuery ||
        tenant.first_name.toLowerCase().includes(normalizedQuery) ||
        tenant.last_name.toLowerCase().includes(normalizedQuery) ||
        String(tenant.contact_number || "").includes(query) ||
        (tenant.email && tenant.email.toLowerCase().includes(normalizedQuery)) ||
        String(tenant.tenant_id || "").includes(normalizedQuery);

      const matchesStatus =
        statusFilter === "all" || tenant.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [query, statusFilter, tenants]);

  const sortedRows = useMemo(() => {
    if (!sortColumn) return rows;
    return sortClientRows(rows, sortColumn, sortDirection, (t) => {
      switch (sortColumn) {
        case "name":
          return `${t.last_name || ""} ${t.first_name || ""}`;
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
  }, [rows, sortColumn, sortDirection]);

  if (authLoading || loading) {
    return (
      <AppMain>
        <SkeletonListPage rows={10} />
      </AppMain>
    );
  }

  return (
    <AppMain>
      <motion.div
        initial={shouldReduceMotion ? false : pageVariants.initial}
        animate={shouldReduceMotion ? false : pageVariants.animate}
        transition={shouldReduceMotion ? { duration: 0 } : pageVariants.transition}
        className="space-y-6"
      >
        <PageHeader
          title="Tenant Registry"
          subtitle="Tenants on file — active, moved out, and archived."
          breadcrumbs={<Breadcrumbs items={[{ label: "Tenant Registry" }]} />}
          actions={
            <div className="flex items-center gap-3">
              {canManageTenants(currentUser) && (
                <Link
                  href="/tenants/new"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-teal-600 px-6 text-xs font-black tracking-widest text-white shadow-lg shadow-teal-900/10 transition-colors hover:bg-teal-700"
                >
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

        <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
          <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/50 px-6 py-4 sm:px-8 sm:py-5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-stone-100 text-stone-600">
                <User size={14} aria-hidden />
              </div>
              <h2 className="hs-strip-title">Registry Filters</h2>
            </div>
          </div>

          <div className="p-6">
            {!canManageTenants(currentUser) && (
              <div className="mb-6">
                <Alert variant="info" title="Read-only Access">
                  Your current session is restricted to viewing records only.
                </Alert>
              </div>
            )}

            <div className="grid gap-6 md:grid-cols-12 items-end">
              <div className="md:col-span-8 lg:col-span-9">
                <Field label="Search">
                  <Input
                    icon={Search}
                    placeholder="Name, phone, email, or tenant ID…"
                    className="!h-12 border-stone-200 focus:ring-4 focus:ring-teal-500/5 transition-[border-color,box-shadow]"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </Field>
              </div>

              <div className="md:col-span-4 lg:col-span-3">
                <Field label="Status">
                  <Select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="!h-12 border-stone-200 focus:border-teal-500/50"
                  >
                    <option value="all">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="moved_out">Moved Out</option>
                    <option value="archived">Archived</option>
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
                  value: statusFilter !== "all" ? statusFilter : "",
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
              <button type="button" onClick={() => window.location.reload()} className="mt-2 text-xs font-bold underline">
                Retry
              </button>
            </Alert>
          ) : (
            <Table
                caption="Registry of current and former tenants"
                columns={[
                  { key: "name", label: "Tenant Name", sortable: true, sortKey: "name" },
                  { key: "contact", label: "Contact Details", sortable: true, sortKey: "contact" },
                  { key: "room", label: "Room Code", sortable: true, sortKey: "room" },
                  { key: "status", label: "Status", sortable: true, sortKey: "status" },
                  { key: "actions", label: "", className: "text-right" },
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
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <TenantAvatar label={`${tenant.first_name} ${tenant.last_name}`} />
                        <div>
                          <p className="text-sm font-bold text-stone-900 leading-tight">
                            {tenant.first_name} {tenant.last_name}
                          </p>
                          <p className="mt-1 font-mono text-[10px] font-bold text-stone-400 tracking-tighter">
                            #TENANT-{tenant.tenant_id}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs text-stone-600">
                          <Phone size={12} className="text-stone-300" />
                          <span className="font-mono tracking-tighter">{tenant.contact_number || "—"}</span>
                        </div>
                        {tenant.email && (
                          <div className="flex items-center gap-2 text-xs text-stone-400">
                            <Mail size={12} className="text-stone-300" />
                            <span className="truncate max-w-[150px]">{tenant.email}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                          {tenant.room_code ? `Room ${tenant.room_code}` : "—"}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge size="sm">{tenant.status || "active"}</StatusBadge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-400 transition-[border-color,background-color,color] group-hover:border-teal-200 group-hover:bg-teal-50 group-hover:text-teal-600">
                        <ArrowUpRight size={16} />
                      </div>
                    </td>
                  </tr>
                ))}
                emptyTitle="No tenants found"
                emptyDescription="No records matching your search or filters."
              />
          )}
        </div>
      </motion.div>
    </AppMain>
  );
}
