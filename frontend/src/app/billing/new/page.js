"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, Calendar, FileText, Wallet } from "lucide-react";
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
  return `${tenant} — Room ${room} (Move-in: ${start})`;
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
        const data = await apiRequest("/api/contracts?status=active", { method: "GET" });
        if (cancelled) return;
        setActiveContracts(Array.isArray(data) ? data : []);
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

  // Intelligent prefill logic on contract change
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
      // If there's a previous bill, default to the start of the next month
      const latestTo = new Date(contract.latest_billing.billing_period_to);
      startDate = new Date(latestTo.getFullYear(), latestTo.getMonth() + 1, 1);
    } else {
      // Default to start of move-in month
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
          item_description: "Monthly rent",
          amount: br,
        });
      }
    }
    pushIfPositive(data.utility_amount, "utility", "Utilities");
    pushIfPositive(data.add_on_amount, "add_on", "Add-ons");
    pushIfPositive(data.penalty_amount, "penalty", "Late fee / penalty");
    pushIfPositive(data.adjustment_amount, "adjustment", "Adjustment");

    if (lineItems.length === 0) {
      setApiError("Add at least one line item with a non-zero amount.");
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

  if (authLoading) {
    return (
      <AppMain>
        <Spinner label="Loading form…" />
      </AppMain>
    );
  }

  if (!canManageBilling(currentUser)) {
    return (
      <AppMain>
        <div className="mx-auto mt-8 w-full max-w-4xl space-y-6">
          <Alert variant="warning" title="View-only access">
            You do not have permission to create billing entries.
          </Alert>
          <Link
            href="/billing"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-[var(--color-border-strong)] px-5 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-bg)]"
          >
            Back to billing
          </Link>
        </div>
      </AppMain>
    );
  }

  if (loadingContracts) {
    return (
      <AppMain>
        <Spinner label="Loading contracts…" />
      </AppMain>
    );
  }

  return (
    <AppMain>
      <motion.div
        className="mx-auto mt-8 w-full max-w-4xl space-y-6"
        initial={shouldReduceMotion ? false : pageVariants.initial}
        animate={shouldReduceMotion ? false : pageVariants.animate}
        transition={shouldReduceMotion ? { duration: 0 } : pageVariants.transition}
      >
        <PageHeader
          title="Generate Monthly Bill"
          subtitle="Generate a billing cycle for an active lease. Line items roll up into the amount due for this period."
          breadcrumbs={
            <Breadcrumbs
              items={[
                { label: "Billing", href: "/billing" },
                { label: "Create billing entry" },
              ]}
            />
          }
          actions={
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => router.push("/billing")}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-500 transition-colors hover:bg-stone-50"
                aria-label="Back to billing"
                title="Back to billing"
              >
                <ArrowLeft size={18} aria-hidden />
              </button>
              <div className="border-l border-stone-200 pl-3">
                <UserRoleBadge username={currentUser?.username} roleName={currentUser?.role?.role_name} />
              </div>
            </div>
          }
        />

        {contractsError ? (
          <Alert variant="error" title="Could not load contracts">
            {contractsError}
          </Alert>
        ) : null}

        {activeContracts.length === 0 && !contractsError ? (
          <div className="space-y-4">
            <Alert variant="warning" title="No active contracts">
              There are no active contracts to bill. Create a contract first, then return here.
            </Alert>
            <Link
              href="/contracts"
              className="inline-flex h-10 items-center justify-center rounded-lg border border-[var(--color-border-strong)] px-5 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-bg)]"
            >
              Go to contracts
            </Link>
          </div>
        ) : null}

        {activeContracts.length > 0 ? (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
              <div className="flex items-center gap-3 border-b border-stone-100 bg-stone-50/50 px-8 py-5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                  <FileText size={16} aria-hidden />
                </div>
                <h2 className="hs-strip-title">Contract & Tenant</h2>
              </div>
              <div className="space-y-6 p-8">
                <Field
                  label="Active contract"
                  required
                  error={errors.contract_id?.message}
                  helpText="Only contracts in active status appear here."
                >
                  <Select
                    id="contract_id"
                    className="!h-11 border-stone-200"
                    hasError={Boolean(errors.contract_id)}
                    {...register("contract_id", { required: "Select an active contract." })}
                  >
                    <option value="">Select a contract…</option>
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
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                  <Calendar size={16} aria-hidden />
                </div>
                <h2 className="hs-strip-title">Billing Period & Due Date</h2>
              </div>
              <div className="grid gap-6 p-8 sm:grid-cols-3">
                <Field label="Billing Period From" required error={errors.billing_period_from?.message}>
                  <Input
                    id="billing_period_from"
                    type="date"
                    className="!h-11 border-stone-200"
                    hasError={Boolean(errors.billing_period_from)}
                    {...register("billing_period_from", { required: "Required." })}
                  />
                </Field>
                <Field label="Billing Period To" required error={errors.billing_period_to?.message}>
                  <Input
                    id="billing_period_to"
                    type="date"
                    className="!h-11 border-stone-200"
                    hasError={Boolean(errors.billing_period_to)}
                    {...register("billing_period_to", { required: "Required." })}
                  />
                </Field>
                <Field label="Payment Due Date" required error={errors.due_date?.message}>
                  <Input
                    id="due_date"
                    type="date"
                    className="!h-11 border-stone-200"
                    hasError={Boolean(errors.due_date)}
                    {...register("due_date", { required: "Required." })}
                  />
                </Field>
              </div>
            </Card>

            <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
              <div className="flex items-center gap-3 border-b border-stone-100 bg-stone-50/50 px-8 py-5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                  <Wallet size={16} aria-hidden />
                </div>
                <h2 className="hs-strip-title">Line Items</h2>
              </div>
              <div className="space-y-6 p-8">
                <div className="rounded-xl border border-stone-200 bg-stone-50/40 p-5">
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-stone-300 text-teal-600 focus:ring-teal-500"
                      {...register("include_base_rent")}
                    />
                    <span>
                      <span className="block text-sm font-bold text-stone-900">Include base rent</span>
                      <span className="mt-0.5 block text-xs font-medium text-stone-500">
                        Uncheck to bill utilities, fees, or adjustments only.
                      </span>
                    </span>
                  </label>
                  {includeBaseRent ? (
                    <div className="mt-4">
                      <Field 
                        label="Contracted Monthly Rent (₱)" 
                        required 
                        error={errors.base_rent_amount?.message}
                        helpText="This amount is automatically sourced from the contract and remains locked to ensure billing integrity."
                      >
                        <Input
                          id="base_rent_amount"
                          type="number"
                          readOnly
                          inputMode="decimal"
                          step="0.01"
                          placeholder="0.00"
                          className="!h-11 border-stone-200 font-mono bg-stone-50/80 cursor-not-allowed"
                          hasError={Boolean(errors.base_rent_amount)}
                          {...register("base_rent_amount", {
                            validate: (v) => {
                              if (!includeBaseRent) return true;
                              const n = parseFloat(String(v || ""));
                              if (!Number.isFinite(n) || n <= 0) {
                                return "Contract monthly rate must be a positive value.";
                              }
                              return true;
                            },
                          })}
                        />
                      </Field>
                    </div>
                  ) : null}
                </div>

                <div className="grid gap-6 sm:grid-cols-2">
                  <Field label="Utilities (₱)" error={errors.utility_amount?.message}>
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      placeholder="0.00"
                      className="!h-11 border-stone-200 font-mono"
                      {...register("utility_amount")}
                    />
                  </Field>
                  <Field label="Add-ons (₱)" error={errors.add_on_amount?.message}>
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      placeholder="0.00"
                      className="!h-11 border-stone-200 font-mono"
                      {...register("add_on_amount")}
                    />
                  </Field>
                  <Field label="Penalties (₱)" error={errors.penalty_amount?.message}>
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      placeholder="0.00"
                      className="!h-11 border-stone-200 font-mono"
                      {...register("penalty_amount")}
                    />
                  </Field>
                  <Field label="Adjustments (₱)" error={errors.adjustment_amount?.message}>
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      placeholder="0.00"
                      className="!h-11 border-stone-200 font-mono"
                      {...register("adjustment_amount")}
                    />
                  </Field>
                </div>

                <div className="flex flex-col justify-between gap-3 rounded-xl border border-teal-100 bg-teal-50/40 px-5 py-4 sm:flex-row sm:items-center">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-teal-800/70">
                      Total due (preview)
                    </p>
                    <p className="mt-1 font-mono text-2xl font-bold text-teal-900">{formatPHP(totalDue)}</p>
                  </div>
                  <p className="max-w-sm text-xs font-medium text-teal-900/80">
                    Only non-zero amounts are recorded as line items.
                  </p>
                </div>
              </div>
            </Card>

            {apiError ? (
              <Alert variant="error" title="Could not save billing">
                {apiError}
              </Alert>
            ) : null}

            <div className="flex flex-col-reverse gap-3 border-t border-stone-200 pt-6 sm:flex-row sm:items-center sm:justify-end">
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
                disabled={isSubmitting}
                className="!h-11 rounded-xl bg-teal-600 px-12 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-teal-900/10 hover:bg-teal-700"
              >
                Post Billing
              </Button>
            </div>
          </form>
        ) : null}
      </motion.div>
    </AppMain>
  );
}
