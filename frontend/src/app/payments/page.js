"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, FileText, Plus, Search } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { apiRequest } from "../../lib/api";
import { flattenApiErrors } from "../../lib/errors";
import { canManageBilling, canViewBilling } from "../../lib/auth";
import { useAuthGuard } from "../../hooks/useAuthGuard";
import { useTableSort } from "../../hooks/useTableSort";
import { sortClientRows } from "../../lib/tableSort";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { formatDateString, formatPHP } from "../../lib/formatters";
import { StatusBadge } from "../../components/ui/StatusBadge";
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

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.2, ease: "easeOut" },
};

/** Payments have no `status` column — derive from voided_at (see schema). */
function paymentRowStatus(p) {
  return p?.voided_at ? "voided" : "posted";
}

function paymentCalendarDay(p) {
  if (!p?.payment_date) return "";
  return String(p.payment_date).slice(0, 10);
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

function VoidConfirmModal({ payment, tenantName, onConfirm, onCancel, loading }) {
  const modalRef = useFocusTrap(true);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.5)]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="void-modal-title"
    >
      <div 
        ref={modalRef}
        className="mx-4 w-full max-w-[480px] rounded-2xl border border-stone-200 bg-white p-8 shadow-[0_20px_48px_rgba(0,0,0,0.18)]"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50">
            <AlertTriangle className="h-5 w-5 text-red-800" aria-hidden="true" />
          </div>
          <div>
            <h3 id="void-modal-title" className="hs-strip-title text-base text-stone-900">
              Void Payment
            </h3>
          </div>
        </div>

        <div className="mt-4 space-y-1 text-sm text-stone-600">
          <p>Are you sure you want to void this payment?</p>
          <div className="mt-3 rounded-xl border border-stone-200 bg-stone-50/80 px-4 py-3 text-sm">
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              <span className="font-medium text-stone-800">Payment ID</span>
              <span className="font-mono text-[10px] font-bold uppercase tracking-tighter text-stone-500">
                #{payment?.payment_id}
              </span>
              <span className="font-medium text-stone-800">Tenant</span>
              <span className="text-stone-800">{tenantName}</span>
              <span className="font-medium text-stone-800">Amount</span>
              <span className="font-mono font-semibold text-stone-900">{formatPHP(payment?.amount_paid)}</span>
              <span className="font-medium text-stone-800">Date</span>
              <span className="text-stone-800">{formatDateString(payment?.payment_date)}</span>
            </div>
          </div>
          <p className="mt-3 text-sm font-semibold text-red-800">
            This action cannot be undone. The payment will be marked as voided and the billing balance will be adjusted.
          </p>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button type="button" variant="danger" onClick={onConfirm} loading={loading}>
            Void Payment
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function PaymentsListPage() {
  const router = useRouter();
  const { user: currentUser, authLoading } = useAuthGuard();
  const shouldReduceMotion = useReducedMotion();
  const [loading, setLoading] = useState(true);
  const [viewDenied, setViewDenied] = useState(false);
  const [apiError, setApiError] = useState("");
  const [payments, setPayments] = useState([]);
  const [voidModal, setVoidModal] = useState(null); // { payment, tenantName }
  const [voidLoading, setVoidLoading] = useState(false);
  const [voidError, setVoidError] = useState("");

  const [tenantQuery, setTenantQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const { sortColumn, sortDirection, onSortChange } = useTableSort();

  const canPostPayments = useMemo(() => canManageBilling(currentUser), [currentUser]);

  useEffect(() => {
    if (authLoading || !currentUser) return;

    const fetchPayments = async () => {
      if (!canViewBilling(currentUser)) {
        setViewDenied(true);
        setLoading(false);
        return;
      }

      try {
        const data = await apiRequest("/api/payments", { method: "GET" });
        setPayments(Array.isArray(data) ? data : data?.payments || []);
      } catch (error) {
        setApiError(flattenApiErrors(error));
      } finally {
        setLoading(false);
      }
    };

    fetchPayments();
  }, [authLoading, currentUser]);

  // Escape key handler for void modal
  useEffect(() => {
    if (!voidModal) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setVoidModal(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [voidModal]);

  const handleVoidClick = (payment, tenantName) => {
    setVoidError("");
    setVoidModal({ payment, tenantName });
  };

  const handleVoidConfirm = async () => {
    if (!voidModal) return;
    setVoidLoading(true);
    setVoidError("");
    try {
      await apiRequest(`/api/payments/${voidModal.payment.payment_id}`, { method: "DELETE" });
      setPayments((prev) =>
        prev.map((p) =>
          p.payment_id === voidModal.payment.payment_id
            ? { ...p, voided_at: new Date().toISOString() }
            : p
        )
      );
      setVoidModal(null);
    } catch (error) {
      const message = flattenApiErrors(error);
      setVoidError(message);
    } finally {
      setVoidLoading(false);
    }
  };

  // KPI calculations per payments.md spec
  const collectedToday = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return payments
      .filter((p) => paymentCalendarDay(p) === today && paymentRowStatus(p) === "posted")
      .reduce((sum, p) => sum + Number(p.amount_paid || 0), 0);
  }, [payments]);

  const collectedThisMonth = useMemo(() => {
    const thisMonth = new Date().toISOString().slice(0, 7);
    return payments
      .filter((p) => paymentCalendarDay(p).slice(0, 7) === thisMonth && paymentRowStatus(p) === "posted")
      .reduce((sum, p) => sum + Number(p.amount_paid || 0), 0);
  }, [payments]);

  const filtered = useMemo(() => {
    const q = tenantQuery.trim().toLowerCase();
    const from = dateFrom ? new Date(dateFrom) : null;
    const to = dateTo ? new Date(dateTo) : null;

    return payments.filter((payment) => {
      const paymentDate = payment.payment_date ? new Date(payment.payment_date) : null;
      if (from && paymentDate && paymentDate < from) return false;
      if (to && paymentDate && paymentDate > to) return false;

      if (statusFilter !== "all" && paymentRowStatus(payment) !== statusFilter) return false;

      if (!q) return true;

      const tenant = payment?.billing?.contract?.tenant;
      const tenantName = tenant ? `${tenant.last_name || ""} ${tenant.first_name || ""}`.trim() : "";
      const tenantId = tenant?.tenant_id ?? "";
      const contractId = payment?.billing?.contract_id ?? "";

      return (
        tenantName.toLowerCase().includes(q) ||
        String(tenantId).toLowerCase().includes(q) ||
        String(contractId).toLowerCase().includes(q) ||
        String(payment.billing_id).toLowerCase().includes(q) ||
        String(payment.payment_id).toLowerCase().includes(q)
      );
    });
  }, [payments, tenantQuery, dateFrom, dateTo, statusFilter]);

  const sortedFiltered = useMemo(() => {
    if (!sortColumn) return filtered;
    return sortClientRows(filtered, sortColumn, sortDirection, (p) => {
      const tenant = p?.billing?.contract?.tenant;
      switch (sortColumn) {
        case "payment_id":
          return Number(p.payment_id) || 0;
        case "date":
          return p.payment_date || "";
        case "tenant":
          return tenant ? `${tenant.last_name || ""} ${tenant.first_name || ""}` : "";
        case "period":
          return p?.billing?.billing_period_from || "";
        case "amount":
          return Number(p.amount_paid) || 0;
        case "method":
          return p.payment_method || "";
        case "reference":
          return p.reference_number || "";
        case "status":
          return paymentRowStatus(p);
        default:
          return "";
      }
    });
  }, [filtered, sortColumn, sortDirection]);

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
            title="Payments"
            subtitle="Chronological ledger of payments, reference codes, and contract links."
            breadcrumbs={<Breadcrumbs items={[{ label: "Payments" }]} />}
            actions={
              <UserRoleBadge username={currentUser?.username} roleName={currentUser?.role?.role_name} />
            }
          />
          <Alert variant="warning" title="Access restricted">
            You do not have permission to view payment history.
          </Alert>
        </motion.div>
      </AppMain>
    );
  }

  return (
    <AppMain>
      {voidModal ? (
        <VoidConfirmModal
          payment={voidModal.payment}
          tenantName={voidModal.tenantName}
          onConfirm={handleVoidConfirm}
          onCancel={() => setVoidModal(null)}
          loading={voidLoading}
        />
      ) : null}

      <motion.div
        className="space-y-6"
        initial={shouldReduceMotion ? false : pageVariants.initial}
        animate={shouldReduceMotion ? false : pageVariants.animate}
        transition={shouldReduceMotion ? { duration: 0 } : pageVariants.transition}
      >
        <PageHeader
          title="Payments"
          subtitle="Posted collections and references—filter by Tenant, status, or date."
          breadcrumbs={<Breadcrumbs items={[{ label: "Payments" }]} />}
          actions={
            <div className="flex flex-wrap items-center justify-end gap-3">
              {canPostPayments ? (
                <Link href="/payments/new" className={primaryLinkCtaClass + " !h-11 min-h-[44px] rounded-xl text-xs font-black tracking-widest shadow-sm"}>
                  <Plus size={18} aria-hidden />
                  <span>Receive Payment</span>
                </Link>
              ) : (
                <Button type="button" variant="secondary" disabled className="h-11 min-h-[44px]">
                  Record Payment
                </Button>
              )}
              <div className={`flex items-center ${canPostPayments ? "border-l border-stone-200 pl-3" : ""}`}>
                <UserRoleBadge username={currentUser?.username} roleName={currentUser?.role?.role_name} />
              </div>
            </div>
          }
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <KpiCard
            label="Total Collected Today"
            value={formatPHP(collectedToday)}
            valueClass="text-emerald-800"
          />
          <KpiCard
            label="Total Collected This Month"
            value={formatPHP(collectedThisMonth)}
            valueClass="text-emerald-800"
          />
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
            {!canPostPayments ? (
              <div className="mb-6">
                <Alert variant="info" title="Read-only access">
                  Your role can review payment history; only Admin or Staff can record or void payments.
                </Alert>
              </div>
            ) : null}

            <div className="grid items-end gap-6 lg:grid-cols-12">
              <div className="lg:col-span-5">
                <Field label="Search">
                  <Input
                    icon={Search}
                    value={tenantQuery}
                    onChange={(e) => setTenantQuery(e.target.value)}
                    placeholder="Tenant name, ID, or billing ID…"
                    className="!h-12 border-stone-200 transition-[border-color,box-shadow] focus:ring-4 focus:ring-teal-500/5"
                  />
                </Field>
              </div>
              <div className="lg:col-span-2">
                <Field label="Status">
                  <Select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="!h-12 border-stone-200 focus:border-teal-500/50"
                  >
                    <option value="all">All statuses</option>
                    <option value="posted">Posted</option>
                    <option value="voided">Voided</option>
                  </Select>
                </Field>
              </div>
              <div className="lg:col-span-2">
                <Field label="Date From">
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="!h-12 border-stone-200 focus:border-teal-500/50"
                  />
                </Field>
              </div>
              <div className="lg:col-span-3">
                <Field label="Date To">
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="!h-12 border-stone-200 focus:border-teal-500/50"
                  />
                </Field>
              </div>
            </div>
            <FilterChips
              className="mt-6"
              items={[
                { key: "tenant", label: "Search", value: tenantQuery, onClear: () => setTenantQuery("") },
                {
                  key: "status",
                  label: "Status",
                  value: statusFilter !== "all" ? statusFilter : "",
                  onClear: () => setStatusFilter("all"),
                },
                { key: "from", label: "Date From", value: dateFrom, onClear: () => setDateFrom("") },
                { key: "to", label: "Date To", value: dateTo, onClear: () => setDateTo("") },
              ]}
              onClearAll={() => {
                setTenantQuery("");
                setStatusFilter("all");
                setDateFrom("");
                setDateTo("");
              }}
            />
          </div>
        </Card>

        {apiError ? (
          <Alert variant="error" title="Could not load payments">
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
        {voidError ? (
          <Alert variant="error" title="Void failed">
            {voidError}
            <button
              type="button"
              onClick={() => setVoidError("")}
              className="mt-2 text-xs font-bold underline hover:opacity-80"
            >
              Dismiss
            </button>
          </Alert>
        ) : null}

      <div className="mt-6">
        <Table
          caption="Payments history list"
          ariaLabel="Payments history table"
          columns={[
            { key: "payment_id", label: "Payment ID", sortable: true, sortKey: "payment_id" },
            { key: "date", label: "Date", sortable: true, sortKey: "date" },
            { key: "tenant", label: "Tenant Name", sortable: true, sortKey: "tenant" },
            { key: "period", label: "Billing Period", sortable: true, sortKey: "period" },
            { key: "amount", label: "Amount", sortable: true, sortKey: "amount" },
            { key: "method", label: "Method", sortable: true, sortKey: "method" },
            { key: "reference", label: "Reference", sortable: true, sortKey: "reference" },
            { key: "status", label: "Status", sortable: true, sortKey: "status" },
            { key: "actions", label: "", className: "text-right" },
          ]}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onSortChange={onSortChange}
          rows={sortedFiltered.map((payment) => {
            const tenant = payment?.billing?.contract?.tenant;
            const tenantName = tenant ? `${tenant.last_name || ""}, ${tenant.first_name || ""}` : "—";
            const periodFrom = payment?.billing?.billing_period_from;
            const periodTo = payment?.billing?.billing_period_to;
            const rowStatus = paymentRowStatus(payment);
            const isVoided = rowStatus === "voided";

            return (
              <tr
                key={payment.payment_id}
                title="Open payment receipt"
                className="group cursor-pointer border-t border-stone-100 transition-colors hover:bg-stone-50 active:bg-stone-100 focus:outline-none focus-visible:shadow-[0_0_0_3px_rgba(13,148,136,0.3)]"
                onClick={() => router.push(`/payments/${payment.payment_id}`)}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    router.push(`/payments/${payment.payment_id}`);
                  }
                }}
              >
                <td className="px-6 py-4">
                  <span className="font-mono text-[10px] font-bold tracking-tighter text-stone-400">
                    #{payment.payment_id}
                  </span>
                </td>

                <td className="px-6 py-4 text-sm text-stone-600">{formatDateString(payment.payment_date)}</td>

                <td className="px-6 py-4 text-sm font-medium text-stone-900">{tenantName}</td>

                <td className="px-6 py-4 text-xs text-stone-600">
                  {periodFrom && periodTo
                    ? `${formatDateString(periodFrom)} – ${formatDateString(periodTo)}`
                    : "—"}
                </td>

                <td className="px-6 py-4 text-right font-mono text-sm tabular-nums">
                  {isVoided ? (
                    <span className="text-stone-500 line-through opacity-60">{formatPHP(payment.amount_paid)}</span>
                  ) : (
                    <span className="font-semibold text-emerald-800">{formatPHP(payment.amount_paid)}</span>
                  )}
                </td>

                <td className="px-6 py-4 text-[10px] font-bold tracking-widest text-stone-500">
                  {payment.payment_method || "—"}
                </td>

                <td className="px-6 py-4 font-mono text-xs text-stone-500">{payment.reference_number || "—"}</td>

                <td className="px-6 py-4">
                  <StatusBadge>{rowStatus}</StatusBadge>
                </td>

                <td className="px-6 py-4 text-right">
                  <div className="flex flex-wrap items-center justify-end gap-3 text-xs font-bold">
                    <Link
                      href={`/payments/${payment.payment_id}`}
                      className="text-teal-700 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      View
                    </Link>
                    <Link
                      href={`/billing/${payment.billing_id}`}
                      className="text-teal-600 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Billing
                    </Link>
                    {canPostPayments && !isVoided ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleVoidClick(payment, tenantName);
                        }}
                        className="cursor-pointer text-red-800 hover:underline"
                      >
                        Void
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
          emptyTitle="No payment records found"
          emptyDescription="Adjust your search, status, or date range filters."
        />
      </div>
      </motion.div>
    </AppMain>
  );
}
