'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { apiRequest } from '@/lib/api';
import { canManageTenants } from '@/lib/auth';
import { applyServerFieldErrors } from '@/lib/forms';
import { useUnsavedChangesWarning } from '@/hooks/useUnsavedChangesWarning';
import { useAuth } from '@/context/AuthContext';
import { useToasts } from '@/context/ToastContext';

import Alert from '@/components/ui/Alert';
import { Field, Input, Textarea } from '@/components/ui/Fields';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
import StandardPage from '@/components/ui/StandardPage';
import { SkeletonDetailPage } from '@/components/ui/Skeleton';
import { WizardFrame } from '@/components/ui/WizardFrame';
import Button from '@/components/ui/Button';

const PH_MOBILE_REGEX = /^(09\d{9}|(\+639)\d{9})$/;

export default function NewTenantPage() {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const { showToast } = useToasts();

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [existenceMatch, setExistenceMatch] = useState(null);
  const [isScanning, setIsScanning] = useState(false);

  const {
    register,
    trigger,
    setError,
    getValues,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({
    mode: 'onChange',
    defaultValues: {
      first_name: '',
      last_name: '',
      address: '',
      contact_number: '',
      email: '',
      emergency_contact_name: '',
      emergency_contact_number: '',
    },
  });

  useUnsavedChangesWarning(isDirty && !isSubmitting);

  const performExistenceScan = async () => {
    const vals = getValues();
    const hasMinData =
      (vals.first_name && vals.last_name) || vals.email || vals.contact_number;
    if (!hasMinData) {
      setExistenceMatch(null);
      return null;
    }

    setIsScanning(true);
    try {
      const result = await apiRequest('/api/tenants/existence-check', {
        method: 'POST',
        body: JSON.stringify({
          first_name: vals.first_name,
          last_name: vals.last_name,
          email: vals.email,
          contact_number: vals.contact_number,
        }),
      });
      const match = result?.data || result;
      setExistenceMatch(match?.exists ? match : null);
      return match;
    } catch (e) {
      return null;
    } finally {
      setIsScanning(false);
    }
  };

  const handleRestoreTenant = async (id) => {
    try {
      await apiRequest(`/api/tenants/${id}/restore`, { method: 'POST' });
      showToast('Tenant profile restored successfully.', 'success');
      router.push(`/tenants/${id}`);
    } catch (error) {
      showToast('Failed to restore tenant profile.', 'error');
    }
  };

  const validateStep = async (index) => {
    if (index === 0) {
      const ok = await trigger(['first_name', 'last_name', 'address']);
      if (ok) await performExistenceScan();
      return ok;
    }
    if (index === 1) {
      const ok = await trigger(['contact_number', 'email']);
      if (ok) {
        const match = await performExistenceScan();
        if (
          match?.exists &&
          (match.match_type === 'email' || match.match_type === 'phone')
        ) {
          return false;
        }
      }
      return ok;
    }
    return true;
  };

  const isStepInvalid = useMemo(() => {
    if (currentStepIndex === 0) {
      return !!(errors.first_name || errors.last_name || errors.address);
    }
    if (currentStepIndex === 1) {
      const hardMatch =
        existenceMatch?.exists &&
        (existenceMatch.match_type === 'email' ||
          existenceMatch.match_type === 'phone');
      return !!(errors.email || errors.contact_number || hardMatch);
    }
    if (currentStepIndex === 2) {
      return !!(
        errors.emergency_contact_name || errors.emergency_contact_number
      );
    }
    return false;
  }, [currentStepIndex, errors, existenceMatch]);

  const onNext = async () => {
    const isValid = await validateStep(currentStepIndex);
    if (isValid) {
      setCurrentStepIndex((prev) => Math.min(prev + 1, 2));
    }
  };

  const onBack = () => {
    setCurrentStepIndex((prev) => Math.max(prev - 1, 0));
  };

  const onSubmitTenant = async (shouldCreateLease) => {
    const isValid = await trigger();
    if (!isValid) return;

    if (!canManageTenants(currentUser)) return;

    const values = getValues();
    try {
      const response = await apiRequest('/api/tenants', {
        method: 'POST',
        body: JSON.stringify({
          ...values,
          first_name: values.first_name?.trim(),
          last_name: values.last_name?.trim(),
          contact_number: values.contact_number?.trim(),
          email: values.email?.trim() || null,
          emergency_contact_name: values.emergency_contact_name?.trim(),
          emergency_contact_number: values.emergency_contact_number?.trim(),
          address: values.address?.trim(),
        }),
      });

      const tenantId = response?.tenant?.tenant_id || response?.tenant_id;
      if (tenantId) {
        showToast(
          `Tenant ${values.first_name} registered successfully.`,
          'success'
        );
        if (shouldCreateLease === 'lease') {
          router.push(`/contracts/new?tenant_id=${tenantId}`);
        } else {
          router.push(`/tenants/${tenantId}`);
        }
      }
    } catch (error) {
      applyServerFieldErrors(error, setError, { showToast });
    }
  };

  const readOnly = useMemo(() => !canManageTenants(currentUser), [currentUser]);

  const wizardSteps = [
    { label: 'Identity Profile' },
    { label: 'Communications' },
    { label: 'Emergency & Save' },
  ];

  return (
    <StandardPage
      title="Register Tenant"
      subtitle="Step-by-step registration for new tenants."
      skeleton={<SkeletonDetailPage />}
      breadcrumbs={
        <Breadcrumbs
          items={[
            { label: 'Tenant Directory', href: '/tenants' },
            { label: 'Register Tenant' },
          ]}
        />
      }
    >
      {readOnly && (
        <Alert
          variant="warning"
          title="Restricted"
          className="max-w-4xl mx-auto mb-6"
        >
          Read-only mode. Registration is disabled.
        </Alert>
      )}

      <WizardFrame
        title="Tenant Onboarding"
        steps={wizardSteps}
        currentStepIndex={currentStepIndex}
        onNext={onNext}
        onBack={onBack}
        onCancel={() => router.push('/tenants')}
        onSubmit={() => onSubmitTenant('lease')}
        isSubmitting={isSubmitting}
        isNextDisabled={isStepInvalid || isScanning || readOnly}
        isSubmitDisabled={isStepInvalid || isScanning || readOnly}
        nextLabel="Next Step"
        submitLabel="Register & Create Lease"
        cancelLabel="Discard Changes"
        extraActions={
          currentStepIndex === 2 && (
            <Button
              variant="outline"
              size="lg"
              onClick={() => onSubmitTenant('view')}
              disabled={readOnly || isSubmitting || isStepInvalid || isScanning}
              className="rounded-xl text-xs font-black uppercase tracking-widest text-stone-500"
            >
              Register Tenant Only
            </Button>
          )
        }
      >
        <div className="space-y-6">
          {currentStepIndex === 0 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="grid gap-6 sm:grid-cols-2">
                <Field
                  label="First Name"
                  required
                  error={errors.first_name?.message}
                >
                  <Input
                    autoFocus
                    disabled={readOnly}
                    hasError={Boolean(errors.first_name)}
                    placeholder="Juan"
                    className="!h-11 border-stone-200"
                    {...register('first_name', {
                      required: 'First name is required.',
                    })}
                    onBlur={performExistenceScan}
                  />
                </Field>
                <Field
                  label="Last Name"
                  required
                  error={errors.last_name?.message}
                >
                  <Input
                    disabled={readOnly}
                    hasError={Boolean(errors.last_name)}
                    placeholder="Dela Cruz"
                    className="!h-11 border-stone-200"
                    {...register('last_name', {
                      required: 'Last name is required.',
                    })}
                    onBlur={performExistenceScan}
                  />
                </Field>
              </div>

              {existenceMatch?.match_type === 'name' && (
                <Alert variant="warning" title="Potential Duplicate Detected">
                  <p className="text-sm">
                    A profile with the name{' '}
                    <strong>
                      {getValues().first_name} {getValues().last_name}
                    </strong>{' '}
                    already exists in the registry. If this is the same person,
                    consider using the existing profile to avoid data
                    fragmentation.
                  </p>
                  <div className="mt-3 flex gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        router.push(`/tenants/${existenceMatch.tenant_id}`)
                      }
                      className="h-8 text-[10px] uppercase tracking-wider font-bold"
                    >
                      View Profile
                    </Button>
                    {existenceMatch.status === 'archived' && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() =>
                          handleRestoreTenant(existenceMatch.tenant_id)
                        }
                        className="h-8 text-[10px] uppercase tracking-wider font-bold"
                      >
                        Restore Profile
                      </Button>
                    )}
                  </div>
                </Alert>
              )}
              <Field
                label="Home Address"
                required
                error={errors.address?.message}
              >
                <Textarea
                  rows={3}
                  disabled={readOnly}
                  hasError={Boolean(errors.address)}
                  className="border-stone-200"
                  {...register('address', {
                    required: 'Please provide a home address.',
                  })}
                />
              </Field>
            </div>
          )}

          {currentStepIndex === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="grid gap-6 sm:grid-cols-2">
                <Field
                  label="Contact Number"
                  required
                  error={
                    errors.contact_number?.message ||
                    (existenceMatch?.match_type === 'phone'
                      ? 'This number is already registered.'
                      : null)
                  }
                >
                  <Input
                    autoFocus
                    disabled={readOnly}
                    hasError={Boolean(
                      errors.contact_number ||
                      existenceMatch?.match_type === 'phone'
                    )}
                    className="!h-11 font-mono tabular-nums border-stone-200"
                    {...register('contact_number', {
                      required: 'Contact number is required.',
                      pattern: {
                        value: PH_MOBILE_REGEX,
                        message: 'Please enter a valid PH mobile number.',
                      },
                    })}
                    onBlur={performExistenceScan}
                  />
                </Field>
                <Field
                  label="Email Address"
                  required
                  error={
                    errors.email?.message ||
                    (existenceMatch?.match_type === 'email'
                      ? 'This email is already in use.'
                      : null)
                  }
                >
                  <Input
                    disabled={readOnly}
                    hasError={Boolean(
                      errors.email || existenceMatch?.match_type === 'email'
                    )}
                    type="email"
                    placeholder="juan@example.ph"
                    className="!h-11 border-stone-200 gap-x-6"
                    {...register('email', {
                      required: 'Email address is required.',
                      pattern: {
                        value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                        message: 'Please enter a valid email address.',
                      },
                    })}
                    onBlur={performExistenceScan}
                  />
                </Field>
              </div>

              {existenceMatch?.exists &&
                (existenceMatch.match_type === 'email' ||
                  existenceMatch.match_type === 'phone') && (
                  <Alert variant="error" title="Hard Duplicate Blocked">
                    <p className="text-sm">
                      The{' '}
                      <strong>
                        {existenceMatch.match_type === 'email'
                          ? 'email address'
                          : 'contact number'}
                      </strong>{' '}
                      provided is already associated with an{' '}
                      {existenceMatch.status === 'archived'
                        ? 'archived'
                        : 'active'}{' '}
                      profile. Duplicate tenant profiles are not allowed.
                    </p>
                    <div className="mt-3 flex gap-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          router.push(`/tenants/${existenceMatch.tenant_id}`)
                        }
                        className="h-8 text-[10px] uppercase tracking-wider font-bold"
                      >
                        View Existing Profile
                      </Button>
                      {existenceMatch.status === 'archived' && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() =>
                            handleRestoreTenant(existenceMatch.tenant_id)
                          }
                          className="h-8 text-[10px] uppercase tracking-wider font-bold"
                        >
                          Restore & Edit Profile
                        </Button>
                      )}
                    </div>
                  </Alert>
                )}
            </div>
          )}

          {currentStepIndex === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="grid gap-6 sm:grid-cols-2">
                <Field
                  label="Emergency Contact Name"
                  required
                  error={errors.emergency_contact_name?.message}
                >
                  <Input
                    autoFocus
                    disabled={readOnly}
                    hasError={Boolean(errors.emergency_contact_name)}
                    className="!h-11 border-stone-200"
                    {...register('emergency_contact_name', {
                      required: 'Emergency contact name is required.',
                    })}
                  />
                </Field>
                <Field
                  label="Emergency Number"
                  required
                  error={errors.emergency_contact_number?.message}
                >
                  <Input
                    disabled={readOnly}
                    hasError={Boolean(errors.emergency_contact_number)}
                    className="!h-11 font-mono tabular-nums border-stone-200"
                    {...register('emergency_contact_number', {
                      required:
                        'Please provide a valid emergency contact number.',
                      pattern: {
                        value: PH_MOBILE_REGEX,
                        message: 'Invalid format',
                      },
                    })}
                  />
                </Field>
              </div>
            </div>
          )}
        </div>
      </WizardFrame>
    </StandardPage>
  );
}
