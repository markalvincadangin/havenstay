"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { FileText, Plus, Search } from "lucide-react";
import { apiRequest } from "../../lib/api";
import { flattenApiErrors } from "../../lib/errors";
import { canManageBilling, canViewBilling } from "../../lib/auth";
import { useAuthGuard } from "../../hooks/useAuthGuard";
import { useTableSort } from "../../hooks/useTableSort";
import { sortClientRows } from "../../lib/tableSort";
import { isPastDueReceivable } from "../../lib/billingReceivables";
import { formatDateString, formatPHP } from "../../lib/formatters";
import Alert from "../_components/ui/Alert";
import { AppMain } from "../_components/ui/AppShell";
import Button from "../_components/ui/Button";
import { Card } from "../_components/ui/Card";
import FilterChips from "../_components/ui/FilterChips";
import { Field, Input, Select } from "../_components/ui/Fields";
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

function safeLower(value) {
  return String(value ?? "").toLowerCase();
}

function KpiCard({ label, value, valueClass = "" }) {
  return (
    <div
      className="rounded-2xl border border-stone-200 bg-white px-6 py-5 shadow-sm"
      aria-label={label}
    >
      <div className="mb-2 text-[10px] font-bold tracking-widest text-stone-500">
        {label}
      </div>
      <div className={`text-2xl font-black leading-none tracking-tight tabular-nums text-stone-900 sm:text-3xl ${valueClass}`}>
        {value}
      </div>
    </div>
  );
}

export default function BillingListPage() {
  const router = useRouter();
  const { user: currentUser, authLoading } = useAuthGuard();
  const shouldReduceMotion = useReducedMotion();
  const [loading, setLoading] = useState(true);
  const [viewDenied, setViewDenied] = useState(false);
  const [apiError, setApiError] = useState("");
  const [billings, setBillings] = useState([]);

  const [statusFilter, setStatusFilter] = useState("all");
  const [tenantQuery, setTenantQuery] = useState("");
  const { sortColumn, sortDirection, onSortChange } = useTableSort();

  useEffect(() => {
    if (authLoading || !currentUser) return;

    const fetchBillings = async () => {
      if (!canViewBilling(currentUser)) {
        setViewDenied(true);
        setLoading(false);
        return;
      }

      try {
        const data = await apiRequest("/api/billing", { method: "GET" });
        setBillings(Array.isArray(data) ? data : data?.billings || []);
      } catch (error) {
        setApiError(flattenApiErrors(error));
      } finally {
        setLoading(false);
      }
    };

    fetchBillings();
  }, [authLoading, currentUser]);

  const filtered = useMemo(() => {
    const q = tenantQuery.trim().toLowerCase();
    return billings.filter((billing) => {
      const status = safeLower(billing.status);
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "overdue"
          ? isPastDueReceivable(billing)
          : status === statusFilter);
      if (!matchesStatus) return false;

      if (!q) return true;

      const tenant = billing?.contract?.tenant;
      const tenantName = tenant ? `${tenant.last_name || ""} ${tenant.first_name || ""}`.trim() : "";
      return (
        safeLower(tenantName).includes(q) ||
        safeLower(tenant?.contact_number).includes(q) ||
        safeLower(billing?.contract?.tenant_id).includes(q) ||
        safeLower(billing?.billing_id).includes(q)
      );
    });
  }, [billings, statusFilter, tenantQuery]);

  const sortedFiltered = useMemo(() => {
    if (!sortColumn) return filtered;
    return sortClientRows(filtered, sortColumn, sortDirection, (b) => {
      const tenant = b?.contract?.tenant;
      switch (sortColumn) {
        case "billing_id":
          return Number(b.billing_id) || 0;
        case "tenant":
          return tenant ? `${tenant.last_name || ""} ${tenant.first_name || ""}` : "";
        case "room":
          return b?.contract?.room?.room_code || String(b?.contract?.room_id ?? "");
        case "period":
          return b.billing_period_from || "";
        case "due_date":
          return b.due_date || "";
        case "total_amount":
          return Number(b.total_amount) || 0;
        case "total_paid":
          return Number(b.total_paid) || 0;
        case "balance":
          return Number(b.balance) || 0;
        case "status":
          return b.status || "";
        default:
          return "";
      }
    });
  }, [filtered, sortColumn, sortDirection]);

  const totalOutstanding = useMemo(
    () =>
      billings
        .filter((b) => ["unpaid", "partial", "overdue"].includes(b.status))
        .reduce((sum, b) => sum + Number(b.balance), 0),
    [billings],
  );

  const pastDueAmount = useMemo(
    () => billings.filter((b) => isPastDueReceivable(b)).reduce((sum, b) => sum + Number(b.balance), 0),
    [billings],
  );

  const collectedThisMonth = useMemo(() => {
    const thisMonth = new Date().toISOString().slice(0, 7);
    return billings
      .filter((b) => b.billing_period_from?.slice(0, 7) === thisMonth)
      .reduce((sum, b) => sum + Number(b.total_paid), 0);
  }, [billings]);

  const canGenerateBilling = useMemo(() => canManageBilling(currentUser), [currentUser]);

  if (authLoading || loading) {
    return (
      <AppMain>
        <SkeletonListPage />
      </AppMain>
    );
  }

  if (viewDenied) {
    return (
      <AppMain>
        <motion.div
          className="space-y-6"
          initial={shouldReduceMotion ? false : pageVariants.initial}
          animate={shouldReduceMotion ? false : pageVariants.animate}
          transition={shouldReduceMotion ? { duration: 0 } : pageVariants.transition}
        >
          <PageHeader
            title="Billing"
            subtitle="Monitor account balances and track monthly billing cycles across all contracts."
            breadcrumbs={<Breadcrumbs items={[{ label: "Billing" }]} />}
            actions={
              <UserRoleBadge username={currentUser?.username} roleName={currentUser?.role?.role_name} />
            }
          />
          <Alert variant="warning" title="Access restricted">
            You do not have permission to view billing records.
          </Alert>
        </motion.div>
      </AppMain>
    );
  }

  return (
    <AppMain>
      <motion.div
        className="space-y-6"
        initial={shouldReduceMotion ? false : pageVariants.initial}
        animate={shouldReduceMotion ? false : pageVariants.animate}
        transition={shouldReduceMotion ? { duration: 0 } : pageVariants.transition}
      >
        <PageHeader
          title="Billing"
          subtitle="Monitor account balances and track monthly billing cycles across all contracts."
          breadcrumbs={<Breadcrumbs items={[{ label: "Billing" }]} />}
          actions={
            <div className="flex flex-wrap items-center justify-end gap-3">
               {canGenerateBilling ? (
                <Link href="/billing/new" className={primaryLinkCtaClass + " gap-2 !px-5 shadow-sm"}>
                  <Plus size={18} aria-hidden />
                  <span>Generate Bill</span>
                </Link>
              ) : (
                <Button type="button" variant="secondary" disabled className="h-11 min-h-[44px]">
                  Generate Bill
                </Button>
              )}
              <div className={`flex items-center ${canGenerateBilling ? "border-l border-stone-200 pl-3" : ""}`}>
                <UserRoleBadge username={currentUser?.username} roleName={currentUser?.role?.role_name} />
              </div>
            </div>
          }
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <KpiCard
            label="Total Outstanding"
            value={formatPHP(totalOutstanding)}
            valueClass="text-stone-900"
          />
          <KpiCard
            label="Past Due Amount"
            value={formatPHP(pastDueAmount)}
            valueClass={pastDueAmount > 0 ? "text-red-800" : "text-stone-900"}
          />
          <KpiCard label="Collected This Month" value={formatPHP(collectedThisMonth)} valueClass="text-emerald-800" />
        </div>

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
            {!canGenerateBilling ? (
              <div className="mb-6">
                <Alert variant="info" title="Read-only access">
                  Your role can review billing cycles; only Admin or Staff can create billing entries or record payments.
                </Alert>
              </div>
            ) : null}

            <div className="grid items-end gap-6 md:grid-cols-12">
              <div className="md:col-span-8 lg:col-span-9">
                <Field label="Search">
                  <Input
                    icon={Search}
                    value={tenantQuery}
                    onChange={(event) => setTenantQuery(event.target.value)}
                    placeholder="Tenant name, phone, or billing ID…"
                    className="!h-12 border-stone-200 transition-[border-color,box-shadow] focus:ring-4 focus:ring-teal-500/5"
                  />
                </Field>
              </div>
              <div className="md:col-span-4 lg:col-span-3">
                <Field label="Status">
                  <Select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                    className="!h-12 border-stone-200 focus:border-teal-500/50"
                  >
                    <option value="all">All Statuses</option>
                    <option value="unpaid">Unpaid</option>
                    <option value="partial">Partial</option>
                    <option value="paid">Paid</option>
                    <option value="overdue">Past due</option>
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
                  value: tenantQuery,
                  onClear: () => setTenantQuery(""),
                },
                {
                  key: "status",
                  label: "Status",
                  value:
                    statusFilter !== "all"
                      ? statusFilter === "overdue"
                        ? "past due"
                        : statusFilter
                      : "",
                  onClear: () => setStatusFilter("all"),
                },
              ]}
              onClearAll={() => {
                setTenantQuery("");
                setStatusFilter("all");
              }}
            />
          </div>
        </Card>

        {apiError ? (
          <Alert variant="error" title="Could not load billing">
            {apiError}
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-2 text-xs font-bold underline hover:opacity-80"
            >
              Retry
            </button>
          </Alert>
        ) : null}

        <div className="mt-6">
          <Table
            caption="Billing cycles by Tenant and room"
            ariaLabel="Billing records table"
            columns={[
              { key: "billing_id", label: "Billing ID", sortable: true, sortKey: "billing_id" },
              { key: "tenant", label: "Tenant Name", sortable: true, sortKey: "tenant" },
              { key: "room", label: "Room Code", sortable: true, sortKey: "room" },
              { key: "period", label: "Billing Period", sortable: true, sortKey: "period" },
              { key: "due_date", label: "Due Date", sortable: true, sortKey: "due_date" },
              { key: "total_amount", label: "Total", sortable: true, sortKey: "total_amount" },
              { key: "total_paid", label: "Paid", sortable: true, sortKey: "total_paid" },
              { key: "balance", label: "Balance", sortable: true, sortKey: "balance" },
              { key: "status", label: "Status", sortable: true, sortKey: "status" },
              { key: "actions", label: "", className: "text-right" },
            ]}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onSortChange={onSortChange}
            rows={sortedFiltered.map((billing) => {
              const tenant = billing?.contract?.tenant;
              const tenantName = tenant ? `${tenant.last_name || ""}, ${tenant.first_name || ""}` : "—";
              const roomCode = billing?.contract?.room?.room_code ? `Room ${billing.contract.room.room_code}` : (billing?.contract?.room_id ? `Room ${billing.contract.room_id}` : "—");
              const amountDue = Number(billing.total_amount);
              const amountPaid = Number(billing.total_paid);
              const balance = Number(billing.balance);

              return (
                <tr
                  key={billing.billing_id}
                  title="Open billing record"
                  className="group cursor-pointer border-t border-stone-100 transition-colors hover:bg-stone-50 active:bg-stone-100 focus:outline-none focus-visible:shadow-[0_0_0_3px_rgba(13,148,136,0.3)]"
                  onClick={() => router.push(`/billing/${billing.billing_id}`)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      router.push(`/billing/${billing.billing_id}`);
                    }
                  }}
                >
                  <td className="px-6 py-4">
                    <span className="font-mono text-[10px] font-bold tracking-tighter text-stone-400">
                      #{billing.billing_id}
                    </span>
                  </td>

                  <td className="px-6 py-4 text-sm font-medium text-stone-900">{tenantName}</td>

                  <td className="px-6 py-4 text-sm text-stone-600">{roomCode}</td>

                  <td className="px-6 py-4 text-xs text-stone-600">
                    {formatDateString(billing.billing_period_from)} – {formatDateString(billing.billing_period_to)}
                  </td>

                  <td className="px-6 py-4 text-sm text-stone-600">{formatDateString(billing.due_date)}</td>

                  <td className="px-6 py-4 text-right font-mono text-sm tabular-nums text-stone-900">
                    {formatPHP(amountDue)}
                  </td>

                  <td className="px-6 py-4 text-right font-mono text-sm tabular-nums text-emerald-800">
                    {formatPHP(amountPaid)}
                  </td>

                  <td className="px-6 py-4 text-right font-mono text-sm tabular-nums">
                    {balance < 0 ? (
                      <span className="inline-flex items-center gap-1.5 text-emerald-800">
                        <span className="font-semibold">{formatPHP(Math.abs(balance))}</span>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            padding: "2px 8px",
                            borderRadius: "999px",
                            fontSize: "0.7rem",
                            fontWeight: "500",
                            border: "1px solid #A7F3D0",
                            backgroundColor: "#ECFDF5",
                            color: "#065F46",
                            whiteSpace: "nowrap",
                          }}
                        >
                          Credit
                        </span>
                      </span>
                    ) : balance === 0 ? (
                      <span className="text-stone-500">{formatPHP(0)}</span>
                    ) : (
                      <span className="font-semibold text-stone-900">{formatPHP(balance)}</span>
                    )}
                  </td>

                  <td className="px-6 py-4">
                    <StatusBadge>{billing.status}</StatusBadge>
                  </td>

                  <td className="px-6 py-4 text-right">
                    <div className="flex flex-wrap items-center justify-end gap-3 text-xs font-bold">
                      <Link
                        href={`/billing/${billing.billing_id}`}
                        className="text-teal-700 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        View
                      </Link>
                      {canGenerateBilling && balance > 0 ? (
                        <Link
                          href={`/payments/new?billing_id=${billing.billing_id}`}
                          className="text-teal-600 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Pay
                        </Link>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
            emptyTitle="No billing cycles"
            emptyDescription="Adjust filters, or create a billing entry when a new cycle is ready."
          />
        </div>
      </motion.div>
    </AppMain>
  );
}
