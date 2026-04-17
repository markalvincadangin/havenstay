"use client";

import { useEffect, useState, useMemo } from "react";
import useSWR from "swr";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  Edit2,
  User,
  DoorOpen,
  Calendar,
  FileCheck,
  Receipt,
  History,
  MapPin,
  ShieldCheck,
  Wallet,
  Clock,
} from "lucide-react";

import { apiRequest, fetcher } from "../../../lib/api";
import { canManageContracts } from "../../../lib/auth";
import { useAuthGuard } from "../../../hooks/useAuthGuard";
import { flattenApiErrors } from "../../../lib/errors";
import {
  formatDateRange,
  formatDateString,
  formatPHP,
  formatTenantDirectoryName,
} from "../../../lib/formatters";
import { isContractActive } from "../../../lib/constants";
import { SkeletonDetailPage } from "../../_components/ui/Skeleton";
import Alert from "../../_components/ui/Alert";
import Breadcrumbs from "../../_components/ui/Breadcrumbs";
import Button from "../../_components/ui/Button";
import { Card } from "../../_components/ui/Card";
import { Field, Input, Textarea } from "../../_components/ui/Fields";
import { StatusBadge } from "../../_components/ui/StatusBadge";
import { Table } from "../../_components/ui/Table";
import { secondaryOutlineLinkClass } from "../../_components/ui/LinkTokens";
import StandardPage from "../../_components/ui/StandardPage";
import ResourceIdCell from "../../_components/ui/ResourceIdCell";
import PageHeaderActions from "../../_components/ui/PageHeaderActions";
import { normalizePaginatedList } from "../../../lib/pagination";
import SectionCard from "../../_components/ui/SectionCard";

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.2, ease: "easeOut" },
};

function DetailRow({ label, value, icon: Icon, mono = false }) {
  return (
    <div className="flex items-start justify-between border-b border-stone-50 py-3.5 last:border-0 hover:bg-stone-50/50 transition-colors">
      <div className="flex items-center gap-2.5">
        <div className="text-stone-300">
          <Icon size={14} strokeWidth={2.5} />
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">{label}</span>
      </div>
      <span
        className={`max-w-[220px] text-right text-sm font-semibold text-stone-900 ${mono ? "font-mono tabular-nums" : ""}`}
      >
        {value ?? "—"}
      </span>
    </div>
  );
}

function MetricItem({ label, value, icon: Icon }) {
  return (
    <div className="flex items-center gap-4 border-b border-stone-100 py-4 last:border-0 hover:bg-stone-50/30 transition-colors">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-stone-50 text-stone-400 border border-white/60 shadow-sm">
        <Icon size={18} strokeWidth={2.5} />
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 leading-none mb-1.5">{label}</p>
        <p className="text-sm font-black text-stone-900 tabular-nums leading-none">{value}</p>
      </div>
    </div>
  );
}

function MoveOutModal({ open, contract, onClose, onConfirm, isSubmitting }) {
  const cancelBtnId = "moveout-cancel-btn";
  const tenant = contract?.tenant;
  const room = contract?.room;

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm({ defaultValues: { actual_move_out: "", notes: "" } });

  useEffect(() => {
    if (open) {
      reset({ actual_move_out: "", notes: "" });
      setTimeout(() => document.getElementById(cancelBtnId)?.focus(), 50);
    }
  }, [open, reset]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && !isSubmitting) onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, isSubmitting, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="moveout-modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        aria-label="Close move-out dialog"
        disabled={isSubmitting}
        onClick={onClose}
      />

      <div className="relative w-full max-w-[480px] rounded-2xl border border-stone-200 bg-white p-8 shadow-2xl">
        <div className="mb-6 flex items-start gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-amber-50 shadow-sm shadow-amber-900/10">
            <AlertTriangle className="size-6 text-amber-600" aria-hidden />
          </div>
          <div>
            <h2 id="moveout-modal-title" className="text-xl font-black tracking-tight text-stone-900">
              Process Move-out
            </h2>
            <p className="mt-0.5 text-sm text-stone-500">This will finalize the active agreement and release its occupied inventory while preserving historical and audit records.</p>
          </div>
        </div>

        <div className="mb-6 rounded-2xl border border-stone-100 bg-stone-50/50 p-5 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Record</p>
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Resident</span>
            <span className="text-sm font-black text-stone-900">{tenant ? formatTenantDirectoryName(tenant) : "—"}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Unit</span>
            <span className="text-sm font-black text-stone-900">{room ? room.room_code : "—"}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Inception</span>
            <span className="text-sm font-mono text-stone-600">{formatDateString(contract?.move_in_date)}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit(onConfirm)} className="space-y-6">
          <Field label="Actual Move-out Date" required error={errors.actual_move_out?.message}>
            <Input
              type="date"
              lang="en-PH"
              hasError={Boolean(errors.actual_move_out)}
              className="!h-11 border-stone-200"
              {...register("actual_move_out", {
                required: "Actual move-out date is required.",
              })}
            />
          </Field>

          <Field label="Completion Notes">
            <Textarea rows={3} placeholder="Security deposit status, room condition, etc." className="border-stone-200" {...register("notes")} />
          </Field>

          <div className="flex items-center justify-end gap-3 pt-4">
            <Button
              id={cancelBtnId}
              type="button"
              variant="secondary"
              className="!h-11 rounded-xl px-6 text-[10px] font-bold uppercase tracking-widest"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="danger"
              className="!h-11 rounded-xl px-8 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-red-900/10"
              loading={isSubmitting}
              disabled={isSubmitting}
            >
              Finalize Move-out
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ContractDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const contractId = params?.id;

  const { user: currentUser, authLoading, isUnauthorized } = useAuthGuard();
  const shouldReduceMotion = useReducedMotion();
  const [apiError, setApiError] = useState("");
  const { data: contract, error: contractError, mutate: refetchContract } = useSWR(
    !authLoading && currentUser && contractId ? `/api/contracts/${contractId}` : null,
    fetcher
  );

  const { data: paymentsData } = useSWR(
    !authLoading && currentUser && contractId ? `/api/payments?contract_id=${contractId}` : null,
    fetcher
  );

  const payments = useMemo(() => {
    return normalizePaginatedList(paymentsData).rows;
  }, [paymentsData]);

  const loading = !contract && !contractError;
  const fetchError = contractError ? contractError.message || "Failed to load contract details." : "";
  const [successMessage, setSuccessMessage] = useState("");
  const [showMoveOutModal, setShowMoveOutModal] = useState(false);
  const [isSubmittingMoveOut, setIsSubmittingMoveOut] = useState(false);
  const pageTitle = "Contract Details";

  const loadContract = () => refetchContract();

  const handleMoveOut = async (values) => {
    setApiError("");
    setSuccessMessage("");
    setIsSubmittingMoveOut(true);

    try {
      await apiRequest(`/api/contracts/${contractId}/move-out`, {
        method: "POST",
        body: JSON.stringify({
          actual_move_out: values.actual_move_out,
          notes: values.notes || null,
        }),
      });
      await loadContract();
      setShowMoveOutModal(false);
      setSuccessMessage("Move-out processed successfully.");
      router.refresh();
    } catch (error) {
      setApiError(flattenApiErrors(error));
      setShowMoveOutModal(false);
    } finally {
      setIsSubmittingMoveOut(false);
    }
  };

  if (isUnauthorized) return null;

  const tenant = contract?.tenant;
  const room = contract?.room;
  const bedSpace = contract?.bed_space || contract?.bedSpace;
  const isActive = isContractActive(contract?.status);
  const tenantDisplay = tenant ? formatTenantDirectoryName(tenant) : "Agreement";
  return (
    <StandardPage
      title={pageTitle}
      subtitle={
        contract ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <ResourceIdCell id={contract.contract_id} prefix="CONTRACT" />
              <span className="text-stone-300">·</span>
              <StatusBadge size="sm">{contract.status}</StatusBadge>
            </div>
            <p className="hs-page-subtitle text-sm font-medium leading-relaxed text-stone-500">
              Lease terms, billing, and payment history.
            </p>
          </div>
        ) : (
          "Loading contract details..."
        )
      }
      loading={loading}
      skeleton={<SkeletonDetailPage />}
      error={contractError}
      breadcrumbs={
        <Breadcrumbs
          items={[
            { label: "Contracts", href: "/contracts" },
            { label: `Agreement ${contractId}` },
          ]}
        />
      }
      actions={
        <PageHeaderActions
          backHref="/contracts"
          backLabel="Back to Contracts"
          user={currentUser}
        >
          {canManageContracts(currentUser) && isActive && (
            <Link
              href={`/contracts/${contractId}/edit`}
              className={secondaryOutlineLinkClass + " px-6"}
            >
              <Edit2 size={16} aria-hidden />
              Update details
            </Link>
          )}
        </PageHeaderActions>
      }
    >
      <MoveOutModal
        open={showMoveOutModal}
        contract={contract}
        onClose={() => setShowMoveOutModal(false)}
        onConfirm={handleMoveOut}
        isSubmitting={isSubmittingMoveOut}
      />

      <motion.div
        initial={shouldReduceMotion ? false : pageVariants.initial}
        animate={shouldReduceMotion ? false : pageVariants.animate}
        transition={shouldReduceMotion ? { duration: 0 } : pageVariants.transition}
        className="space-y-6"
      >
        {(fetchError || apiError) && <Alert variant="error" title="Action Failed">{fetchError || apiError}</Alert>}
        {successMessage && <Alert variant="success">{successMessage}</Alert>}

        {contract ? (
          <div className="grid gap-6 lg:grid-cols-12">
            <aside className="space-y-6 lg:col-span-4">
              <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
                <div className="flex flex-col items-center border-b border-stone-100 bg-stone-50/50 px-8 py-8 text-center">
                  <div className="mb-4 flex size-16 items-center justify-center rounded-2xl border border-stone-200 bg-white text-teal-600 shadow-sm shadow-teal-900/5">
                    <ShieldCheck size={32} aria-hidden />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight text-stone-900">
                    Agreement Profile
                  </h2>
                  <div className="mt-2">
                    <StatusBadge size="sm">{contract.status}</StatusBadge>
                  </div>
                </div>
                
                <div className="space-y-2 p-8 pt-6">
                  <MetricItem label="Resident" value={tenantDisplay} icon={User} />
                  <MetricItem
                    label="Assigned Unit"
                    value={
                      room
                        ? `${room.room_code}${bedSpace?.bed_label ? ` · ${bedSpace.bed_label}` : ""}`
                        : "—"
                    }
                    icon={DoorOpen}
                  />
                  <MetricItem
                    label="Contract Yield"
                    value={formatPHP(contract.monthly_rate)}
                    icon={Wallet}
                  />
                  <MetricItem
                    label="Move-in Date"
                    value={formatDateString(contract.move_in_date)}
                    icon={Clock}
                  />
                </div>
              </Card>

              {canManageContracts(currentUser) && isActive ? (
                <Card className="rounded-2xl border-stone-200 !p-6 shadow-sm bg-amber-50/20 border-amber-100">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-amber-700">Agreement Lifecycle</h3>
                  <p className="mt-2 text-sm font-medium text-stone-600 leading-relaxed">
                    Once the resident completes their stay, process the move-out to release the bed inventory and finalize terms.
                  </p>
                  <Button
                    variant="danger"
                    className="mt-5 !h-11 w-full rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-red-900/5"
                    onClick={() => setShowMoveOutModal(true)}
                  >
                    Process Move-out
                  </Button>
                </Card>
              ) : null}
            </aside>

            <main className="space-y-6 lg:col-span-8">
              <SectionCard
                title="Resident & Assignment"
                icon={User}
                iconClassName="bg-teal-50 text-teal-600"
              >
                <div className="grid gap-x-12 gap-y-1 md:grid-cols-2">
                    <DetailRow
                      label="Primary Tenant"
                      value={
                        tenant ? (
                          <Link
                            href={`/tenants/${tenant.tenant_id}`}
                            className="font-bold text-teal-700 hover:underline"
                          >
                            {formatTenantDirectoryName(tenant)}
                          </Link>
                        ) : (
                          "—"
                        )
                      }
                      icon={User}
                    />
                    <DetailRow
                      label="Contact Number"
                      value={tenant?.contact_number}
                      icon={User}
                      mono
                    />
                    <DetailRow
                      label="Inventory Room"
                      value={
                        room ? (
                          <Link
                            href={`/rooms/${room.room_id}`}
                            className="font-bold text-teal-700 hover:underline"
                          >
                            {room.room_code}
                          </Link>
                        ) : (
                          "—"
                        )
                      }
                      icon={MapPin}
                    />
                    <DetailRow label="Bed Label" value={bedSpace?.bed_label} icon={DoorOpen} />
                  </div>
              </SectionCard>

              <div className="grid gap-6 md:grid-cols-2">
                <SectionCard
                  title="Financial Terms"
                  icon={Wallet}
                  iconClassName="bg-emerald-50 text-emerald-600"
                >
                  <div className="space-y-1">
                    <DetailRow label="Deposit Amount" value={formatPHP(contract.deposit_amount)} icon={FileCheck} mono />
                    <DetailRow label="Monthly Rate" value={formatPHP(contract.monthly_rate)} icon={Receipt} mono />
                  </div>
                </SectionCard>

                <SectionCard
                  title="Contract Dates"
                  icon={Calendar}
                  iconClassName="bg-blue-50 text-blue-600"
                >
                  <div className="space-y-1">
                    <DetailRow label="Inception" value={formatDateString(contract.move_in_date)} icon={Calendar} />
                    <DetailRow label="Expected Out" value={contract.expected_move_out_date ? formatDateString(contract.expected_move_out_date) : "Open Ended"} icon={Calendar} />
                  </div>
                </SectionCard>
              </div>

              {contract.actual_move_out_date && (
                <Card className="rounded-2xl border-stone-200 !p-6 shadow-sm border-stone-900/5 bg-stone-50/30">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-stone-200 text-stone-600">
                      <Clock size={12} />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-stone-500">History: Closed Agreement</span>
                  </div>
                  <p className="text-sm font-bold text-stone-900">
                    Agreement finalized and closed on {formatDateString(contract.actual_move_out_date)}.
                  </p>
                </Card>
              )}

              <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
                <div className="border-b border-stone-100 bg-stone-50/50 px-8 py-5">
                  <h2 className="hs-strip-title text-stone-400 tracking-widest uppercase font-black text-sm">Agreement Notes</h2>
                </div>
                <div className="p-8">
                  <p className="text-sm font-medium leading-relaxed text-stone-600 italic">
                    {contract.notes || "No additional agreement notes on file."}
                  </p>
                </div>
              </Card>

              <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
                <div className="flex items-center gap-2 border-b border-stone-100 bg-stone-50/50 px-8 py-5">
                  <div className="flex size-7 items-center justify-center rounded-lg bg-stone-100 text-stone-600">
                    <History size={14} aria-hidden />
                  </div>
                  <h2 className="hs-strip-title text-stone-400 tracking-widest uppercase font-black text-sm">Payment History</h2>
                </div>
                <div className="p-0">
                  <Table
                    embedded
                    caption="Payments posted against this contract"
                    columns={[
                      { key: "payment_date", label: "DATE" },
                      { key: "amount", label: "AMOUNT", className: "text-right" },
                      { key: "period", label: "BILLING TERM" },
                      { key: "status", label: "STATUS" },
                      { key: "reference", label: "REFERENCE" },
                    ]}
                    rows={payments.map((p) => (
                      <tr
                        key={p.payment_id}
                        className="border-t border-stone-100 transition-colors hover:bg-stone-50"
                      >
                        <td className="px-6 py-4 text-sm font-bold text-stone-900">
                          {formatDateString(p.payment_date)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="font-mono text-sm font-bold tabular-nums text-emerald-700">
                            {formatPHP(p.amount_paid)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-stone-400">
                          {formatDateRange(
                            p.billing_period_from || p.billing?.billing_period_from,
                            p.billing_period_to || p.billing?.billing_period_to
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <StatusBadge size="xs">
                            {p.voided_at ? "voided" : (p.status || "posted")}
                          </StatusBadge>
                        </td>
                        <td className="px-6 py-4">
                          <ResourceIdCell id={p.payment_id} prefix="PAY" />
                        </td>
                      </tr>
                    ))}
                    emptyTitle="No Payments Yet"
                    emptyDescription="No payment records have been posted for this agreement."
                  />
                </div>
              </Card>
            </main>
          </div>
        ) : (
          <div className="rounded-2xl border border-stone-200 bg-white p-12">
             <Alert variant="warning" title="Contract not found">The requested lease agreement record could not be located.</Alert>
          </div>
        )}

        {!canManageContracts(currentUser) && (
          <div className="mt-8 flex items-center gap-3 rounded-2xl bg-stone-50 p-6 text-stone-500">
            <ShieldCheck size={20} className="text-stone-300" />
            <p className="text-xs font-bold uppercase tracking-widest leading-relaxed">
              Administrative actions (Void/Move-out) require professional-level clearance.
            </p>
          </div>
        )}
      </motion.div>
    </StandardPage>
  );
}
