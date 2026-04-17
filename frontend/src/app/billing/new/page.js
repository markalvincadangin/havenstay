"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Calendar, FileText, Wallet, ShieldCheck, TrendingUp } from "lucide-react";

import { apiRequest } from "../../../lib/api";
import { canManageBilling } from "../../../lib/auth";
import { applyServerFieldErrors } from "../../../lib/forms";
import { formatPHP, formatDateString } from "../../../lib/formatters";
import { useUnsavedChangesWarning } from "../../../lib/useUnsavedChangesWarning";
import Alert from "../../_components/ui/Alert";
import Button from "../../_components/ui/Button";
import { Field, Input, Select } from "../../_components/ui/Fields";
import Breadcrumbs from "../../_components/ui/Breadcrumbs";
import {
  primaryLinkCtaClass,
  secondaryOutlineLinkClass,
} from "../../_components/ui/LinkTokens";
import { normalizePaginatedList } from "../../../lib/pagination";
import StandardPage from "../../_components/ui/StandardPage";
import { FormSection } from "../../_components/ui/FormSection";
import { useAuth } from "../../_context/AuthContext";
import PageHeaderActions from "../../_components/ui/PageHeaderActions";

function tenantLabel(t) {
  if (!t) return "—";
  const fn = String(t.first_name || "").trim();
  const ln = String(t.last_name || "").trim();
  return [fn, ln].filter(Boolean).join(" ") || "—";
}

function contractDisplayLabel(c) {
  const tenant = tenantLabel(c.tenant);
  const room = c.room?.room_code ?? c.room_id ?? "—";
  const bedLabel = c.bed_space?.bed_label || c.bedSpace?.bed_label || "";
  const start = formatDateString(c.move_in_date);
  return `${tenant} — Room ${room}${bedLabel ? ` / ${bedLabel}` : ""} (Start: ${start})`;
}

export default function NewBillingPage() {
  const router = useRouter();
  const { user: currentUser } = useAuth();
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
    setError,
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
      const n = parseFloat(String(v || "").replaceAll(",", ""));
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
    if (!currentUser) return;
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
        if (!cancelled) setContractsError(e?.message || "Failed to load contracts.");
      } finally {
        if (!cancelled) setLoadingContracts(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentUser]);

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
    const dueDate = new Date(startDate.getFullYear(), startDate.getMonth(), 6);

    setValue("billing_period_from", toLocalIso(startDate));
    setValue("billing_period_to", toLocalIso(endDate));
    setValue("due_date", toLocalIso(dueDate));
    setValue("base_rent_amount", contract.monthly_rate || "");
  }, [selectedContractId, activeContracts, setValue]);

  const onSubmit = async (data) => {
    setApiError("");
    const lineItems = [];
    const pushIfPositive = (amountStr, itemType, description) => {
      const n = parseFloat(String(amountStr || "").replaceAll(",", ""));
      if (Number.isFinite(n) && n !== 0) {
        lineItems.push({
          item_type: itemType,
          item_description: description,
          amount: n,
        });
      }
    };

    if (data.include_base_rent) {
      const br = parseFloat(String(data.base_rent_amount || "").replaceAll(",", ""));
      if (Number.isFinite(br) && br > 0) {
        lineItems.push({
          item_type: "base_rent",
          item_description: "Monthly Base Rent",
          amount: br,
        });
      }
    }
    pushIfPositive(data.utility_amount, "utility", "Utilities");
    pushIfPositive(data.add_on_amount, "add_on", "Add-ons");
    pushIfPositive(data.penalty_amount, "penalty", "Late Fee / Penalty");
    pushIfPositive(data.adjustment_amount, "adjustment", "Adjustment");

    if (lineItems.length === 0) {
      setApiError("Add at least one non-zero charge before generating billing.");
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
      applyServerFieldErrors(e, setError, { setApiError });
    }
  };

  const readOnly = !canManageBilling(currentUser);

  return (
    <StandardPage
      title="Generate Bill"
      subtitle="Create a monthly billing cycle for an active tenant contract."
      loading={loadingContracts}
      breadcrumbs={
        <Breadcrumbs
          items={[
            { label: "Billing", href: "/billing" },
            { label: "Generate Bill" },
          ]}
        />
      }
      actions={
        <PageHeaderActions
          backHref="/billing"
          backLabel="Back to Billing"
          user={currentUser}
        />
      }
    >
      <div className="mx-auto w-full max-w-4xl space-y-6">
        {readOnly && (
          <Alert variant="warning" title="Access Restricted">
            You do not have permission to generate billing.
          </Alert>
        )}

        {contractsError && <Alert variant="error" title="Could not load contracts">{contractsError}</Alert>}

        <Alert variant="info" title="Manual amounts (BR-023)">
          First and last billing cycles may be partial months. Release 1 does not auto-prorate: this form prefills
          calendar month boundaries and the contract monthly rate for convenience only. Enter line-item amounts that
          match your approved proration before posting.
        </Alert>

        {activeContracts.length === 0 && !contractsError && !loadingContracts ? (
          <div className="space-y-4">
            <Alert variant="warning" title="No active contracts">
              No active tenant contracts found for billing.
            </Alert>
            <Button variant="secondary" onClick={() => router.push("/contracts")} className="!h-11 px-8 rounded-xl text-[10px] font-bold uppercase tracking-widest">
              Return to Contracts
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <FormSection title="Tenant & Room" icon={FileText}>
              <Field
                label="Active Contract"
                required
                error={errors.contract_id?.message}
              >
                <Select
                  id="contract_id"
                  className="!h-12 border-stone-200 font-bold"
                  hasError={Boolean(errors.contract_id)}
                  {...register("contract_id", { required: "Select an active contract for this billing cycle." })}
                >
                  <option value="">Select Contract…</option>
                  {activeContracts.map((c) => (
                    <option key={c.contract_id} value={c.contract_id}>
                      {contractDisplayLabel(c)}
                    </option>
                  ))}
                </Select>
              </Field>
            </FormSection>

            <FormSection title="Billing Dates" icon={Calendar}>
              <div className="grid gap-6 sm:grid-cols-3">
                <Field label="Billing period from" required error={errors.billing_period_from?.message}>
                  <Input
                    type="date"
                    className="!h-12 border-stone-200 font-bold"
                    {...register("billing_period_from", { required: "Billing period start is required." })}
                  />
                </Field>
                <Field label="Billing period to" required error={errors.billing_period_to?.message}>
                  <Input
                    type="date"
                    className="!h-12 border-stone-200 font-bold"
                    {...register("billing_period_to", { required: "Billing period end is required." })}
                  />
                </Field>
                <Field label="Due date" required error={errors.due_date?.message}>
                  <Input
                    type="date"
                    className="!h-12 border-stone-200 font-bold"
                    {...register("due_date", { required: "Due date is required." })}
                  />
                </Field>
              </div>
            </FormSection>

            <FormSection title="Charges & Fees" icon={Wallet}>
              <div className="space-y-8">
                <Alert variant="info" title="Charges" className="!py-3">
                  Monthly rent should be billed as a base rent line item. Security deposits stay on the contract record,
                  and the total billing amount must stay at zero or above.
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
                        Include the monthly rent saved on the active contract.
                      </span>
                    </div>
                  </label>
                  {includeBaseRent && (
                    <div className="mt-6 pt-6 border-t border-stone-100">
                      <Field label="Monthly rate (PHP)">
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

                {totalDue < 0 && (
                  <Alert variant="warning" title="Invalid total">
                    Preview total is negative. Adjust line items so the cycle total is zero or positive before submitting.
                  </Alert>
                )}

                <div className="flex flex-col justify-between gap-4 rounded-2xl border border-teal-600/10 bg-teal-50/30 p-8 sm:flex-row sm:items-center">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                        <TrendingUp size={14} className="text-teal-700" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-teal-800/70">Total billing amount</p>
                    </div>
                    <p className="font-mono text-4xl font-black text-teal-900 tabular-nums">{formatPHP(totalDue)}</p>
                  </div>
                  <div className="flex items-start gap-3 max-w-sm rounded-xl bg-white/50 p-4 border border-teal-600/5">
                     <ShieldCheck size={16} className="text-teal-600 mt-0.5" />
                     <p className="text-[11px] font-medium text-teal-900/60 leading-relaxed">
                       Billing is saved to the ledger as a new cycle. Review the line items before generating the bill.
                     </p>
                  </div>
                </div>
              </div>
            </FormSection>

            {apiError && <Alert variant="error" title="Could not generate billing">{apiError}</Alert>}

            <div className="flex flex-col-reverse gap-3 border-t border-stone-100 pt-8 sm:flex-row sm:items-center sm:justify-end">
              <Link
                href="/billing"
                className={secondaryOutlineLinkClass + " px-10"}
              >
                Cancel
              </Link>
              <Button
                type="submit"
                variant="primary"
                loading={isSubmitting}
                disabled={totalDue < 0 || isSubmitting || readOnly}
                className={primaryLinkCtaClass + " px-12 border-0"}
              >
                Generate Bill
              </Button>
            </div>
          </form>
        )}
      </div>
    </StandardPage>
  );
}
