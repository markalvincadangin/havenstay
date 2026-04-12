"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, Calendar, FileText, Wallet, ShieldCheck, TrendingUp } from "lucide-react";

import { apiRequest } from "../../../lib/api";
import { canManageBilling } from "../../../lib/auth";
import { flattenApiErrors } from "../../../lib/errors";
import { formatPHP, formatDateString } from "../../../lib/formatters";
import { useAuthGuard } from "../../../hooks/useAuthGuard";
import { useUnsavedChangesWarning } from "../../../lib/useUnsavedChangesWarning";
import Alert from "../../_components/ui/Alert";
import { AppMain } from "../../_components/ui/AppShell";
import Button from "../../_components/ui/Button";
import { Card } from "../../_components/ui/Card";
import { Field, Input, Select } from "../../_components/ui/Fields";
import PageHeader from "../../_components/ui/PageHeader";
import Spinner from "../../_components/ui/Spinner";
import Breadcrumbs from "../../_components/ui/Breadcrumbs";
import UserRoleBadge from "../../_components/ui/UserRoleBadge";
import { normalizePaginatedList } from "../../../lib/pagination";

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.2, ease: "easeOut" },
};

function tenantLabel(t) {
  if (!t) return "—";
  const fn = String(t.first_name || "").trim();
  const ln = String(t.last_name || "").trim();
  return [fn, ln].filter(Boolean).join(" ") || "—";
}

function contractDisplayLabel(c) {
  const tenant = tenantLabel(c.tenant);
  const room = c.room?.room_code ?? c.room_id ?? "—";
  const start = formatDateString(c.move_in_date);
  return `${tenant} — Room ${room} (Start: ${start})`;
}

export default function NewBillingPage() {
  const router = useRouter();
  const { user: currentUser, authLoading } = useAuthGuard();
  const shouldReduceMotion = useReducedMotion();
  const [activeContracts, setActiveContracts] = useState([]);
  const [loadingContracts, setLoadingContracts] = useState(true);
  const [contractsError, setContractsError] = useState("");
  const [apiError, setApiError] = useState("");

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({
    defaultValues: {
      contract_id: "",
      billing_period_from: "",
      billing_period_to: "",
      due_date: "",
      base_rent_amount: "",
      include_base_rent: true,
      utility_amount: "",
      add_on_amount: "",
      penalty_amount: "",
      adjustment_amount: "",
    },
  });

  useUnsavedChangesWarning(isDirty && !isSubmitting);

  const includeBaseRent = watch("include_base_rent");
  const baseRentAmount = watch("base_rent_amount");
  const utilityAmount = watch("utility_amount");
  const addOnAmount = watch("add_on_amount");
  const penaltyAmount = watch("penalty_amount");
  const adjustmentAmount = watch("adjustment_amount");

  const totalDue = useMemo(() => {
    const parse = (v) => {
      const n = parseFloat(String(v || "").replace(",", ""));
      return Number.isFinite(n) ? n : 0;
    };
    let total = 0;
    if (includeBaseRent) total += parse(baseRentAmount);
    total += parse(utilityAmount);
    total += parse(addOnAmount);
    total += parse(penaltyAmount);
    total += parse(adjustmentAmount);
    return total;
  }, [
    includeBaseRent,
    baseRentAmount,
    utilityAmount,
    addOnAmount,
    penaltyAmount,
    adjustmentAmount,
  ]);

  useEffect(() => {
    if (authLoading || !currentUser) return;
    if (!canManageBilling(currentUser)) {
      setLoadingContracts(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const data = await apiRequest("/api/contracts?status=active&per_page=100", { method: "GET" });
        if (cancelled) return;
        setActiveContracts(normalizePaginatedList(data).rows);
      } catch (e) {
        if (!cancelled) setContractsError(flattenApiErrors(e));
      } finally {
        if (!cancelled) setLoadingContracts(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, currentUser]);

  useEffect(() => {
    if (activeContracts.length === 0) return;
    const current = getValues("contract_id");
    if (current !== "" && current !== undefined) return;
    setValue("contract_id", String(activeContracts[0].contract_id), {
      shouldValidate: true,
      shouldDirty: false,
    });
  }, [activeContracts, getValues, setValue]);

  const selectedContractId = watch("contract_id");
  useEffect(() => {
    if (!selectedContractId || activeContracts.length === 0) return;
    const contract = activeContracts.find(c => String(c.contract_id) === String(selectedContractId));
    if (!contract) return;

    const toLocalIso = (d) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    let startDate;
    if (contract.latest_billing?.billing_period_to) {
      const latestTo = new Date(contract.latest_billing.billing_period_to);
      startDate = new Date(latestTo.getFullYear(), latestTo.getMonth() + 1, 1);
    } else {
      const moveIn = new Date(contract.move_in_date);
      startDate = new Date(moveIn.getFullYear(), moveIn.getMonth(), 1);
    }

    const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
    const dueDate = new Date(startDate.getFullYear(), startDate.getMonth(), 15);

    setValue("billing_period_from", toLocalIso(startDate));
    setValue("billing_period_to", toLocalIso(endDate));
    setValue("due_date", toLocalIso(dueDate));
    setValue("base_rent_amount", contract.monthly_rate || "");
  }, [selectedContractId, activeContracts, setValue]);

  const onSubmit = async (data) => {
    setApiError("");
    const lineItems = [];
    const pushIfPositive = (amountStr, itemType, description) => {
      const n = parseFloat(String(amountStr || "").replace(",", ""));
      if (Number.isFinite(n) && n !== 0) {
        lineItems.push({
          item_type: itemType,
          item_description: description,
          amount: n,
        });
      }
    };

    if (data.include_base_rent) {
      const br = parseFloat(String(data.base_rent_amount || "").replace(",", ""));
      if (Number.isFinite(br) && br > 0) {
        lineItems.push({
          item_type: "base_rent",
          item_description: "Monthly Rent",
          amount: br,
        });
      }
    }
    pushIfPositive(data.utility_amount, "utility", "Utilities");
    pushIfPositive(data.add_on_amount, "add_on", "Add-ons");
    pushIfPositive(data.penalty_amount, "penalty", "Late Fee / Penalty");
    pushIfPositive(data.adjustment_amount, "adjustment", "Adjustment");

    if (lineItems.length === 0) {
      setApiError("Minimum protocol violation: Aggregate statement must contain at least one non-zero line item.");
      return;
    }

    try {
      const payload = {
        contract_id: parseInt(data.contract_id, 10),
        billing_period_from: data.billing_period_from,
        billing_period_to: data.billing_period_to,
        due_date: data.due_date,
        line_items: lineItems,
      };

      const result = await apiRequest("/api/billing", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const id = result?.billing?.billing_id;
      if (id) router.push(`/billing/${id}`);
    } catch (e) {
      setApiError(flattenApiErrors(e));
    }
  };

  if (authLoading || loadingContracts) {
    return (
      <AppMain>
        <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
          <Spinner className="size-10 text-teal-600" />
          <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Syncing active contracts…</p>
        </div>
      </AppMain>
    );
  }

  if (!canManageBilling(currentUser)) {
    return (
      <AppMain>
        <div className="mx-auto mt-8 w-full max-w-4xl space-y-6">
          <Alert variant="warning" title="Protocol Restricted">
            Administrative clearance required to generate statements.
          </Alert>
          <Button variant="secondary" onClick={() => router.push("/billing")} className="!h-11 px-8 rounded-xl text-[10px] font-bold uppercase tracking-widest">
            Cancel
          </Button>
        </div>
      </AppMain>
    );
  }

  return (
    <AppMain>
      <motion.div
        className="mx-auto mt-8 w-full max-w-4xl space-y-6"
        initial={shouldReduceMotion ? false : pageVariants.initial}
        animate={shouldReduceMotion ? false : pageVariants.animate}
        transition={shouldReduceMotion ? { duration: 0.2 } : pageVariants.transition}
      >
        <PageHeader
          title="Post Statement"
          subtitle="Generate a monthly cycle statement for an active tenant contract."
          breadcrumbs={
            <Breadcrumbs
              items={[
                { label: "Billing", href: "/billing" },
                { label: "Post Statement" },
              ]}
            />
          }
          actions={
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => router.push("/billing")}
                className="inline-flex size-11 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-500 transition-colors hover:bg-stone-50"
                aria-label="Back to Billing"
              >
                <ArrowLeft size={18} aria-hidden />
              </button>
              <div className="border-l border-stone-200 pl-3">
                <UserRoleBadge username={currentUser?.username} roleName={currentUser?.role?.role_name} />
              </div>
            </div>
          }
        />

        {contractsError && <Alert variant="error" title="Could not load contracts">{contractsError}</Alert>}

        {activeContracts.length === 0 && !contractsError ? (
          <div className="space-y-4">
            <Alert variant="warning" title="Population Empty">
              No active tenant contracts found for billing.
            </Alert>
            <Button variant="secondary" onClick={() => router.push("/contracts")} className="!h-11 px-8 rounded-xl text-[10px] font-bold uppercase tracking-widest">
              Return to Contracts
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
              <div className="flex items-center gap-3 border-b border-stone-100 bg-stone-50/50 px-8 py-5">
                <div className="flex size-8 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                  <FileText size={16} aria-hidden />
                </div>
                <h2 className="hs-strip-title text-stone-400 tracking-widest uppercase font-black text-sm">Tenant & Room</h2>
              </div>
              <div className="space-y-6 p-8">
                <Field
                  label="Target Contract"
                  required
                  error={errors.contract_id?.message}
                >
                  <Select
                    id="contract_id"
                    className="!h-12 border-stone-200 font-bold"
                    hasError={Boolean(errors.contract_id)}
                    {...register("contract_id", { required: "Mandatory: Select an active resident contract." })}
                  >
                    <option value="">Select Contract…</option>
                    {activeContracts.map((c) => (
                      <option key={c.contract_id} value={c.contract_id}>
                        {contractDisplayLabel(c)}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            </Card>

            <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
              <div className="flex items-center gap-3 border-b border-stone-100 bg-stone-50/50 px-8 py-5">
                <div className="flex size-8 items-center justify-center rounded-lg bg-stone-50 text-stone-600">
                  <Calendar size={16} aria-hidden />
                </div>
                <h2 className="hs-strip-title text-stone-400 tracking-widest uppercase font-black text-sm">Billing Dates</h2>
              </div>
              <div className="grid gap-6 p-8 sm:grid-cols-3">
                <Field label="Cycle Start" required error={errors.billing_period_from?.message}>
                  <Input
                    type="date"
                    className="!h-12 border-stone-200 font-bold"
                    {...register("billing_period_from", { required: "Mandatory." })}
                  />
                </Field>
                <Field label="Cycle End" required error={errors.billing_period_to?.message}>
                  <Input
                    type="date"
                    className="!h-12 border-stone-200 font-bold"
                    {...register("billing_period_to", { required: "Mandatory." })}
                  />
                </Field>
                <Field label="Payment Deadline" required error={errors.due_date?.message}>
                  <Input
                    type="date"
                    className="!h-12 border-stone-200 font-bold"
                    {...register("due_date", { required: "Mandatory." })}
                  />
                </Field>
              </div>
            </Card>

            <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
              <div className="flex items-center gap-3 border-b border-stone-100 bg-stone-50/50 px-8 py-5">
                <div className="flex size-8 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                  <Wallet size={16} aria-hidden />
                </div>
                <h2 className="hs-strip-title text-stone-400 tracking-widest uppercase font-black text-sm">Charges & Fees</h2>
              </div>
              <div className="space-y-8 p-8">
                <Alert variant="info" title="Charges" className="!py-3">
                  Rent is normally billed as a <span className="font-mono text-xs">base_rent</span> line (BR-001). Security
                  deposits belong on the contract record, not as billing line items (BR-002). The statement total must not
                  be negative (FR-021b).
                </Alert>
                <div className="rounded-2xl border border-stone-100 bg-stone-50/30 p-6">
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 h-5 w-5 rounded-lg border-stone-300 text-teal-600 focus:ring-teal-500/20"
                      {...register("include_base_rent")}
                    />
                    <div>
                      <span className="block text-xs font-black uppercase tracking-widest text-stone-900">Include Monthly Rent</span>
                      <span className="mt-1 block text-xs font-medium text-stone-400">
                        Include monthly rent as defined in the master contract.
                      </span>
                    </div>
                  </label>
                  {includeBaseRent && (
                    <div className="mt-6 pt-6 border-t border-stone-100">
                      <Field label="Contracted Monthly Yield (₱)">
                        <Input
                          type="number"
                          readOnly
                          className="!h-12 border-stone-200 font-mono text-lg font-black bg-stone-50/50 cursor-not-allowed tabular-nums text-stone-400"
                          {...register("base_rent_amount")}
                        />
                      </Field>
                    </div>
                  )}
                </div>

                <div className="grid gap-6 sm:grid-cols-2">
                  <Field label="Utilities (₱)">
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      className="!h-12 border-stone-200 font-mono font-bold tabular-nums"
                      {...register("utility_amount")}
                    />
                  </Field>
                  <Field label="Add-ons (₱)">
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      className="!h-12 border-stone-200 font-mono font-bold tabular-nums"
                      {...register("add_on_amount")}
                    />
                  </Field>
                  <Field label="Penalties (₱)">
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      className="!h-12 border-stone-200 font-mono font-bold tabular-nums text-red-700"
                      {...register("penalty_amount")}
                    />
                  </Field>
                  <Field label="Adjustments (₱)">
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      className="!h-12 border-stone-200 font-mono font-bold tabular-nums"
                      {...register("adjustment_amount")}
                    />
                  </Field>
                </div>

                {totalDue < 0 ? (
                  <Alert variant="warning" title="Invalid total">
                    Preview total is negative. Adjust line items so the cycle total is zero or positive before submitting.
                  </Alert>
                ) : null}

                <div className="flex flex-col justify-between gap-4 rounded-2xl border border-teal-600/10 bg-teal-50/30 p-8 sm:flex-row sm:items-center">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                        <TrendingUp size={14} className="text-teal-700" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-teal-800/70">Statement Aggregate Yield</p>
                    </div>
                    <p className="font-mono text-4xl font-black text-teal-900 tabular-nums">{formatPHP(totalDue)}</p>
                  </div>
                  <div className="flex items-start gap-3 max-w-sm rounded-xl bg-white/50 p-4 border border-teal-600/5">
                     <ShieldCheck size={16} className="text-teal-600 mt-0.5" />
                     <p className="text-[11px] font-medium text-teal-900/60 leading-relaxed">
                       Postings to the authoritative ledger are permanent. Finalize all cycle items before confirming the statement.
                     </p>
                  </div>
                </div>
              </div>
            </Card>

            {apiError && <Alert variant="error" title="Post Failed">{apiError}</Alert>}

            <div className="flex flex-col-reverse gap-3 border-t border-stone-100 pt-8 sm:flex-row sm:items-center sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                onClick={() => router.push("/billing")}
                className="!h-11 rounded-xl px-8 text-[10px] font-bold uppercase tracking-widest"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={isSubmitting}
                disabled={totalDue < 0}
                className="!h-11 rounded-xl bg-teal-600 px-12 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-teal-900/10 hover:bg-teal-700 active:scale-95"
              >
                Generate Bill
              </Button>
            </div>
          </form>
        )}
      </motion.div>
    </AppMain>
  );
}
