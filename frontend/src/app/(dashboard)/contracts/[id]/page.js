"use client";

import { useEffect, useState, useMemo } from "react";
import useSWR from "swr";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useForm, useWatch } from "react-hook-form";
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

import { SideSheetOverlay } from "@/components/ui/SideSheetOverlay";
import { ContractQuickEditForm } from '@/features/contracts/components/ContractQuickEditForm';

import { apiRequest, fetcher } from "@/lib/api";
import { canManageContracts } from "@/lib/auth";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { flattenApiErrors } from "@/lib/errors";
import {
  formatDateRange,
  formatDateString,
  formatPHP,
  formatTenantDirectoryName,
} from "@/lib/formatters";

function maskPhone(phone) {
  if (!phone) return "—";
  return phone.replace(/^(\d{4})\d+(\d{4})$/, "$1****$2");
}
import { isContractActive, isContractEnded } from "@/lib/constants";
import { SkeletonDetailPage } from "@/components/ui/Skeleton";
import Alert from "@/components/ui/Alert";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input, Textarea } from "@/components/ui/Fields";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table } from "@/components/ui/Table";
import { secondaryOutlineLinkClass } from "@/components/ui/LinkTokens";
import StandardPage from "@/components/ui/StandardPage";
import ResourceIdCell from "@/components/ui/ResourceIdCell";
import PageHeaderActions from "@/components/ui/PageHeaderActions";
import { normalizePaginatedList } from "@/lib/pagination";
import { FormSection } from "@/components/ui/FormSection";
import ConfirmationDialog from "@/components/ui/ConfirmationDialog";

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

function MoveOutModal({ open, contract, onClose, onConfirm, isSubmitting, balance }) {
  const cancelBtnId = "moveout-cancel-btn";
  const tenant = contract?.tenant;
  const room = contract?.room;
  const hasBalance = balance > 0;

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
    reset,
  } = useForm({ defaultValues: { actual_move_out: "", status: "completed", notes: "" } });

  const selectedStatus = useWatch({ control, name: "status" });

  useEffect(() => {
    if (open) {
      const today = new Date().toISOString().split("T")[0];
      const expected = contract?.expected_move_out_date;

      reset({
        actual_move_out: expected || today,
        status: "completed",
        notes: ""
      });
      setTimeout(() => document.getElementById(cancelBtnId)?.focus(), 50);
    }
  }, [open, reset, contract]);

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
      className="fixed inset-0 z-50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="moveout-modal-title"
    >
      <div className="flex min-h-screen items-center justify-center p-4 text-center sm:p-6">
        <button
          type="button"
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
          aria-label="Close move-out dialog"
          disabled={isSubmitting}
          onClick={onClose}
        />

        <div className="relative w-full max-w-[520px] transform rounded-3xl border border-stone-200 bg-white p-6 text-left shadow-2xl transition-all sm:p-10 my-8">
        <div className="mb-8 flex items-start gap-5">
          <div className={`flex size-14 shrink-0 items-center justify-center rounded-2xl shadow-xl transition-colors ${hasBalance ? "bg-rose-50 text-rose-600 shadow-rose-900/10" :
              selectedStatus === "terminated" ? "bg-amber-50 text-amber-600 shadow-amber-900/10" :
                "bg-teal-50 text-teal-600 shadow-teal-900/10"
            }`}>
            {hasBalance ? <AlertTriangle className="size-7" /> : <ShieldCheck className="size-7" />}
          </div>
          <div className="flex-1">
            <h2 id="moveout-modal-title" className="text-2xl font-black tracking-tight text-stone-900 uppercase">
              {hasBalance ? "Gate Pass Denied" : selectedStatus === "terminated" ? "Early Termination" : "Standard Move-Out"}
            </h2>
            <p className="mt-1 text-sm font-medium text-stone-500">
              {hasBalance ? "Outstanding balances must be cleared before certification." : "Finalize the agreement and release the room inventory."}
            </p>
          </div>
        </div>

        <div className="mb-8 space-y-4">
          {hasBalance ? (
            <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-6 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-rose-700/60">Outstanding Balance</span>
                <span className="font-mono text-xl font-black text-rose-700">{formatPHP(balance)}</span>
              </div>
              <p className="text-[11px] font-bold text-rose-600 leading-relaxed uppercase tracking-tight">
                Gate Pass Blocked: Account must be settled to proceed.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-teal-100 bg-teal-50/50 p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-teal-700/60">Balance Status</span>
                <span className="font-mono text-xl font-black text-teal-700">CLEAR</span>
              </div>
              <p className="text-[11px] font-bold text-teal-600 leading-relaxed uppercase tracking-tight">
                Certified for forensic closure.
              </p>
            </div>
          )}

          <div className="space-y-3 bg-stone-50 p-6 rounded-2xl border border-stone-100">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black uppercase tracking-widest text-stone-500">Resident</span>
              <span className="text-xs font-bold text-stone-900">{tenant ? formatTenantDirectoryName(tenant) : "—"}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black uppercase tracking-widest text-stone-500">Room & Bed</span>
              <span className="text-xs font-bold text-stone-900">{room ? room.room_code : "—"}</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit(onConfirm)} className="space-y-6">
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-500">Departure Type</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={hasBalance}
                className={`flex flex-col items-start p-5 rounded-2xl border-2 text-left transition-all ${selectedStatus === "completed"
                    ? "border-teal-600 bg-teal-50/50 text-teal-900 shadow-lg shadow-teal-900/5"
                    : "border-stone-100 bg-stone-50 text-stone-500 hover:border-stone-200"
                  } ${hasBalance ? "opacity-50 cursor-not-allowed" : ""}`}
                onClick={() => {
                  setValue("status", "completed");
                  setValue("actual_move_out", contract?.expected_move_out_date || new Date().toISOString().split("T")[0]);
                }}
              >
                <div className={`mb-3 p-2 rounded-lg ${selectedStatus === 'completed' ? 'bg-teal-600 text-white' : 'bg-stone-200 text-stone-400'}`}>
                   <ShieldCheck size={16} />
                </div>
                <span className="text-xs font-black uppercase tracking-wider mb-1">Standard</span>
                <span className="text-[10px] font-medium leading-tight text-stone-500">Completed full lease term.</span>
              </button>
              <button
                type="button"
                disabled={hasBalance}
                className={`flex flex-col items-start p-5 rounded-2xl border-2 text-left transition-all ${selectedStatus === "terminated"
                    ? "border-amber-500 bg-amber-50/50 text-amber-900 shadow-lg shadow-amber-900/5"
                    : "border-stone-100 bg-stone-50 text-stone-400 hover:border-stone-200"
                  } ${hasBalance ? "opacity-50 cursor-not-allowed" : ""}`}
                onClick={() => {
                  setValue("status", "terminated");
                  setValue("actual_move_out", new Date().toISOString().split("T")[0]);
                }}
              >
                <div className={`mb-3 p-2 rounded-lg ${selectedStatus === 'terminated' ? 'bg-amber-500 text-white' : 'bg-stone-200 text-stone-400'}`}>
                   <AlertTriangle size={16} />
                </div>
                <span className="text-xs font-black uppercase tracking-wider mb-1">Early</span>
                <span className="text-[10px] font-medium leading-tight text-stone-500">Lease ended before set date.</span>
              </button>
            </div>
          </div>

          <Field label="Final Move-out Date" required error={errors.actual_move_out?.message}>
            <Input
              type="date"
              hasError={Boolean(errors.actual_move_out)}
              className="!h-12 border-stone-200 font-bold"
              disabled={hasBalance}
              {...register("actual_move_out", {
                required: "Required.",
              })}
            />
          </Field>

          <Field label={selectedStatus === "terminated" ? "Termination Reason" : "Departure Notes"} error={errors.notes?.message}>
            <Textarea
              rows={3}
              placeholder={selectedStatus === "terminated" ? "Why is the lease ending early? (Required)" : "Final inspection details..."}
              className="border-stone-200"
              disabled={hasBalance}
              {...register("notes", {
                required: selectedStatus === "terminated" ? "A reason for termination is required." : false
              })}
            />
          </Field>

          <div className="flex flex-col gap-3 pt-2">
            <Button
              type="submit"
              variant={selectedStatus === "terminated" ? "warning" : "primary"}
              className="!h-14 w-full rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-stone-900/5"
              loading={isSubmitting}
              disabled={hasBalance}
            >
              Confirm Move-Out
            </Button>
            <Button
              id={cancelBtnId}
              type="button"
              variant="ghost"
              className="!h-10 w-full text-[10px] font-black uppercase tracking-widest text-stone-400 hover:text-stone-600"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
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
  const [successMessage, setSuccessMessage] = useState("");
  const { data: contract, error: contractError, mutate: refetchContract } = useSWR(
    !authLoading && currentUser && contractId ? `/api/contracts/${contractId}` : null,
    fetcher
  );

  const { data: billData, mutate: refetchBills } = useSWR(
    !authLoading && currentUser && contractId ? `/api/billing?contract_id=${contractId}&status=unpaid&per_page=100` : null,
    fetcher
  );

  const outstandingBalance = useMemo(() => {
    if (!billData) return 0;
    const items = normalizePaginatedList(billData).rows;
    return items.reduce((sum, b) => sum + (Number(b.balance) || 0), 0);
  }, [billData]);

  const { data: paymentsData } = useSWR(
    !authLoading && currentUser && contractId ? `/api/payments?contract_id=${contractId}` : null,
    fetcher
  );

  const payments = useMemo(() => {
    return normalizePaginatedList(paymentsData).rows;
  }, [paymentsData]);

  const loading = !contract && !contractError;
  const fetchError = contractError ? contractError.message || "Failed to load contract details." : "";
  const [showMoveOutModal, setShowMoveOutModal] = useState(false);
  const [isSubmittingMoveOut, setIsSubmittingMoveOut] = useState(false);
  const [isInitializingBilling, setIsInitializingBilling] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [editingContract, setEditingContract] = useState(null);
  const pageTitle = contract ? `Contract #${contractId}` : "Contract Detail";

  const loadContract = () => refetchContract();

  const [isVoiding, setIsVoiding] = useState(false);
  const [showVoidConfirm, setShowVoidConfirm] = useState(false);

  const handleVoid = async () => {
    setApiError("");
    setSuccessMessage("");
    setIsVoiding(true);
    try {
      await apiRequest(`/api/contracts/${contractId}/void`, {
        method: "POST",
      });
      setSuccessMessage("CONTRACT VOIDED AND INVENTORY RELEASED.");
      setShowVoidConfirm(false);
      await loadContract();
    } catch (err) {
      setApiError(flattenApiErrors(err) || "Failed to void contract.");
      setShowVoidConfirm(false);
    } finally {
      setIsVoiding(false);
    }
  };

  const handleInitializeBilling = async () => {
    setApiError("");
    setSuccessMessage("");
    setIsInitializingBilling(true);

    try {
      await apiRequest(`/api/billing/initialize/${contractId}`, {
        method: "POST",
      });
      setSuccessMessage("INITIAL BILLING GENERATED SUCCESSFULLY.");
      await loadContract();
      await refetchBills();
    } catch (err) {
      const flattened = flattenApiErrors(err);
      setApiError(flattened || "Failed to initialize billing.");
    } finally {
      setIsInitializingBilling(false);
    }
  };

  const handleMoveOut = async (values) => {
    if (outstandingBalance > 0) {
      setApiError("GATE PASS DENIED: CLEARED BALANCE REQUIRED FOR TERMINATION.");
      return;
    }

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
      setSuccessMessage("MOVE-OUT CERTIFIED AND LEASE CONCLUDED.");
      await loadContract();
      setShowMoveOutModal(false);
      router.refresh();
    } catch (error) {
      setApiError(flattenApiErrors(error));
      setShowMoveOutModal(false);
    } finally {
      setIsSubmittingMoveOut(false);
    }
  };

  const handleArchive = async () => {
    setApiError("");
    setSuccessMessage("");
    setIsArchiving(true);
    try {
      await apiRequest(`/api/contracts/${contractId}/archive`, {
        method: "POST",
      });
      setShowArchiveConfirm(false);
      router.push("/contracts");
    } catch (err) {
      setShowArchiveConfirm(false);
      setApiError(flattenApiErrors(err) || "Failed to archive contract.");
    } finally {
      setIsArchiving(false);
    }
  };

  if (isUnauthorized) return null;

  const tenant = contract?.tenant;
  const room = contract?.room;
  const bedSpace = contract?.bed_space || contract?.bedSpace;
  const isActive = isContractActive(contract?.status);
  const isEnded = isContractEnded(contract?.status);
  const tenantDisplay = tenant ? formatTenantDirectoryName(tenant) : "Agreement";
  return (
    <StandardPage
      title={pageTitle}
      subtitle={
        contract ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <ResourceIdCell id={contract.contract_id} type="contract" />
              <span className="text-stone-300">·</span>
              <StatusBadge size="sm">{contract.status}</StatusBadge>
            </div>
            <p className="hs-page-subtitle text-sm font-medium leading-relaxed text-stone-500">
              Lease profile: terms, billing, and payment history.
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
            <button
              type="button"
              onClick={() => setEditingContract(contract)}
              className={secondaryOutlineLinkClass + " px-6"}
            >
              <Edit2 size={16} aria-hidden />
              Update details
            </button>
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
        balance={outstandingBalance}
      />

      <ConfirmationDialog
        open={showArchiveConfirm}
        title="Confirm Archive"
        message="Are you sure you want to archive this agreement? This action will immediately release the bed space into available inventory and clear it from active listings."
        confirmLabel="Archive History"
        isDanger
        isLoading={isArchiving}
        onConfirm={handleArchive}
        onCancel={() => setShowArchiveConfirm(false)}
      />

      <ConfirmationDialog
        open={showVoidConfirm}
        title="Void Registration"
        message="This will VOID the contract and release the bed space. This action represents a correction of a registration error and cannot be undone (BR-CON-012)."
        confirmLabel="Void Registration"
        isDanger
        isLoading={isVoiding}
        onConfirm={handleVoid}
        onCancel={() => setShowVoidConfirm(false)}
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
              <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm hs-glass-effect">
                <div className="flex flex-col items-center border-b border-stone-100 bg-stone-50/50 px-8 py-8 text-center">
                  <div className="mb-4 flex size-16 items-center justify-center rounded-2xl border border-stone-200 bg-white text-teal-600 shadow-sm shadow-teal-900/5">
                    <ShieldCheck size={32} aria-hidden />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight text-stone-900">
                    Agreement Summary
                  </h2>
                  <div className="mt-2 flex items-center justify-center gap-2">
                    <StatusBadge size="sm">{contract.status}</StatusBadge>
                    {contract.is_cleared ? (
                      <StatusBadge size="sm">cleared</StatusBadge>
                    ) : (isEnded && contract.status !== 'voided') ? (
                      <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-amber-600 border border-amber-200 uppercase tracking-tighter">
                        Unsettled
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-2 p-8 pt-6">
                  <MetricItem label="Primary Tenant" value={tenantDisplay} icon={User} />
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
                    label="Monthly Rent"
                    value={formatPHP(contract.monthly_rate_override ?? contract.monthly_rate)}
                    icon={Wallet}
                  />
                  <MetricItem
                    label="Move-in Date"
                    value={formatDateString(contract.move_in_date)}
                    icon={Clock}
                  />
                </div>
              </Card>

              {canManageContracts(currentUser) && contract.status === "pending_payment" ? (
                <Card className="rounded-2xl border-stone-200 !p-6 shadow-sm bg-teal-50/20 border-teal-100">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-teal-700">Onboarding Action Required</h3>
                  <p className="mt-2 text-sm font-medium text-stone-600 leading-relaxed text-teal-800">
                    Generate the setup billing (Advance Rent + Deposit) to enable payment collection and activate this contract.
                  </p>
                  <Button
                    variant="primary"
                    className="mt-5 !h-11 w-full rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-teal-900/5 transition-all hover:scale-[1.02] active:scale-95"
                    onClick={handleInitializeBilling}
                    isLoading={isInitializingBilling}
                  >
                    Generate Initial Bill
                  </Button>
                  <Button
                    variant="outline"
                    className="mt-3 !h-11 w-full rounded-xl text-[10px] font-black uppercase tracking-widest border-teal-200 text-teal-700 hover:bg-teal-50"
                    onClick={() => setShowVoidConfirm(true)}
                  >
                    Void Registration
                  </Button>
                </Card>
              ) : null}

              {canManageContracts(currentUser) && isActive ? (
                <Card className="rounded-2xl border-stone-200 !p-6 shadow-sm bg-amber-50/20 border-amber-100">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-amber-700">Operational Lifecycle</h3>
                  <p className="mt-2 text-sm font-medium text-stone-600 leading-relaxed">
                    Once the resident completes their stay, process the move-out to release the bed inventory and finalize terms.
                  </p>
                  <Button
                    variant="danger"
                    className="mt-5 !h-11 w-full rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-red-900/5 transition-all hover:scale-[1.02] active:scale-95"
                    onClick={() => setShowMoveOutModal(true)}
                  >
                    Process Move-Out
                  </Button>
                </Card>
              ) : null}

              {canManageContracts(currentUser) && !isActive && contract.status !== "pending_payment" ? (
                <Card className="rounded-2xl border-stone-200 !p-6 shadow-sm bg-stone-50/50 border-stone-200">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-stone-500">History Management</h3>
                  <p className="mt-2 text-[10px] font-medium text-stone-400 leading-relaxed">
                    Closed contracts can be archived for cleaner listings. Financial records will still be retained.
                  </p>
                  <Button
                    variant="outline"
                    className="mt-4 !h-9 w-full rounded-lg text-[10px] font-black uppercase tracking-widest border-stone-200 text-stone-600 hover:bg-white"
                    onClick={() => setShowArchiveConfirm(true)}
                  >
                    Archive Agreement
                  </Button>
                </Card>
              ) : null}
            </aside>

            <main className="space-y-6 lg:col-span-8">
              <FormSection
                title="Tenant & Unit Assignment"
                icon={User}
                className="hs-glass-effect"
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
                    value={canManageContracts(currentUser) ? tenant?.contact_number : maskPhone(tenant?.contact_number)}
                    icon={User}
                    mono
                  />
                  <DetailRow
                    label="Room"
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
              </FormSection>

              <div className="grid gap-6 md:grid-cols-2">
                <FormSection
                  title="Financial Terms"
                  icon={Wallet}
                  className="hs-glass-effect"
                >
                  <div className="space-y-1">
                    <DetailRow label="Deposit Amount" value={formatPHP(contract.deposit_amount)} icon={FileCheck} mono />
                    {contract.monthly_rate_override ? (
                      <>
                        <DetailRow
                          label="Standard Rate"
                          value={<span className="line-through text-stone-400">{formatPHP(contract.monthly_rate)}</span>}
                          icon={Receipt}
                          mono
                        />
                        <DetailRow
                          label="Agreed Rent"
                          value={<span className="font-bold text-teal-700">{formatPHP(contract.monthly_rate_override)}</span>}
                          icon={Wallet}
                          mono
                        />
                      </>
                    ) : (
                      <DetailRow label="Monthly Rate" value={formatPHP(contract.monthly_rate)} icon={Receipt} mono />
                    )}
                  </div>
                </FormSection>

                <FormSection
                  title="Contract Dates"
                  icon={Calendar}
                  className="hs-glass-effect"
                >
                  <div className="space-y-1">
                    <DetailRow label="Start Date" value={formatDateString(contract.move_in_date)} icon={Calendar} />
                    <DetailRow label="End Date" value={contract.expected_move_out_date ? formatDateString(contract.expected_move_out_date) : "Open Ended"} icon={Calendar} />
                  </div>
                </FormSection>
              </div>

              {contract.actual_move_out_date && (
                <Card className="rounded-2xl border-stone-200 !p-6 shadow-sm border-stone-900/5 bg-stone-50/30 hs-glass-effect">
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

              <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm hs-glass-effect">
                <div className="border-b border-stone-100 bg-stone-50/50 px-8 py-5">
                  <h2 className="hs-strip-title text-stone-400 tracking-widest uppercase font-black text-sm">General Notes</h2>
                </div>
                <div className="p-8">
                  <p className="text-sm font-medium leading-relaxed text-stone-600 italic">
                    {contract.notes || "No additional agreement notes on file."}
                  </p>
                </div>
              </Card>

              <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm hs-glass-effect">
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
                      { key: "payment_date", label: "PAYMENT DATE", className: "pl-8" },
                      { key: "amount", label: "AMOUNT", className: "text-right" },
                      { key: "period", label: "BILLING PERIOD", className: "text-center" },
                      { key: "status", label: "STATUS", className: "text-center" },
                      { key: "reference", label: "ENTRY ID", className: "text-right pr-8" },
                    ]}
                    rows={payments.map((p) => (
                      <tr
                        key={p.payment_id}
                        className="border-t border-stone-100 transition-colors hover:bg-stone-50"
                      >
                        <td className="pl-8 py-5 text-sm font-bold text-stone-900">
                          {formatDateString(p.payment_date)}
                        </td>
                        <td className="py-5 text-right">
                          <span className="font-mono text-sm font-bold tabular-nums text-emerald-700">
                            {formatPHP(p.amount_paid)}
                          </span>
                        </td>
                        <td className="py-5 text-center text-[10px] font-bold uppercase tracking-widest text-stone-400">
                          {formatDateRange(
                            p.billing_period_from || p.billing?.billing_period_from,
                            p.billing_period_to || p.billing?.billing_period_to
                          )}
                        </td>
                        <td className="py-5 text-center">
                          <StatusBadge size="xs">
                            {p.voided_at ? "voided" : (p.status || "posted")}
                          </StatusBadge>
                        </td>
                        <td className="pr-8 py-5 text-right">
                          <ResourceIdCell id={p.payment_id} type="payment" />
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

      <SideSheetOverlay
        isOpen={!!editingContract}
        onClose={() => setEditingContract(null)}
        title="Quick Update"
      >
        {editingContract && (
          <ContractQuickEditForm
            contract={editingContract}
            currentUser={currentUser}
            onSuccess={() => {
              setEditingContract(null);
              refetchContract();
            }}
            onCancel={() => setEditingContract(null)}
          />
        )}
      </SideSheetOverlay>
    </StandardPage>
  );
}
