"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { motion, useReducedMotion } from "framer-motion";
import { Calendar, RefreshCw, Wallet, ShieldCheck } from "lucide-react";

import { apiRequest, fetcher } from "../../../../lib/api";
import { canManageContracts } from "../../../../lib/auth";
import { useAuthGuard } from "../../../../hooks/useAuthGuard";
import { applyServerFieldErrors } from "../../../../lib/forms";
import { parseMoneyInput } from "../../../../lib/money";
import { useUnsavedChangesWarning } from "../../../../hooks/useUnsavedChangesWarning";
import Alert from "../../../_components/ui/Alert";
import Button from "../../../_components/ui/Button";
import { Field, Input, Select, Textarea } from "../../../_components/ui/Fields";
import Spinner from "../../../_components/ui/Spinner";
import Breadcrumbs from "../../../_components/ui/Breadcrumbs";
import {
  primaryLinkCtaClass,
  secondaryOutlineLinkClass,
} from "../../../_components/ui/LinkTokens";
import { CONTRACT_STATUS_LABELS, isContractActive } from "../../../../lib/constants";
import { formatTenantDirectoryName } from "../../../../lib/formatters";
import StandardPage from "../../../_components/ui/StandardPage";
import PageHeaderActions from "../../../_components/ui/PageHeaderActions";
import SectionCard from "../../../_components/ui/SectionCard";

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.2, ease: "easeOut" },
};

export default function EditContractPage() {
  const params = useParams();
  const router = useRouter();
  const contractId = params?.id;

  const { user: currentUser, authLoading, isUnauthorized } = useAuthGuard();
  const shouldReduceMotion = useReducedMotion();
  const [apiError, setApiError] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({
    defaultValues: {
      move_in_date: "",
      expected_move_out: "",
      actual_move_out: "",
      deposit_amount: "",
      monthly_rate: "",
      status: "active",
      notes: "",
    },
  });

  useUnsavedChangesWarning(isDirty && !isSubmitting);

  const { data: contractData, error: contractError } = useSWR(
    !authLoading && currentUser && contractId ? `/api/contracts/${contractId}` : null,
    fetcher
  );

  const loading = !contractData && !contractError;
  const pageTitle = "Update Details";
  const defaultSubtitle = "Edit contract registry record.";

  const derivedApiError = contractError ? (contractError?.message || "Failed to load contract.") : "";
  const apiErrorToShow = derivedApiError || apiError;

  useEffect(() => {
    if (contractData) {
      reset({
        move_in_date: contractData.move_in_date?.split("T")[0] || "",
        expected_move_out: contractData.expected_move_out_date?.split("T")[0] || "",
        actual_move_out: contractData.actual_move_out_date?.split("T")[0] || "",
        deposit_amount: contractData.deposit_amount ?? "",
        monthly_rate: contractData.monthly_rate ?? "",
        status: contractData.status || "active",
        notes: contractData.notes || "",
      });
    }
  }, [contractData, reset]);

  const onSubmit = async (values) => {
    setApiError("");
    if (!canManageContracts(currentUser)) {
      setApiError("Unauthorized: only Admin or Staff can update contracts.");
      return;
    }

    try {
      const depositParsed = parseMoneyInput(values.deposit_amount);
      const monthlyParsed = parseMoneyInput(values.monthly_rate);
      if (Number.isNaN(depositParsed) || Number.isNaN(monthlyParsed)) {
        setApiError("Enter valid amounts for deposit and monthly rate.");
        return;
      }
      const isActiveContract = isContractActive(contractData?.status);
      const payload = {
        expected_move_out: values.expected_move_out || null,
        deposit_amount: depositParsed,
        monthly_rate: monthlyParsed,
        notes: values.notes || null,
        // Active contracts must be completed via the move-out workflow.
        ...(isActiveContract ? {} : { actual_move_out: values.actual_move_out || null, status: values.status }),
      };

      await apiRequest(`/api/contracts/${contractId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      router.push(`/contracts/${contractId}`);
    } catch (error) {
      applyServerFieldErrors(error, setError, { setApiError });
    }
  };

  if (isUnauthorized) return null;
  if (authLoading || loading) {
    return (
      <StandardPage
        title={pageTitle}
        subtitle={defaultSubtitle}
        loading
        skeleton={<Spinner label="Accessing agreement record…" />}
      />
    );
  }

  const contract = contractData ?? null;
  const readOnly = !canManageContracts(currentUser);
  const recordLabel = contract ? `#CONTRACT-${contract.contract_id}` : "Agreement";

  const bedLabel =
    contract?.bed_space?.bed_label || contract?.bedSpace?.bed_label || "—";

  return (
    <StandardPage
      title={pageTitle}
      subtitle={
        contract
          ? `Update agreement details for ${recordLabel}.`
          : defaultSubtitle
      }
      breadcrumbs={
        <Breadcrumbs
          items={[
            { label: "Contract Ledger", href: "/contracts" },
            { label: recordLabel, href: `/contracts/${contractId}` },
            { label: "Update Terms" },
          ]}
        />
      }
      actions={
        <PageHeaderActions
          backHref={`/contracts/${contractId}`}
          backLabel="Back to Profile"
          user={currentUser}
        />
      }
    >
      <motion.div
        className="mx-auto mt-8 w-full max-w-4xl space-y-6"
        initial={shouldReduceMotion ? false : pageVariants.initial}
        animate={shouldReduceMotion ? false : pageVariants.animate}
        transition={shouldReduceMotion ? { duration: 0 } : pageVariants.transition}
      >
        <div className="space-y-6">
        {readOnly && (
          <Alert variant="warning" title="Restricted Access">
            You do not have administrative clearance to update agreement terms.
          </Alert>
        )}

        {apiErrorToShow && (
          <Alert variant="error" title="Submission Error">
            {apiErrorToShow}
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <SectionCard
            title="Identity Details"
            icon={RefreshCw}
            iconClassName="bg-stone-100 text-stone-600"
            rightElement={(
              <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-teal-600">
                {recordLabel}
              </p>
            )}
          >
            <div className="grid gap-6 sm:grid-cols-2">
              <Field label="Primary Tenant (read-only)">
                <div className="flex h-11 items-center rounded-xl border border-stone-100 bg-stone-50/50 px-4 text-sm font-bold text-stone-700">
                  {contract?.tenant ? formatTenantDirectoryName(contract.tenant) : "—"}
                </div>
              </Field>
              <Field label="Assigned Unit (read-only)">
                <div className="flex h-11 items-center rounded-xl border border-stone-100 bg-stone-50/50 px-4 text-sm font-bold text-stone-700">
                  {contract?.room?.room_code ? `${contract.room.room_code} · ${bedLabel}` : "—"}
                </div>
              </Field>
            </div>
          </SectionCard>

          <SectionCard
            title="Contract Schedule"
            icon={Calendar}
            iconClassName="bg-teal-50 text-teal-600"
          >
            <div className="space-y-8">
              <div className="grid gap-6 sm:grid-cols-2">
                <Field label="Move-in Date (read-only)">
                  <Input
                    disabled
                    className="!h-11 border-stone-100 bg-stone-50/50 font-bold"
                    value={contract?.move_in_date?.split("T")[0] || ""}
                    readOnly
                  />
                </Field>
                <Field label="Operational Status" error={errors.status?.message}>
                  <Select
                    disabled={readOnly || isContractActive(contract?.status)}
                    className="!h-11 border-stone-200 font-black text-teal-700 uppercase tracking-widest text-[10px]"
                    hasError={Boolean(errors.status)}
                    {...register("status")}
                  >
                    {Object.entries(CONTRACT_STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <div className="grid gap-6 sm:grid-cols-2">
                <Field label="Contract Expiration" error={errors.expected_move_out?.message}>
                  <Input
                    type="date"
                    disabled={readOnly}
                    className="!h-11 border-stone-200"
                    hasError={Boolean(errors.expected_move_out)}
                    {...register("expected_move_out", {
                      validate: (value) => {
                        if (!value) return true;
                        if (contract?.move_in_date && new Date(value) <= new Date(contract.move_in_date)) {
                          return "Must be after inception date.";
                        }
                        return true;
                      },
                    })}
                  />
                </Field>
                <Field label="Termination Date" error={errors.actual_move_out?.message}>
                  <Input
                    type="date"
                    disabled={readOnly || isContractActive(contract?.status)}
                    className="!h-11 border-stone-200"
                    hasError={Boolean(errors.actual_move_out)}
                    {...register("actual_move_out")}
                  />
                </Field>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Financial Obligations"
            icon={Wallet}
            iconClassName="bg-emerald-50 text-emerald-600"
          >
            <div className="grid gap-6 sm:grid-cols-2">
              <Field label="Monthly Obligation" required error={errors.monthly_rate?.message}>
                <Input
                  type="number"
                  step="0.01"
                  disabled={readOnly}
                  className="!h-11 border-stone-200 font-mono font-bold tabular-nums"
                  hasError={Boolean(errors.monthly_rate)}
                  {...register("monthly_rate", {
                    required: "Entry required.",
                    min: { value: 500, message: "Min ₱500" },
                  })}
                />
              </Field>
              <Field label="Security Deposit" required error={errors.deposit_amount?.message}>
                <Input
                  type="number"
                  step="0.01"
                  disabled={readOnly}
                  className="!h-11 border-stone-200 font-mono font-bold tabular-nums"
                  hasError={Boolean(errors.deposit_amount)}
                  {...register("deposit_amount", {
                    required: "Entry required.",
                  })}
                />
              </Field>
            </div>
          </SectionCard>

          <SectionCard
            title="Registry Details"
          >
            <Field label="Administrative Notes">
              <Textarea
                rows={3}
                disabled={readOnly}
                placeholder="Lease notes, specific conditions, etc."
                className="border-stone-200"
                {...register("notes", {
                  maxLength: { value: 1000, message: "Max 1,000 characters" },
                })}
              />
            </Field>
          </SectionCard>

          <div className="flex flex-col-reverse gap-3 pt-8 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push(`/contracts/${contractId}`)}
              className={secondaryOutlineLinkClass + " px-10 border-stone-200"}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={isSubmitting}
              disabled={readOnly || isSubmitting}
              className={primaryLinkCtaClass + " px-12 border-0"}
            >
              Save Changes
            </Button>
          </div>
        </form>
        </div>

        <div className="flex items-center gap-3 rounded-2xl bg-stone-50 p-6 text-stone-500">
          <ShieldCheck size={20} className="text-stone-300" />
          <p className="text-[10px] font-bold uppercase tracking-widest leading-relaxed">
            Modifying active agreement terms will be recorded in the audit trail. Financial changes may affect upcoming billing cycles.
          </p>
        </div>
      </motion.div>
    </StandardPage>
  );
}
