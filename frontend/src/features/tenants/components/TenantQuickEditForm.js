'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Phone, ShieldAlert, User } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { applyServerFieldErrors } from '@/lib/forms';
import { Field, Input } from '@/components/ui/Fields';
import { QuickEditFormShell } from '@/components/ui/QuickEditFormShell';
import { useToasts } from '@/context/ToastContext';
import ResourceIdCell from '@/components/ui/ResourceIdCell';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatTenantDirectoryName } from '@/lib/formatters';

const PH_MOBILE_REGEX = /^(09\d{9}|(\+639)\d{9})$/;

export function TenantQuickEditForm({ tenant, onSuccess, onCancel }) {
  const { showToast } = useToasts();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      first_name: tenant.first_name || '',
      last_name: tenant.last_name || '',
      contact_number: tenant.contact_number || '',
      email: tenant.email || '',
      emergency_contact_name: tenant.emergency_contact_name || '',
      emergency_contact_number: tenant.emergency_contact_number || '',
    },
  });

  const onSubmit = async (values) => {
    try {
      await apiRequest(`/api/tenants/${tenant.tenant_id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...values,
          first_name: values.first_name?.trim(),
          last_name: values.last_name?.trim(),
          contact_number: values.contact_number?.trim(),
          email: values.email?.trim() || null,
          emergency_contact_name: values.emergency_contact_name?.trim(),
          emergency_contact_number: values.emergency_contact_number?.trim(),
        }),
      });

      showToast(
        `Profile updated for ${values.first_name} ${values.last_name}.`,
        'success'
      );
      onSuccess();
    } catch (error) {
      applyServerFieldErrors(error, setError, { showToast });
    }
  };

  return (
    <QuickEditFormShell
      onSubmit={handleSubmit(onSubmit)}
      isSubmitting={isSubmitting}
      onCancel={onCancel}
    >
      {/* Forensic Anchor Header */}
      <div className="mb-8 border-b border-stone-100 bg-stone-50/50 -mx-8 -mt-8 p-8 flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">
            Resource context
          </p>
          <div className="flex items-center gap-3">
            <h4 className="text-sm font-bold text-stone-900 truncate">
              {formatTenantDirectoryName(tenant)}
            </h4>
            <ResourceIdCell id={tenant.tenant_id} type="tenant" />
          </div>
        </div>
        <StatusBadge size="xs">{tenant.status || 'active'}</StatusBadge>
      </div>

      <div>
        <h3 className="hs-strip-title text-[10px] uppercase tracking-[0.2em] text-stone-400 mb-4 flex items-center gap-2">
          <User size={12} /> Identity Profile
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First Name" required error={errors.first_name?.message}>
            <Input
              className="!h-11 border-stone-200"
              {...register('first_name', {
                required: 'First name is required.',
              })}
            />
          </Field>
          <Field label="Last Name" required error={errors.last_name?.message}>
            <Input
              className="!h-11 border-stone-200"
              {...register('last_name', { required: 'Last name is required.' })}
            />
          </Field>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="hs-strip-title text-[10px] uppercase tracking-[0.2em] text-stone-400 mb-4 flex items-center gap-2">
          <Phone size={12} /> Contact Details
        </h3>
        <div className="space-y-4">
          <Field
            label="Contact Number"
            required
            error={errors.contact_number?.message}
          >
            <Input
              className="!h-11 font-mono tabular-nums border-stone-200"
              {...register('contact_number', {
                required: 'Mobile number is required for residency records.',
                pattern: {
                  value: PH_MOBILE_REGEX,
                  message: 'Use a valid local PH mobile format.',
                },
              })}
            />
          </Field>
          <Field label="Email Address" error={errors.email?.message}>
            <Input
              type="email"
              className="!h-11 border-stone-200"
              {...register('email')}
            />
          </Field>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="hs-strip-title text-[10px] uppercase tracking-[0.2em] text-stone-400 mb-4 flex items-center gap-2">
          <ShieldAlert size={12} /> Emergency Contact
        </h3>
        <div className="space-y-4">
          <Field
            label="Emergency Contact Name"
            required
            error={errors.emergency_contact_name?.message}
          >
            <Input
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
              className="!h-11 font-mono tabular-nums border-stone-200"
              {...register('emergency_contact_number', {
                required: 'Emergency phone number is required for safety.',
                pattern: {
                  value: PH_MOBILE_REGEX,
                  message: 'Use a valid local PH mobile format.',
                },
              })}
            />
          </Field>
        </div>
      </div>
    </QuickEditFormShell>
  );
}
