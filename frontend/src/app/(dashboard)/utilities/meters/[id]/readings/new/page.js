'use client';

import { useMemo, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import useSWR, { mutate } from 'swr';
import { FileMinus, AlertTriangle } from 'lucide-react';
import { fetcher, apiRequest } from '@/lib/api';
import { canManageMeters } from '@/lib/auth';
import { flattenApiErrors } from '@/lib/errors';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { useToasts } from '@/context/ToastContext';
import Alert from '@/components/ui/Alert';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
import Button from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, Input } from '@/components/ui/Fields';
import StandardPage from '@/components/ui/StandardPage';
import { SkeletonDetailPage } from '@/components/ui/Skeleton';
import { formatDateString } from '@/lib/formatters';

/**
 * Meter Reading Entry Form — /admin/meters/[id]/readings/new
 *
 * FR: FR-026
 * BR: BR-MET-004, BR-MET-005
 * TC: TC-04
 * API: POST /api/meters/[id]/readings
 */

export default function NewMeterReadingPage({ params }) {
  const unwrappedParams = use(params);
  const meterId = unwrappedParams.id;
  const router = useRouter();

  const { user: currentUser, authLoading, isUnauthorized } = useAuthGuard();
  const { showToast } = useToasts();
  const canAccess = useMemo(() => canManageMeters(currentUser), [currentUser]);

  const { data: meter, error: meterError } = useSWR(
    !authLoading && currentUser && canAccess ? `/api/meters/${meterId}` : null,
    fetcher
  );

  const loading = (!meter && !meterError) || authLoading;

  const latestReading = useMemo(() => {
    if (!meter || !meter.readings || meter.readings.length === 0) return null;
    return [...meter.readings].sort(
      (a, b) => new Date(b.reading_date) - new Date(a.reading_date)
    )[0];
  }, [meter]);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      reading_date: new Date().toISOString().split('T')[0],
      reading_value: '',
      is_rollover: false,
      rollover_reason: '', // Kept in state as required by rules
    },
  });

  const isRollover = useWatch({ control, name: 'is_rollover' });
  const readingValue = useWatch({ control, name: 'reading_value' });

  const onSubmit = async (values) => {
    // Client-Side Monotonicity Enforcement
    if (
      !values.is_rollover &&
      latestReading &&
      parseFloat(values.reading_value) < parseFloat(latestReading.reading_value)
    ) {
      showToast(
        'Reading value cannot be lower than the previous reading unless flagged as a rollover. Check the dial rollover box if the hardware reset.',
        'error'
      );
      return;
    }

    try {
      await apiRequest(`/api/meters/${meterId}/readings`, {
        method: 'POST',
        body: JSON.stringify({
          reading_date: values.reading_date,
          reading_value: parseFloat(values.reading_value),
          is_rollover: values.is_rollover,
          // Sending note in payload for potential forensic audit trail
          rollover_reason: values.is_rollover ? values.rollover_reason : null,
        }),
      });

      // Invalidate the meter detail to show the new reading
      mutate(`/api/meters/${meterId}`);

      router.push(`/admin/meters/${meterId}`);
    } catch (err) {
      showToast(flattenApiErrors(err), 'error');
    }
  };

  if (isUnauthorized) return null;

  return (
    <StandardPage
      title="Record Reading"
      subtitle="Record a new meter reading to update usage data."
      breadcrumbs={
        <Breadcrumbs
          items={[
            { label: 'Administration' },
            { label: 'Meters', href: '/admin/meters' },
            {
              label: meter ? meter.serial_number : 'Meter',
              href: `/admin/meters/${meterId}`,
            },
            { label: 'Record Reading' },
          ]}
        />
      }
      loading={loading}
      skeleton={<SkeletonDetailPage />}
    >
      <div className="mx-auto w-full max-w-4xl space-y-6">
        {viewDenied && (
          <Alert variant="error" title="Access restricted">
            You do not have permission to record meter readings.
          </Alert>
        )}

        {meterError && !viewDenied && (
          <Alert variant="error" title="Meter details unavailable">
            Could not retrieve the meter profile.
          </Alert>
        )}

        {!viewDenied && meter && (
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-6"
            noValidate
          >
            <Card className="overflow-hidden rounded-2xl border-stone-200 !p-0 shadow-sm">
              <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/50 px-8 py-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-600 shadow-inner">
                    <FileMinus size={16} strokeWidth={2.5} />
                  </div>
                  <div>
                    <h2 className="hs-strip-title text-[10px] uppercase font-black tracking-[0.2em] text-stone-900">
                      Record Reading
                    </h2>
                    <p className="text-[10px] font-mono font-bold text-stone-400 mt-1 tracking-widest uppercase">
                      Serial: {meter.serial_number}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-8 space-y-8">
                {/* Previous Reading Hint Display */}
                {latestReading ? (
                  <div className="rounded-xl border border-teal-100 bg-teal-50/50 p-5">
                    <div className="text-[10px] font-black uppercase tracking-widest text-teal-800/60 mb-1">
                      Last Recorded Baseline
                    </div>
                    <div className="font-mono text-sm font-bold text-teal-900 tabular-nums">
                      {Number(latestReading.reading_value).toFixed(2)}{' '}
                      {meter.utility?.unit_of_measurement}
                      <span className="text-teal-600/70 font-medium ml-2 text-xs">
                        on {formatDateString(latestReading.reading_date)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-stone-200 bg-stone-50 p-5">
                    <div className="text-[10px] font-black uppercase tracking-widest text-stone-500 mb-1">
                      Initial Reading
                    </div>
                    <div className="text-sm font-medium text-stone-600">
                      No previous readings found. This entry will establish the
                      baseline.
                    </div>
                  </div>
                )}

                <div className="grid gap-6 md:grid-cols-2">
                  <Field
                    label="Reading Date"
                    required
                    error={errors.reading_date?.message}
                  >
                    <Input
                      type="date"
                      className="!h-12 border-stone-200 font-bold focus:border-teal-500/50"
                      hasError={Boolean(errors.reading_date)}
                      {...register('reading_date', {
                        required: 'Date is required.',
                      })}
                    />
                  </Field>

                  <Field
                    label={`Reading Value (${meter.utility?.unit_of_measurement || 'Units'})`}
                    required
                    error={errors.reading_value?.message}
                  >
                    <Input
                      type="number"
                      step="0.0001"
                      min="0"
                      placeholder="0.0000"
                      className="!h-12 border-stone-200 font-bold focus:border-teal-500/50 font-mono tracking-wider tabular-nums"
                      hasError={Boolean(errors.reading_value)}
                      {...register('reading_value', {
                        required: 'Measurement value is required.',
                        min: {
                          value: 0,
                          message: 'Reading cannot be negative.',
                        },
                      })}
                    />
                  </Field>

                  {/* Non-regressive context feedback */}
                  {!isRollover && latestReading && readingValue !== '' && (
                    <div className="md:col-span-2">
                      {parseFloat(readingValue) <
                        parseFloat(latestReading.reading_value) && (
                        <p className="text-xs font-bold text-rose-600 mt-1 flex items-center gap-1.5">
                          <AlertTriangle size={12} />
                          Warning: Value is lower than previous reading. This
                          will be rejected unless marked as a rollover.
                        </p>
                      )}
                    </div>
                  )}

                  <div className="md:col-span-2 pt-4 border-t border-stone-100">
                    <label className="flex items-start gap-4 p-4 rounded-xl border border-stone-200 hover:border-stone-300 transition-colors bg-white cursor-pointer select-none">
                      <div className="pt-0.5">
                        <input
                          type="checkbox"
                          className="w-5 h-5 rounded border-stone-300 text-teal-600 focus:ring-teal-600"
                          {...register('is_rollover')}
                        />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-stone-900">
                          Meter Reset or Rollover
                        </div>
                        <div className="text-xs text-stone-500 mt-1 font-medium leading-relaxed">
                          Check this if the meter display has rolled past its
                          maximum capacity or if the meter was replaced.
                        </div>
                      </div>
                    </label>
                  </div>

                  {isRollover && (
                    <div className="md:col-span-2 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                      <Alert variant="warning" title="Validation Bypass Active">
                        You are skipping the check that prevents lower values
                        from being entered. This action will be recorded in the
                        audit history.
                      </Alert>

                      <Field
                        label="Rollover Reason"
                        required
                        error={errors.rollover_reason?.message}
                      >
                        <Input
                          placeholder="Provide justification for bypass (e.g., 'Dial rolled over 99999', 'Meter swapped')"
                          className="!h-12 border-stone-200 font-bold focus:border-amber-500/50"
                          hasError={Boolean(errors.rollover_reason)}
                          {...register('rollover_reason', {
                            required: isRollover
                              ? 'A justification is strictly required for rollover events.'
                              : false,
                          })}
                        />
                      </Field>
                    </div>
                  )}
                </div>
              </div>
            </Card>

            <div className="flex flex-col-reverse gap-3 pt-6 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                onClick={() => router.push(`/admin/meters/${meterId}`)}
                className="!h-12 w-full rounded-xl sm:w-auto px-8"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={isSubmitting}
                className="!h-12 w-full rounded-xl bg-teal-600 px-10 text-[11px] font-black uppercase tracking-widest text-white shadow-lg shadow-teal-900/10 hover:bg-teal-700 sm:w-auto"
              >
                Submit Reading
              </Button>
            </div>
          </form>
        )}
      </div>
    </StandardPage>
  );
}
