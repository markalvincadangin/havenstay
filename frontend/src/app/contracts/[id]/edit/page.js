"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, Calendar, RefreshCw, Wallet, ShieldCheck } from "lucide-react";

import { apiRequest } from "../../../../lib/api";
import { canManageContracts } from "../../../../lib/auth";
import { useAuthGuard } from "../../../../hooks/useAuthGuard";
import { flattenApiErrors } from "../../../../lib/errors";
import { parseMoneyInput } from "../../../../lib/money";
import { useUnsavedChangesWarning } from "../../../../lib/useUnsavedChangesWarning";
import Alert from "../../../_components/ui/Alert";
import { AppMain } from "../../../_components/ui/AppShell";
import Button from "../../../_components/ui/Button";
import { Card } from "../../../_components/ui/Card";
import { Field, Input, Select, Textarea } from "../../../_components/ui/Fields";
import PageHeader from "../../../_components/ui/PageHeader";
import Spinner from "../../../_components/ui/Spinner";
import UserRoleBadge from "../../../_components/ui/UserRoleBadge";
import Breadcrumbs from "../../../_components/ui/Breadcrumbs";
import { CONTRACT_STATUS_LABELS } from "../../../../lib/constants";
import { formatTenantDirectoryName } from "../../../../lib/formatters";

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.2, ease: "easeOut" },
};

export default function EditContractPage() {
  const params = useParams();
  const router = useRouter();
  const contractId = params?.id;

  const { user: currentUser, authLoading } = useAuthGuard();
  const shouldReduceMotion = useReducedMotion();
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState("");
  const [contract, setContract] = useState(null);

  const {
    register,
    handleSubmit,
    reset,
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

  const loadContract = useCallback(async () => {
    try {
      const data = await apiRequest(`/api/contracts/${contractId}`, { method: "GET" });
      setContract(data);
      reset({
        move_in_date: data.move_in_date?.split("T")[0] || "",
        expected_move_out: data.expected_move_out_date?.split("T")[0] || "",
        actual_move_out: data.actual_move_out_date?.split("T")[0] || "",
        deposit_amount: data.deposit_amount ?? "",
        monthly_rate: data.monthly_rate ?? "",
        status: data.status || "active",
        notes: data.notes || "",
      });
    } catch (error) {
      setApiError(error?.message || "Failed to load contract.");
    }
  }, [contractId, reset]);

  useEffect(() => {
    if (authLoading || !currentUser) return;
    const fetchData = async () => {
      try {
        if (contractId) await loadContract();
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [authLoading, currentUser, contractId, loadContract]);

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
      const payload = {
        expected_move_out: values.expected_move_out || null,
        actual_move_out: values.actual_move_out || null,
        deposit_amount: depositParsed,
        monthly_rate: monthlyParsed,
        status: values.status,
        notes: values.notes || null,
      };

      await apiRequest(`/api/contracts/${contractId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      router.push(`/contracts/${contractId}`);
    } catch (error) {
      setApiError(flattenApiErrors(error));
    }
  };

  if (authLoading || loading) {
    return (
      <AppMain>
        <Spinner label="Accessing agreement record…" />
      </AppMain>
    );
  }

  const readOnly = !canManageContracts(currentUser);
  const recordLabel = contract ? `#CONTRACT-${contract.contract_id}` : "Agreement";

  const bedLabel =
    contract?.bed_space?.bed_label || contract?.bedSpace?.bed_label || "—";

  return (
    <AppMain>
      <motion.div
        className="mx-auto mt-8 w-full max-w-4xl space-y-6"
        initial={shouldReduceMotion ? false : pageVariants.initial}
        animate={shouldReduceMotion ? false : pageVariants.animate}
        transition={shouldReduceMotion ? { duration: 0 } : pageVariants.transition}
      >
        <PageHeader
          title="Update Details"
          subtitle={
            contract
              ? `Edit operational lease fields for active agreement ${recordLabel}.`
              : "Edit contract registry record."
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
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => router.push(`/contracts/${contractId}`)}
                className="inline-flex size-11 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-500 transition-colors hover:bg-stone-50"
                aria-label="Back to Agreement Profile"
              >
                <ArrowLeft size={18} aria-hidden />
              </button>
              <div className="border-l border-stone-200 pl-3">
                <UserRoleBadge username={currentUser?.username} roleName={currentUser?.role?.role_name} />
              </div>
            </div>
          }
        />

        <div className="space-y-6">
        {readOnly && (
          <Alert variant="warning" title="Restricted Access">
            You do not have administrative clearance to update agreement terms.
          </Alert>
        )}

        {apiError && (
          <Alert variant="error" title="Submission Error">
            {apiError}
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
            <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/50 px-8 py-5">
              <div className="flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded-lg bg-stone-100 text-stone-600 shadow-sm">
                  <RefreshCw size={16} aria-hidden />
                </div>
                <h2 className="hs-strip-title text-stone-400 tracking-widest uppercase font-black text-sm">Basic Information</h2>
              </div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-teal-600">
                {recordLabel}
              </p>
            </div>
            <div className="grid gap-6 p-8 sm:grid-cols-2">
              <Field label="Linked Resident (read-only)">
                <div className="flex h-11 items-center rounded-xl border border-stone-100 bg-stone-50/50 px-4 text-sm font-bold text-stone-700">
                  {contract?.tenant ? formatTenantDirectoryName(contract.tenant) : "—"}
                </div>
              </Field>
              <Field label="Inventory Assignment (read-only)">
                <div className="flex h-11 items-center rounded-xl border border-stone-100 bg-stone-50/50 px-4 text-sm font-bold text-stone-700">
                  {contract?.room?.room_code ? `${contract.room.room_code} · ${bedLabel}` : "—"}
                </div>
              </Field>
            </div>
          </Card>

          <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
            <div className="flex items-center gap-3 border-b border-stone-100 bg-stone-50/50 px-8 py-5">
              <div className="flex size-8 items-center justify-center rounded-lg bg-teal-50 text-teal-600 shadow-sm">
                <Calendar size={16} aria-hidden />
              </div>
              <h2 className="hs-strip-title text-stone-400 tracking-widest uppercase font-black text-sm">Lease Terms</h2>
            </div>
            <div className="space-y-8 p-8">
              <div className="grid gap-6 sm:grid-cols-2">
                <Field label="Inception Date (read-only)">
                  <Input
                    disabled
                    className="!h-11 border-stone-100 bg-stone-50/50 font-bold"
                    value={contract?.move_in_date?.split("T")[0] || ""}
                    readOnly
                  />
                </Field>
                <Field label="Operational Status" error={errors.status?.message}>
                  <Select
                    disabled={readOnly}
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
                <Field label="Expected Move-Out" error={errors.expected_move_out?.message}>
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
                <Field label="Actual Move-Out" error={errors.actual_move_out?.message}>
                  <Input
                    type="date"
                    disabled={readOnly}
                    className="!h-11 border-stone-200"
                    hasError={Boolean(errors.actual_move_out)}
                    {...register("actual_move_out")}
                  />
                </Field>
              </div>
            </div>
          </Card>

          <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
            <div className="flex items-center gap-3 border-b border-stone-100 bg-stone-50/50 px-8 py-5">
              <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 shadow-sm">
                <Wallet size={16} aria-hidden />
              </div>
              <h2 className="hs-strip-title text-stone-400 tracking-widest uppercase font-black text-sm">Financial Terms</h2>
            </div>
            <div className="grid gap-6 p-8 sm:grid-cols-2">
              <Field label="Lease Monthly Rate" required error={errors.monthly_rate?.message}>
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
          </Card>

          <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
            <div className="border-b border-stone-100 bg-stone-50/50 px-8 py-5">
              <h2 className="hs-strip-title text-stone-400 tracking-widest uppercase font-black text-sm">Notes</h2>
            </div>
            <div className="p-8">
              <Field label="Internal Protocol Notes">
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
            </div>
          </Card>

          <div className="flex flex-col-reverse gap-3 pt-6 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push(`/contracts/${contractId}`)}
              className="!h-12 rounded-xl px-10 text-[10px] font-bold uppercase tracking-widest"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={isSubmitting}
              disabled={readOnly || isSubmitting}
              className="!h-12 min-w-[180px] rounded-xl bg-teal-600 text-[10px] font-black uppercase tracking-widest shadow-xl shadow-teal-900/20 hover:bg-teal-700 active:scale-95"
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
    </AppMain>
  );
}
