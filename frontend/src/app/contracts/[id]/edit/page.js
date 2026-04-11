"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, Calendar, RefreshCw, Wallet } from "lucide-react";

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
        <Spinner label="Loading agreement editor…" />
      </AppMain>
    );
  }

  const readOnly = !canManageContracts(currentUser);
  const recordTitle = contract ? `Contract #${contract.contract_id}` : "Contract";

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
          title="Update details"
          subtitle={
            contract
              ? `Edit lease fields for contract #CONTRACT-${contract.contract_id}.`
              : "Edit contract record."
          }
          breadcrumbs={
            <Breadcrumbs
              items={[
                { label: "Contract Registry", href: "/contracts" },
                { label: recordTitle, href: `/contracts/${contractId}` },
                { label: "Update" },
              ]}
            />
          }
          actions={
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => router.push(`/contracts/${contractId}`)}
                className="inline-flex size-11 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-500 transition-colors hover:bg-stone-50"
                aria-label="Back to contract profile"
                title="Back to profile"
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
        {readOnly ? (
          <Alert variant="warning" title="Restricted access">
            You do not have permission to edit contracts.
          </Alert>
        ) : null}

        {apiError ? (
          <Alert variant="error" title="Could not save changes">
            {apiError}
          </Alert>
        ) : null}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
            <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/50 px-8 py-5">
              <div className="flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded-lg bg-stone-100 text-stone-600 shadow-sm">
                  <RefreshCw size={16} aria-hidden />
                </div>
                <h2 className="hs-strip-title">Registry Reference</h2>
              </div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-tighter text-stone-400">
                #CONTRACT-{contractId}
              </p>
            </div>
            <div className="grid gap-6 p-8 sm:grid-cols-2">
              <Field label="Tenant (read-only)">
                <div className="flex h-11 items-center rounded-xl border border-stone-200 bg-stone-50 px-4 text-sm font-semibold text-stone-800">
                  {contract?.tenant
                    ? `${contract.tenant.last_name}, ${contract.tenant.first_name}`
                    : "—"}
                </div>
              </Field>
              <Field label="Room & bed (read-only)">
                <div className="flex h-11 items-center rounded-xl border border-stone-200 bg-stone-50 px-4 text-sm font-semibold text-stone-800">
                  {contract?.room?.room_code ? `${contract.room.room_code} / ${bedLabel}` : "—"}
                </div>
              </Field>
            </div>
          </Card>

          <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
            <div className="flex items-center gap-3 border-b border-stone-100 bg-stone-50/50 px-8 py-5">
              <div className="flex size-8 items-center justify-center rounded-lg bg-teal-50 text-teal-600 shadow-sm">
                <Calendar size={16} aria-hidden />
              </div>
              <h2 className="hs-strip-title">Lease Dates & Status</h2>
            </div>
            <div className="space-y-8 p-8">
              <div className="grid gap-6 sm:grid-cols-2">
                <Field label="Move-in (read-only)">
                  <Input
                    disabled
                    className="!h-11 border-stone-200 bg-stone-50"
                    value={contract?.move_in_date?.split("T")[0] || ""}
                    readOnly
                  />
                </Field>
                <Field label="Administrative status" error={errors.status?.message}>
                  <Select
                    disabled={readOnly}
                    className="!h-11 border-stone-200 font-semibold"
                    hasError={Boolean(errors.status)}
                    {...register("status")}
                  >
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="terminated">Terminated</option>
                  </Select>
                </Field>
              </div>
              <div className="grid gap-6 sm:grid-cols-2">
                <Field label="Expected move-out" error={errors.expected_move_out?.message}>
                  <Input
                    type="date"
                    disabled={readOnly}
                    className="!h-11 border-stone-200"
                    hasError={Boolean(errors.expected_move_out)}
                    {...register("expected_move_out", {
                      validate: (value) => {
                        if (!value) return true;
                        if (contract?.move_in_date && new Date(value) <= new Date(contract.move_in_date)) {
                          return "Must be after move-in date.";
                        }
                        return true;
                      },
                    })}
                  />
                </Field>
                <Field label="Actual move-out" error={errors.actual_move_out?.message}>
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
              <div className="flex size-8 items-center justify-center rounded-lg bg-teal-50 text-teal-600 shadow-sm">
                <Wallet size={16} aria-hidden />
              </div>
              <h2 className="hs-strip-title">Financial Terms</h2>
            </div>
            <div className="grid gap-6 p-8 sm:grid-cols-2">
              <Field label="Monthly rate" required error={errors.monthly_rate?.message}>
                <Input
                  type="number"
                  step="0.01"
                  disabled={readOnly}
                  className="!h-11 border-stone-200 tabular-nums"
                  hasError={Boolean(errors.monthly_rate)}
                  {...register("monthly_rate", {
                    required: "Monthly rate is required.",
                    min: { value: 500, message: "Min ₱500" },
                    max: { value: 100000, message: "Max ₱100,000" },
                  })}
                />
              </Field>
              <Field label="Deposit amount" required error={errors.deposit_amount?.message}>
                <Input
                  type="number"
                  step="0.01"
                  disabled={readOnly}
                  className="!h-11 border-stone-200 tabular-nums"
                  hasError={Boolean(errors.deposit_amount)}
                  {...register("deposit_amount", {
                    required: "Deposit is required.",
                    min: { value: 0, message: "Min ₱0" },
                    max: { value: 500000, message: "Max ₱500,000" },
                  })}
                />
              </Field>
            </div>
          </Card>

          <Card className="!p-0 overflow-hidden rounded-2xl border-stone-200 shadow-sm">
            <div className="border-b border-stone-100 bg-stone-50/50 px-8 py-5">
              <h2 className="hs-strip-title">Notes</h2>
            </div>
            <div className="p-8">
              <Field label="Agreement notes">
                <Textarea
                  rows={3}
                  disabled={readOnly}
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
              className="!h-11 rounded-xl px-8 text-[10px] font-bold uppercase tracking-widest"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={isSubmitting}
              disabled={readOnly || isSubmitting}
              className="!h-11 min-w-[160px] rounded-xl bg-teal-600 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-teal-900/10 hover:bg-teal-700"
            >
              Save changes
            </Button>
          </div>
        </form>
        </div>
      </motion.div>
    </AppMain>
  );
}
