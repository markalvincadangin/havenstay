'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { Zap, Ruler } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { canManageUsers } from '@/lib/auth';
import { applyServerFieldErrors } from '@/lib/forms';
import { parseMoneyInput } from '@/lib/formatters';
import Alert from '@/components/ui/Alert';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
import Button from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Fields';
import Link from 'next/link';
import StandardPage from '@/components/ui/StandardPage';
import { FormSection } from '@/components/ui/FormSection';
import PageHeaderActions from '@/components/ui/PageHeaderActions';
import { useAuth } from '@/context/AuthContext';
import { useToasts } from '@/context/ToastContext';
import { useUnsavedChangesWarning } from '@/hooks/useUnsavedChangesWarning';

export default function RegisterUtilityPage() {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const { showToast } = useToasts();

  const [scannedDuplicate, setScannedDuplicate] = useState(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({
    defaultValues: {
      name: '',
      unit_of_measurement: '',
      initial_base_rate: '',
      effective_from: new Date().toISOString().split('T')[0],
    },
  });

  useUnsavedChangesWarning(isDirty && !isSubmitting);

  const checkUniqueness = async (value) => {
    if (!value || value.trim().length < 3) {
      setScannedDuplicate(null);
      return;
    }
    try {
      const results = await apiRequest(
        `/api/utilities?q=${encodeURIComponent(value.trim())}`
      );
      // Since it's usually a small list, we check local match
      const list = Array.isArray(results) ? results : results?.data || [];
      const match = list.find(
        (u) => u.name?.toLowerCase().trim() === value.trim().toLowerCase()
      );
      setScannedDuplicate(match ? match.utility_id : null);
    } catch (e) {
      // Ignore
    }
  };

  const onSubmit = async (values) => {
    if (!canManageUsers(currentUser)) return;
    try {
      const response = await apiRequest('/api/utilities', {
        method: 'POST',
        body: JSON.stringify({
          name: values.name,
          unit_of_measurement: values.unit_of_measurement,
          initial_base_rate: parseMoneyInput(values.initial_base_rate),
          effective_from: values.effective_from,
        }),
      });
      const utilityId = response?.utility_id || response?.id;
      showToast(`${values.name} utility registered successfully.`, 'success');
      if (utilityId) {
        router.push(`/utilities/${utilityId}`);
      } else {
        router.push('/utilities');
      }
    } catch (error) {
      applyServerFieldErrors(error, setError, { showToast });
    }
  };

  const readOnly = !canManageUsers(currentUser);

  return (
    <StandardPage
      title="Register Utility"
      subtitle="Add a new billable utility and set its initial rate."
      breadcrumbs={
        <Breadcrumbs
          items={[
            { label: 'Utilities', href: '/utilities' },
            { label: 'Register Utility' },
          ]}
        />
      }
      actions={
        <PageHeaderActions
          backHref="/utilities"
          backLabel="Back to Catalog"
          user={currentUser}
        />
      }
    >
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="mx-auto w-full max-w-4xl space-y-6"
        noValidate
      >
        {readOnly && (
          <Alert variant="warning" title="Access restricted">
            Modifying the central utility catalog is restricted to
            Administrators to maintain financial integrity.
          </Alert>
        )}
        <FormSection
          title="Utility Details"
          icon={Zap}
          rightElement={
            <span className="text-[10px] font-bold uppercase tracking-widest text-stone-300">
              Required
            </span>
          }
        >
          <div className="space-y-6">
            <div className="grid gap-6 sm:grid-cols-2">
              <Field
                label="Utility Name"
                required
                error={errors.name?.message}
                warning={
                  scannedDuplicate
                    ? 'A utility with this name already exists in the catalog.'
                    : null
                }
                helpText="Common identifier (e.g., Internet, Power, Cleaning)."
              >
                <Input
                  autoFocus
                  placeholder="e.g. Internet"
                  className="!h-11 border-stone-200 focus:border-teal-500/50 font-bold"
                  disabled={readOnly}
                  {...register('name', {
                    required: 'Utility name is required.',
                  })}
                  onBlur={(e) => checkUniqueness(e.target.value)}
                  hasError={Boolean(errors.name || scannedDuplicate)}
                />
              </Field>
              <Field
                label="Unit of Measurement"
                required
                error={errors.unit_of_measurement?.message}
                helpText="The base metric calculated on the ledger (e.g. kWh, m3, Month)."
              >
                <Input
                  placeholder="e.g. Month"
                  className="!h-11 border-stone-200 focus:border-teal-500/50"
                  disabled={readOnly}
                  {...register('unit_of_measurement', {
                    required: 'Please specify a unit (e.g., kWh).',
                  })}
                />
              </Field>
            </div>
          </div>
        </FormSection>
        <FormSection
          title="Initial Rate Schedule"
          icon={Ruler}
          rightElement={
            <span className="text-[10px] font-bold uppercase tracking-widest text-stone-300">
              Required
            </span>
          }
        >
          <div className="space-y-6">
            <p className="text-xs text-stone-500 max-w-2xl">
              To prevent un-billable gaps in the financial ledger, all newly
              registered utilities require a baseline financial rate from day
              one. You can adjust this later through scheduled changes.
            </p>
            <div className="grid gap-6 sm:grid-cols-2 border-t border-dashed border-stone-200 pt-6">
              <Field
                label="Base Rate"
                required
                error={errors.initial_base_rate?.message}
              >
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  prefix="₱"
                  className="!h-11 border-stone-200 font-mono focus:border-teal-500/50 tabular-nums"
                  disabled={readOnly}
                  {...register('initial_base_rate', {
                    required: 'An initial base rate is required.',
                  })}
                />
              </Field>
              <Field
                label="Effective Start Date"
                required
                error={errors.effective_from?.message}
              >
                <Input
                  type="date"
                  className="!h-11 border-stone-200 font-bold focus:border-teal-500/50"
                  disabled={readOnly}
                  {...register('effective_from', {
                    required: 'Start date is required.',
                  })}
                />
              </Field>
            </div>
          </div>
        </FormSection>
        <div className="flex flex-col-reverse gap-3 pt-8 sm:flex-row sm:justify-end">
          <Link
            href="/utilities"
            className="flex h-12 items-center justify-center rounded-xl border border-stone-200 px-10 text-xs font-black uppercase tracking-widest text-stone-500 transition-all hover:bg-stone-50 active:scale-95"
          >
            Cancel
          </Link>
          <Button
            type="submit"
            variant="primary"
            loading={isSubmitting}
            disabled={readOnly || isSubmitting || scannedDuplicate}
            className="h-12 rounded-xl px-12 text-xs font-black uppercase tracking-widest shadow-lg shadow-teal-900/10 active:scale-95 transition-all bg-teal-600 hover:bg-teal-700"
          >
            Register Utility
          </Button>
        </div>
      </form>
    </StandardPage>
  );
}
