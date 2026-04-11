"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { FileText, Plus, Search, ArrowUpRight } from "lucide-react";

import { apiRequest } from "../../lib/api";
import { flattenApiErrors } from "../../lib/errors";
import { canManageContracts } from "../../lib/auth";
import { useAuthGuard } from "../../hooks/useAuthGuard";
import { useTableSort } from "../../hooks/useTableSort";
import { sortClientRows } from "../../lib/tableSort";
import { formatDateRange, formatPHP } from "../../lib/formatters";
import Alert from "../_components/ui/Alert";
import { AppMain } from "../_components/ui/AppShell";
import { Card } from "../_components/ui/Card";
import { Field, Input, Select } from "../_components/ui/Fields";
import FilterChips from "../_components/ui/FilterChips";
import Breadcrumbs from "../_components/ui/Breadcrumbs";
import PageHeader from "../_components/ui/PageHeader";
import { SkeletonListPage } from "../_components/ui/Skeleton";
import UserRoleBadge from "../_components/ui/UserRoleBadge";
import { primaryLinkCtaClass } from "../_components/ui/primaryLinkClasses";
import { Table } from "../_components/ui/Table";
import { StatusBadge } from "../../components/ui/StatusBadge";

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.2, ease: "easeOut" },
};

export default function ContractsListPage() {
  const router = useRouter();
  const { user: currentUser, authLoading } = useAuthGuard();
  const shouldReduceMotion = useReducedMotion();
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState("");
  const [contracts, setContracts] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const { sortColumn, sortDirection, onSortChange } = useTableSort();

  useEffect(() => {
    if (authLoading || !currentUser) return;

    const fetchContracts = async () => {
      try {
        const data = await apiRequest("/api/contracts", { method: "GET" });
        setContracts(Array.isArray(data) ? data : data?.contracts || []);
      } catch (error) {
        setApiError(flattenApiErrors(error));
      } finally {
        setLoading(false);
      }
    };
    fetchContracts();
  }, [authLoading, currentUser]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return contracts.filter((c) => {
      const status = String(c.status || "").toLowerCase();
      const matchStatus = statusFilter === "all" || status === statusFilter;
      if (!matchStatus) return false;
      if (!q) return true;

      const tenant = c.tenant;
      const tenantName = tenant
        ? `${tenant.first_name || ""} ${tenant.last_name || ""}`.toLowerCase()
        : "";
      const roomCode = String(c.room?.room_code || "").toLowerCase();
      return (
        String(c.contract_id).includes(q) ||
        tenantName.includes(q) ||
        roomCode.includes(q)
      );
    });
  }, [contracts, searchQuery, statusFilter]);

  const sortedFiltered = useMemo(() => {
    if (!sortColumn) return filtered;
    return sortClientRows(filtered, sortColumn, sortDirection, (c) => {
      const tenant = c.tenant;
      switch (sortColumn) {
        case "contract_id":
          return Number(c.contract_id) || 0;
        case "tenant":
          return tenant ? `${tenant.last_name || ""} ${tenant.first_name || ""}` : "";
        case "room":
          return c.room?.room_code || "";
        case "period":
          return c.move_in_date || "";
        case "monthly_rate":
          return Number(c.monthly_rate) || 0;
        case "status":
          return c.status || "";
        default:
          return "";
      }
    });
  }, [filtered, sortColumn, sortDirection]);

  if (authLoading || loading) {
    return (
      <AppMain>
        <SkeletonListPage rows={10} />
      </AppMain>
    );
  }

  const canWrite = canManageContracts(currentUser);

  return (
    <AppMain>
      <motion.div
        initial={shouldReduceMotion ? false : pageVariants.initial}
        animate={shouldReduceMotion ? false : pageVariants.animate}
        transition={shouldReduceMotion ? { duration: 0 } : pageVariants.transition}
        className="space-y-6"
      >
        <PageHeader
          title="Contract Registry"
          subtitle="Chronological ledger of active and historical lease agreements."
          breadcrumbs={<Breadcrumbs items={[{ label: "Contract Registry" }]} />}
          actions={
            <div className="flex items-center gap-3">
              {canWrite ? (
                <Link
                  href="/contracts/new"
                  className={primaryLinkCtaClass + " gap-2 !px-5 shadow-sm"}
                >
                  <Plus size={18} aria-hidden />
                  <span>Register contract</span>
                </Link>
              ) : null}
              <div className={`flex items-center ${canWrite ? "border-l border-stone-200 pl-3" : ""}`}>
                <UserRoleBadge username={currentUser?.username} roleName={currentUser?.role?.role_name} />
              </div>
            </div>
          }
        />

        <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
          <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/50 px-6 py-4 sm:px-8 sm:py-5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-stone-100 text-stone-600">
                <FileText size={14} aria-hidden />
              </div>
              <h2 className="hs-strip-title">Registry Filters</h2>
            </div>
          </div>

          <div className="p-6">
            {!canWrite ? (
              <div className="mb-6">
                <Alert variant="info" title="Read-only access">
                  Your role can view lease agreements; only Admin or Staff can register contracts.
                </Alert>
              </div>
            ) : null}

            <div className="grid items-end gap-6 md:grid-cols-12">
              <div className="md:col-span-8 lg:col-span-9">
                <Field label="Search">
                  <div className="group relative">
                    <Search
                      className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-stone-400 transition-colors group-focus-within:text-teal-600"
                      aria-hidden
                    />
                    <Input
                      placeholder="Tenant name, room code, or contract ID…"
                      className="!h-12 border-stone-200 pl-11 transition-[border-color,box-shadow] focus:border-teal-500/50 focus:ring-4 focus:ring-teal-500/5"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
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
                    <option value="completed">Completed</option>
                    <option value="terminated">Terminated</option>
                  </Select>
                </Field>
              </div>
            </div>

            <FilterChips
              className="mt-6"
              items={[
                {
                  key: "search",
                  label: "Search",
                  value: searchQuery,
                  onClear: () => setSearchQuery(""),
                },
                {
                  key: "status",
                  label: "Status",
                  value: statusFilter !== "all" ? statusFilter : "",
                  onClear: () => setStatusFilter("all"),
                },
              ]}
              onClearAll={() => {
                setSearchQuery("");
                setStatusFilter("all");
              }}
            />
          </div>
        </Card>

        <div className="mt-6">
          {apiError ? (
            <Alert variant="error" title="Could not load contracts">
              {apiError}
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-2 text-xs font-bold underline"
              >
                Retry
              </button>
            </Alert>
          ) : (
            <Table
              caption="Registry of lease agreements"
              columns={[
                { key: "contract_id", label: "Registry ID", sortable: true, sortKey: "contract_id" },
                { key: "tenant", label: "Tenant Name", sortable: true, sortKey: "tenant" },
                { key: "room", label: "Room Code", sortable: true, sortKey: "room" },
                { key: "period", label: "Lease Period", sortable: true, sortKey: "period" },
                { key: "monthly_rate", label: "Monthly Rate", sortable: true, sortKey: "monthly_rate" },
                { key: "status", label: "Status", sortable: true, sortKey: "status" },
                { key: "actions", label: "", className: "text-right" },
              ]}
              sortColumn={sortColumn}
              sortDirection={sortDirection}
              onSortChange={onSortChange}
              rows={sortedFiltered.map((c) => {
                const tenant = c.tenant;
                const tenantName = tenant ? `${tenant.first_name} ${tenant.last_name}` : "—";
                const roomLabel = c.room?.room_code ? `Room ${c.room.room_code}` : "—";
                const period = formatDateRange(c.move_in_date, c.expected_move_out_date);

                return (
                  <tr
                    key={c.contract_id}
                    title="View lease details"
                    className="group cursor-pointer border-t border-stone-100 transition-colors hover:bg-stone-50 active:bg-stone-100"
                    onClick={() => router.push(`/contracts/${c.contract_id}`)}
                  >
                    <td className="px-6 py-4">
                      <span className="font-mono text-[10px] font-bold uppercase tracking-tighter text-stone-400">
                        #CONTRACT-{c.contract_id}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {tenant ? (
                        <Link
                          href={`/tenants/${tenant.tenant_id}`}
                          className="text-sm font-bold text-stone-900 hover:text-teal-700"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {tenantName}
                        </Link>
                      ) : (
                        <span className="text-sm text-stone-600">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {c.room ? (
                        <Link
                          href={`/rooms/${c.room.room_id}`}
                          className="text-sm font-bold text-stone-900 hover:text-teal-700"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {roomLabel}
                        </Link>
                      ) : (
                        <span className="text-sm text-stone-600">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-stone-600">{period}</td>
                    <td className="px-6 py-4 text-right font-mono text-sm font-bold tabular-nums text-stone-900">
                      {c.monthly_rate != null ? formatPHP(c.monthly_rate) : "—"}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge size="sm">{c.status}</StatusBadge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="ml-auto inline-flex size-8 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-400 transition-[border-color,box-shadow,colors] group-hover:border-teal-200 group-hover:bg-teal-50 group-hover:text-teal-600">
                        <ArrowUpRight size={16} aria-hidden />
                      </div>
                    </td>
                  </tr>
                );
              })}
              emptyTitle="No lease records"
              emptyDescription="Try different filters, or register a contract when a new agreement is ready."
            />
          )}
        </div>
      </motion.div>
    </AppMain>
  );
}
