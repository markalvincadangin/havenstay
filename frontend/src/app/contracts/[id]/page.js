"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  X,
  ArrowLeft,
  Edit2,
  User,
  DoorOpen,
  Calendar,
  FileCheck,
  Receipt,
  History,
  MapPin,
} from "lucide-react";

import { apiRequest } from "../../../lib/api";
import { canManageContracts } from "../../../lib/auth";
import { useAuthGuard } from "../../../hooks/useAuthGuard";
import { flattenApiErrors } from "../../../lib/errors";
import { formatDateRange, formatDateString, formatPHP } from "../../../lib/formatters";
import { SkeletonDetailPage } from "../../_components/ui/Skeleton";
import Alert from "../../_components/ui/Alert";
import { AppMain } from "../../_components/ui/AppShell";
import Breadcrumbs from "../../_components/ui/Breadcrumbs";
import Button from "../../_components/ui/Button";
import { Card } from "../../_components/ui/Card";
import { Field, Input, Textarea } from "../../_components/ui/Fields";
import PageHeader from "../../_components/ui/PageHeader";
import UserRoleBadge from "../../_components/ui/UserRoleBadge";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { Table } from "../../_components/ui/Table";

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.2, ease: "easeOut" },
};

function DetailRow({ label, value, icon: Icon, mono = false }) {
  return (
    <div className="flex items-start justify-between border-b border-stone-50 py-3.5 last:border-0">
      <div className="flex items-center gap-2.5">
        <div className="text-stone-300">
          <Icon size={14} />
        </div>
        <span className="text-xs font-semibold text-stone-500">{label}</span>
      </div>
      <span
        className={`max-w-[220px] text-right text-sm leading-snug text-stone-900 ${mono ? "font-mono tabular-nums" : ""}`}
      >
        {value ?? "—"}
      </span>
    </div>
  );
}

function MetricItem({ label, value, icon: Icon }) {
  return (
    <div className="flex items-center gap-4 border-b border-stone-100 py-4 last:border-0">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-stone-50 text-stone-400">
        <Icon size={18} />
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400 [word-spacing:0.08em]">{label}</p>
        <p className="text-sm font-bold text-stone-900 tabular-nums">{value}</p>
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
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

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
        className="absolute inset-0 bg-slate-900/50"
        aria-label="Close move-out dialog"
        onClick={onClose}
      />

      <div className="relative w-full max-w-[480px] rounded-2xl border border-stone-200 bg-white p-8 shadow-lg">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-50">
            <AlertTriangle className="size-5 text-amber-600" aria-hidden />
          </div>
          <div>
            <h2 id="moveout-modal-title" className="text-base font-bold text-stone-900">
              Process Move-out
            </h2>
            <p className="mt-0.5 text-sm text-stone-500">Confirm the move-out details below.</p>
          </div>
          <button
            type="button"
            className="ml-auto inline-flex size-8 items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-stone-100"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mb-5 rounded-xl border border-stone-200 bg-stone-50/50 px-4 py-3 text-sm text-stone-800">
          <p>
            <span className="font-semibold text-stone-600">Tenant:</span>{" "}
            {tenant ? `${tenant.first_name} ${tenant.last_name}` : "—"}
          </p>
          <p className="mt-1">
            <span className="font-semibold text-stone-600">Room:</span>{" "}
            {room ? room.room_code : "—"}
          </p>
          <p className="mt-1">
            <span className="font-semibold text-stone-600">Move-in:</span>{" "}
            {formatDateString(contract?.move_in_date)}
          </p>
        </div>

        <form onSubmit={handleSubmit(onConfirm)} className="space-y-4">
          <Field label="Actual Move-out Date" required error={errors.actual_move_out?.message}>
            <Input
              type="date"
              hasError={Boolean(errors.actual_move_out)}
              aria-describedby={errors.actual_move_out ? "moveout-date-error" : undefined}
              className="border-stone-200"
              {...register("actual_move_out", {
                required: "Actual move-out date is required.",
              })}
            />
          </Field>

          <Field label="Final Settlement Notes">
            <Textarea rows={3} className="border-stone-200" {...register("notes")} />
          </Field>

          <div className="flex items-center justify-end gap-3 pt-2">
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
              className="!h-11 rounded-xl px-6 text-[10px] font-black uppercase tracking-widest"
              loading={isSubmitting}
              disabled={isSubmitting}
            >
              Confirm Move-out
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

  const { user: currentUser, authLoading } = useAuthGuard();
  const shouldReduceMotion = useReducedMotion();
  const [contract, setContract] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [showMoveOutModal, setShowMoveOutModal] = useState(false);
  const [isSubmittingMoveOut, setIsSubmittingMoveOut] = useState(false);

  const loadContract = useCallback(async () => {
    const data = await apiRequest(`/api/contracts/${contractId}`, { method: "GET" });
    setContract(data);
  }, [contractId]);

  const loadPayments = useCallback(async () => {
    try {
      const data = await apiRequest(`/api/payments?contract_id=${contractId}`, {
        method: "GET",
      });
      setPayments(Array.isArray(data) ? data : data?.payments || []);
    } catch {
      setPayments([]);
    }
  }, [contractId]);

  useEffect(() => {
    if (authLoading || !currentUser || !contractId) return;

    const fetchData = async () => {
      try {
        await Promise.all([loadContract(), loadPayments()]);
      } catch (error) {
        setApiError(error.message || "Failed to load contract details.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [authLoading, currentUser, contractId, loadContract, loadPayments]);

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
    } catch (error) {
      setApiError(flattenApiErrors(error));
      setShowMoveOutModal(false);
    } finally {
      setIsSubmittingMoveOut(false);
    }
  };

  if (authLoading || loading) {
    return (
      <AppMain>
        <SkeletonDetailPage />
      </AppMain>
    );
  }

  const tenant = contract?.tenant;
  const room = contract?.room;
  const bedSpace = contract?.bed_space || contract?.bedSpace;
  const isActive = contract?.status === "active";
  const tenantDisplay = tenant ? `${tenant.first_name} ${tenant.last_name}` : "Agreement";

  return (
    <AppMain>
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
        <PageHeader
          title={contract ? `Contract #${contract.contract_id}` : `Contract #${contractId}`}
          subtitle={
            contract ? (
              <>
                <span className="block text-sm font-medium text-stone-500">
                  Lease terms, billing, and payment history.
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-tighter text-stone-400">
                    #CONTRACT-{contract.contract_id}
                  </span>
                  <StatusBadge size="sm">{contract.status}</StatusBadge>
                </span>
              </>
            ) : (
              "Retrieving record…"
            )
          }
          breadcrumbs={
            <Breadcrumbs
              items={[
                { label: "Contract Registry", href: "/contracts" },
                { label: "Lease profile" },
              ]}
            />
          }
          actions={
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => router.push("/contracts")}
                className="inline-flex size-11 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-500 transition-colors hover:bg-stone-50"
                aria-label="Back to Contract Registry"
              >
                <ArrowLeft size={18} aria-hidden />
              </button>
              {canManageContracts(currentUser) && isActive && (
                <Link
                  href={`/contracts/${contractId}/edit`}
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-teal-600 px-6 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-teal-900/10 transition-all hover:bg-teal-700 active:scale-95"
                >
                  <Edit2 size={16} className="mr-2" />
                  Update Details
                </Link>
              )}
              <div className="border-l border-stone-200 pl-3">
                <UserRoleBadge
                  username={currentUser?.username}
                  roleName={currentUser?.role?.role_name}
                />
              </div>
            </div>
          }
        />

        {apiError ? (
          <Alert variant="error" title="Could not complete action">
            {apiError}
          </Alert>
        ) : null}
        {successMessage ? <Alert variant="success">{successMessage}</Alert> : null}

        {contract ? (
          <div className="grid gap-6 lg:grid-cols-12">
            <aside className="space-y-6 lg:col-span-4">
              <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
                <div className="flex flex-col items-center border-b border-stone-100 bg-stone-50/50 px-8 py-6 text-center">
                  <div className="mb-3 flex size-16 items-center justify-center rounded-2xl border border-stone-200 bg-white text-teal-600 shadow-sm">
                    <FileCheck size={28} aria-hidden />
                  </div>
                  <h2 className="text-xl font-black tracking-tight text-stone-900 [word-spacing:0.06em]">
                    #{contract.contract_id}
                  </h2>
                  <div className="mt-2">
                    <StatusBadge size="sm">{contract.status}</StatusBadge>
                  </div>
                </div>
                <div className="flex justify-center border-b border-stone-100 bg-stone-50/30 px-4 py-3">
                  <span className="text-xs font-bold tracking-tight text-stone-500 [word-spacing:0.05em]">
                    Summary Overview
                  </span>
                </div>
                <div className="space-y-2 p-8">
                  <MetricItem label="Tenant Name" value={tenantDisplay} icon={User} />
                  <MetricItem
                    label="Room & Bed"
                    value={
                      room
                        ? `${room.room_code}${bedSpace?.bed_label ? ` · ${bedSpace.bed_label}` : ""}`
                        : "—"
                    }
                    icon={DoorOpen}
                  />
                  <MetricItem
                    label="Lease Period"
                    value={formatDateRange(
                      contract.move_in_date,
                      contract.expected_move_out_date
                    )}
                    icon={Calendar}
                  />
                  <MetricItem
                    label="Monthly Rate"
                    value={formatPHP(contract.monthly_rate)}
                    icon={Receipt}
                  />
                </div>
              </Card>

              {canManageContracts(currentUser) && isActive ? (
                <Card className="rounded-2xl border-stone-200 !p-6 shadow-sm">
                  <h3 className="text-xs font-bold tracking-tight text-stone-600 [word-spacing:0.05em]">Lifecycle</h3>
                  <p className="mt-2 text-sm text-stone-600">
                    Record the actual move-out date to complete this agreement and release the bed
                    space.
                  </p>
                  <Button
                    variant="danger"
                    className="mt-4 !h-11 w-full rounded-xl text-[10px] font-black uppercase tracking-widest"
                    onClick={() => setShowMoveOutModal(true)}
                  >
                    Process Move-out
                  </Button>
                </Card>
              ) : null}
            </aside>

            <main className="space-y-6 lg:col-span-8">
              <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
                <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/50 px-8 py-5">
                  <div className="flex items-center gap-3">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                      <User size={16} aria-hidden />
                    </div>
                    <h2 className="hs-strip-title">Tenant & Assignment</h2>
                  </div>
                </div>
                <div className="p-8">
                  <div className="grid gap-x-12 gap-y-1 md:grid-cols-2">
                    <DetailRow
                      label="Tenant Name"
                      value={
                        tenant ? (
                          <Link
                            href={`/tenants/${tenant.tenant_id}`}
                            className="font-semibold text-teal-700 hover:underline"
                          >
                            {tenant.first_name} {tenant.last_name}
                          </Link>
                        ) : (
                          "—"
                        )
                      }
                      icon={User}
                    />
                    <DetailRow
                      label="Phone Number"
                      value={tenant?.contact_number}
                      icon={User}
                      mono
                    />
                    <DetailRow
                      label="Room Code"
                      value={
                        room ? (
                          <Link
                            href={`/rooms/${room.room_id}`}
                            className="font-semibold text-teal-700 hover:underline"
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
                </div>
              </Card>

              <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
                <div className="flex items-center gap-3 border-b border-stone-100 bg-stone-50/50 px-8 py-5">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                    <Receipt size={16} aria-hidden />
                  </div>
                  <h2 className="hs-strip-title">Financial Terms</h2>
                </div>
                <div className="p-8">
                  <div className="grid gap-x-12 gap-y-1 md:grid-cols-2">
                    <DetailRow
                      label="Deposit Amount"
                      value={formatPHP(contract.deposit_amount)}
                      icon={FileCheck}
                      mono
                    />
                    <DetailRow
                      label="Monthly Rate"
                      value={formatPHP(contract.monthly_rate)}
                      icon={Receipt}
                      mono
                    />
                  </div>
                </div>
              </Card>

              <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
                <div className="flex items-center gap-3 border-b border-stone-100 bg-stone-50/50 px-8 py-5">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-amber-50 text-amber-800">
                    <Calendar size={16} aria-hidden />
                  </div>
                  <h2 className="hs-strip-title">Contract Dates</h2>
                </div>
                <div className="p-8">
                  <div className="grid gap-x-12 gap-y-1 md:grid-cols-2">
                    <DetailRow
                      label="Move-in Date"
                      value={formatDateString(contract.move_in_date)}
                      icon={Calendar}
                    />
                    <DetailRow
                      label="Expected Move-out"
                      value={
                        contract.expected_move_out_date
                          ? formatDateString(contract.expected_move_out_date)
                          : "—"
                      }
                      icon={Calendar}
                    />
                    {contract.actual_move_out_date ? (
                      <DetailRow
                        label="Actual Move-out"
                        value={formatDateString(contract.actual_move_out_date)}
                        icon={Calendar}
                      />
                    ) : null}
                  </div>
                </div>
              </Card>

              <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
                <div className="border-b border-stone-100 bg-stone-50/50 px-8 py-5">
                  <h2 className="hs-strip-title">Agreement Notes</h2>
                </div>
                <div className="p-8">
                  <p className="text-sm leading-relaxed text-stone-600">
                    {contract.notes || "No notes on file."}
                  </p>
                </div>
              </Card>

              <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
                <div className="flex items-center gap-2 border-b border-stone-100 bg-stone-50/50 px-8 py-5">
                  <div className="flex size-7 items-center justify-center rounded-lg bg-stone-100 text-stone-600">
                    <History size={14} aria-hidden />
                  </div>
                  <h2 className="hs-strip-title">Payment History</h2>
                </div>
                <div className="p-0">
                  <Table
                    embedded
                    caption="Payments posted against this contract"
                    columns={[
                      { key: "payment_date", label: "Payment Date" },
                      { key: "amount", label: "Amount" },
                      { key: "period", label: "Period" },
                      { key: "status", label: "Status" },
                      { key: "reference", label: "Reference" },
                    ]}
                    rows={payments.map((p) => (
                      <tr
                        key={p.payment_id}
                        className="border-t border-stone-100 transition-colors hover:bg-stone-50"
                      >
                        <td className="px-6 py-4 text-sm text-stone-900">
                          {formatDateString(p.payment_date)}
                        </td>
                        <td className="px-6 py-4 text-right font-mono text-sm tabular-nums text-stone-900">
                          {formatPHP(p.amount_paid)}
                        </td>
                        <td className="px-6 py-4 text-xs text-stone-600">
                          {formatDateRange(
                            p.billing_period_from || p.billing?.billing_period_from,
                            p.billing_period_to || p.billing?.billing_period_to
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <StatusBadge size="xs">{p.status}</StatusBadge>
                        </td>
                        <td className="px-6 py-4 font-mono text-sm text-stone-500">
                          {p.payment_reference_number || "—"}
                        </td>
                      </tr>
                    ))}
                    emptyTitle="No payments recorded"
                    emptyDescription="No payments have been posted for this contract."
                  />
                </div>
              </Card>
            </main>
          </div>
        ) : (
          <Alert variant="warning" title="Record not found">
            The requested contract was not found.
          </Alert>
        )}

        {!canManageContracts(currentUser) ? (
          <Alert variant="info" title="Read-only role">
            Move-out and edits require Admin or Staff.
          </Alert>
        ) : null}
      </motion.div>
    </AppMain>
  );
}
