"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import useSWR, { useSWRConfig } from "swr";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useForm, useWatch } from "react-hook-form";
import { useToasts } from "@/context/ToastContext";
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
  FileSignature,
} from "lucide-react";

import { SideSheetOverlay } from "@/components/ui/SideSheetOverlay";
import { ContractQuickEditForm } from '@/features/contracts/components/ContractQuickEditForm';
import MoveOutModal from "@/features/contracts/components/MoveOutModal";

import { apiRequest, fetcher } from "@/lib/api";
import { canManageContracts } from "@/lib/auth";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { flattenApiErrors } from "@/lib/errors";
import {
  formatDateRange,
  formatDateString,
  formatTenantDirectoryName,
} from "@/lib/formatters";
import CurrencyDisplay from "@/components/ui/CurrencyDisplay";

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



export default function ContractDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const contractId = params?.id;
  const { showToast } = useToasts();

  const { user: currentUser, authLoading, isUnauthorized } = useAuthGuard();
  const shouldReduceMotion = useReducedMotion();
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
  const [isActivating, setIsActivating] = useState(false);
  const pageTitle = contract ? `Contract #${contractId}` : "Contract Detail";

  const loadContract = () => refetchContract();

  const [isVoiding, setIsVoiding] = useState(false);
  const [showVoidConfirm, setShowVoidConfirm] = useState(false);

  const { mutate: globalMutate } = useSWRConfig();

  const handleVoid = async () => {
    setIsVoiding(true);
    try {
      await apiRequest(`/api/contracts/${contractId}/void`, {
        method: "POST",
        body: JSON.stringify({ reason: "Contract voided by staff via detail action." }),
      });
      showToast("Contract voided successfully. Inventory has been released.", "success");
      setShowVoidConfirm(false);

      // Global revalidation for lists and reports
      globalMutate(key => typeof key === 'string' && key.startsWith('/api/contracts'));
      globalMutate(key => typeof key === 'string' && key.startsWith('/api/reports'));

      await loadContract();
    } catch (err) {
      showToast(flattenApiErrors(err) || "Unable to void this contract. Please try again or contact support.", "error");
      setShowVoidConfirm(false);
    } finally {
      setIsVoiding(false);
    }
  };

  const isInitializingBillingRef = useRef(false);

  const handleInitializeBilling = async () => {
    if (isInitializingBillingRef.current) return;
    isInitializingBillingRef.current = true;
    setIsInitializingBilling(true);

    try {
      await apiRequest(`/api/billing/initialize/${contractId}`, {
        method: "POST",
      });
      showToast("Initial billing generated successfully.", "success");
      await loadContract();
      await refetchBills();
    } catch (err) {
      showToast(flattenApiErrors(err) || "Unable to generate initial billing. Please try again.", "error");
    } finally {
      setIsInitializingBilling(false);
      isInitializingBillingRef.current = false;
    }
  };

  const handleActivate = async () => {
    setIsActivating(true);
    try {
      await apiRequest(`/api/contracts/${contractId}/activate`, {
        method: "POST",
      });
      showToast("Contract activated. The lease agreement is now live.", "success");
      await loadContract();
    } catch (err) {
      showToast(flattenApiErrors(err) || "Activation failed. Please ensure the minimum payment (deposit + 1st month) has been recorded.", "error");
    } finally {
      setIsActivating(false);
    }
  };

  const handleMoveOut = async (values) => {
    if (outstandingBalance > 0) {
      showToast("Move-out denied: A cleared balance is required before termination.", "error");
      return;
    }

    setIsSubmittingMoveOut(true);

    try {
      await apiRequest(`/api/contracts/${contractId}/move-out`, {
        method: "POST",
        body: JSON.stringify({
          actual_move_out: values.actual_move_out,
          notes: values.notes || null,
        }),
      });
      showToast("Move-out processed. The lease has been concluded.", "success");

      // Global revalidation
      globalMutate(key => typeof key === 'string' && key.startsWith('/api/contracts'));
      globalMutate(key => typeof key === 'string' && key.startsWith('/api/reports'));

      await loadContract();
      setShowMoveOutModal(false);
      router.refresh();
    } catch (error) {
      showToast(flattenApiErrors(error), "error");
      setShowMoveOutModal(false);
    } finally {
      setIsSubmittingMoveOut(false);
    }
  };

  const handleArchive = async () => {
    setIsArchiving(true);
    try {
      await apiRequest(`/api/contracts/${contractId}/archive`, {
        method: "POST",
      });
      setShowArchiveConfirm(false);

      // Global revalidation
      globalMutate(key => typeof key === 'string' && key.startsWith('/api/contracts'));
      globalMutate(key => typeof key === 'string' && key.startsWith('/api/reports'));

      router.push("/contracts");
    } catch (err) {
      showToast(flattenApiErrors(err) || "Unable to archive this contract. Please try again.", "error");
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
      title={
        loading ? (
          "Loading Agreement..."
        ) : (
          pageTitle
        )
      }
      subtitle={
        loading ? (
          "Synchronizing lease records..."
        ) : contract ? (
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
        ) : null
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
        description="Are you sure you want to archive this agreement? This action will immediately release the bed space into available inventory and clear it from active listings."
        confirmLabel="Archive History"
        isDanger
        isLoading={isArchiving}
        onConfirm={handleArchive}
        onCancel={() => setShowArchiveConfirm(false)}
      />

      <ConfirmationDialog
        open={showVoidConfirm}
        title="Void Contract"
        description="This will void the contract and release the bed space. This action represents a correction of a registration error and cannot be undone."
        confirmLabel="Void Contract"
        isDanger
        isLoading={isVoiding}
        onConfirm={handleVoid}
        onCancel={() => setShowVoidConfirm(false)}
      />

      <motion.div
        initial={shouldReduceMotion ? false : pageVariants.initial}
        animate={shouldReduceMotion ? false : pageVariants.animate}
        transition={shouldReduceMotion ? { duration: 0 } : pageVariants.transition}
      >
        {fetchError && <Alert variant="error" title="Load Failed">{fetchError}</Alert>}

        {!loading && contract ? (
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
                    label="Room / Bed"
                    value={
                      room
                        ? `${room.room_code}${bedSpace?.bed_label ? ` · ${bedSpace.bed_label}` : ""}`
                        : "—"
                    }
                    icon={DoorOpen}
                  />
                  <MetricItem
                    label="Monthly Rent"
                    value={<CurrencyDisplay amount={contract.monthly_rate_override ?? contract.monthly_rate} />}
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

                  {contract.latest_billing ? (
                    <>
                      <p className="mt-2 text-sm font-medium text-stone-600 leading-relaxed text-teal-800">
                        Setup billing has been initialized. Resident must settle the balance to activate this lease.
                      </p>
                      <Button
                        variant="primary"
                        className="mt-5 !h-11 w-full rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-teal-900/5 transition-all"
                        onClick={() => router.push(`/billing/${contract.latest_billing.billing_id}`)}
                      >
                        View Setup Bill & Pay
                      </Button>
                    </>
                  ) : outstandingBalance > 0 ? (
                    <>
                      <p className="mt-2 text-sm font-medium text-stone-600 leading-relaxed text-teal-800">
                        Initial billing has been generated. Resident must settle the outstanding balance to live-activate this lease.
                      </p>
                      <div className="mt-4 flex flex-col gap-2 rounded-xl bg-white/50 p-4 border border-teal-100">
                        <span className="text-[10px] font-black uppercase text-teal-600/60">Required for Activation</span>
                        <CurrencyDisplay amount={outstandingBalance} className="text-xl font-black text-teal-700" />
                      </div>
                      <Button
                        variant="primary"
                        className="mt-5 !h-11 w-full rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-teal-900/5 transition-all"
                        onClick={() => {
                          const unpaidBill = normalizePaginatedList(billData).rows[0];
                          if (unpaidBill) router.push(`/billing/${unpaidBill.billing_id}`);
                        }}
                      >
                        View & Record Payment
                      </Button>
                    </>
                  ) : (
                    <>
                      <p className="mt-2 text-sm font-medium text-stone-600 leading-relaxed text-teal-800">
                        Generate the setup billing (Advance Rent + Deposit) to enable payment collection and activate this contract.
                      </p>
                      <Button
                        variant="primary"
                        className="mt-5 !h-11 w-full rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-teal-900/5 transition-all"
                        onClick={handleInitializeBilling}
                        isLoading={isInitializingBilling}
                      >
                        Generate Initial Bill
                      </Button>
                    </>
                  )}

                  <Button
                    variant="secondary"
                    className="mt-3 !h-11 w-full rounded-xl text-[10px] font-black uppercase tracking-widest border-amber-200 text-amber-700 hover:bg-amber-50"
                    onClick={() => router.push(`/payments/new?category=deposit&contract_id=${contractId}&amount=${contract.deposit_amount}`)}
                  >
                    Record Deposit Payment
                  </Button>

                  <Button
                    variant="primary"
                    className="mt-3 !h-11 w-full rounded-xl text-[10px] font-black uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-900/5 transition-all"
                    onClick={handleActivate}
                    isLoading={isActivating}
                  >
                    Activate Contract
                  </Button>
                  <Button
                    variant="outline"
                    className="mt-3 !h-11 w-full rounded-xl text-[10px] font-black uppercase tracking-widest border-teal-200 text-teal-700 hover:bg-teal-50"
                    onClick={() => setShowVoidConfirm(true)}
                  >
                    Void Contract
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

                  {/* BR-CON-011: Renewal logic strictly depends on a prior expected_move_out_date. 
                      Hide for Open Ended contracts to prevent logical state conflicts. */}
                  {contract.expected_move_out_date && (
                    <div className="mt-6 pt-6 border-t border-stone-100">
                      <p className="text-[10px] font-medium text-stone-400 leading-relaxed mb-4">
                        Extend this contract for another term. This will pre-fill a new contract with current terms.
                      </p>
                      <Link
                        href={`/contracts/new?renew_contract_id=${contractId}`}
                        className="flex items-center justify-center gap-2 w-full !h-11 rounded-xl bg-teal-600 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-teal-900/10 hover:bg-teal-700 transition-all"
                      >
                        <FileSignature size={16} />
                        Renew Contract
                      </Link>
                    </div>
                  )}
                </Card>
              ) : null}

              {canManageContracts(currentUser) && !isActive && contract.status !== "pending_payment" ? (
                <Card className="rounded-2xl border-stone-200 !p-6 shadow-sm bg-stone-50/50 border-stone-200">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-stone-500">History Management</h3>

                  {isEnded && !contract.is_cleared && (
                    <div className="mt-4 p-4 rounded-xl bg-amber-50 border border-amber-100 mb-4">
                      <p className="text-[10px] font-bold text-amber-700 uppercase tracking-widest mb-2">Unsettled Deposit</p>
                      <p className="text-[10px] font-medium text-amber-600 leading-relaxed mb-4">
                        The security deposit (₱{contract.deposit_amount}) has not been refunded or rolled over.
                      </p>
                      <Button
                        variant="primary"
                        className="!h-9 w-full rounded-lg text-[10px] font-black uppercase tracking-widest bg-amber-600 hover:bg-amber-700 shadow-lg shadow-amber-900/10"
                        onClick={() => router.push(`/payments/new?contract_id=${contractId}&category=refund&amount=${contract.deposit_amount}`)}
                      >
                        Process Deposit Refund
                      </Button>
                    </div>
                  )}

                  <p className="mt-2 text-[10px] font-medium text-stone-400 leading-relaxed">
                    Closed contracts can be archived for cleaner listings. Financial records will still be retained.
                  </p>
                  <Button
                    variant="outline"
                    className="mt-4 !h-9 w-full rounded-lg text-[10px] font-black uppercase tracking-widest border-stone-200 text-stone-600 hover:bg-white"
                    onClick={() => setShowArchiveConfirm(true)}
                    disabled={!contract.is_cleared}
                  >
                    Archive Agreement
                  </Button>
                  {!contract.is_cleared && (
                    <p className="mt-2 text-[9px] font-bold text-rose-400 uppercase tracking-tighter text-center">
                      Settlement required before archiving
                    </p>
                  )}
                </Card>
              ) : null}
            </aside>

            <main className="space-y-6 lg:col-span-8">
              <FormSection
                title="Room Assignment"
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
                    <DetailRow label="Deposit Amount" value={<CurrencyDisplay amount={contract.deposit_amount} />} icon={FileCheck} />
                    {contract.monthly_rate_override ? (
                      <>
                        <DetailRow
                          label="Standard Rate"
                          value={<span className="line-through text-stone-400"><CurrencyDisplay amount={contract.monthly_rate} /></span>}
                          icon={Receipt}
                        />
                        <DetailRow
                          label="Agreed Rent"
                          value={<span className="font-bold text-teal-700"><CurrencyDisplay amount={contract.monthly_rate_override} /></span>}
                          icon={Wallet}
                        />
                      </>
                    ) : (
                      <DetailRow label="Monthly Rate" value={<CurrencyDisplay amount={contract.monthly_rate} />} icon={Receipt} />
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
                          <CurrencyDisplay
                            amount={p.amount_paid}
                            className="text-sm font-bold text-emerald-700"
                          />
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
                    emptyTitle="No payments posted"
                    emptyDescription="Historical payments will appear here once collections are posted."
                  />
                </div>
              </Card>
            </main>
          </div>
        ) : !loading && !contractError ? (
          <Alert variant="warning" title="Agreement Not Found">
            The requested contract profile could not be found in the registry.
          </Alert>
        ) : null}

        {!loading && !canManageContracts(currentUser) && (
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
