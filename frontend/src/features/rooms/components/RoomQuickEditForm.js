'use client';
import { useState } from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { DoorOpen, ShieldCheck, Trash2, Plus, Info } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { canManageRooms } from '@/lib/auth';
import { applyServerFieldErrors } from '@/lib/forms';
import { useToasts } from '@/context/ToastContext';
import { parseMoneyInput } from '@/lib/formatters';
import { Field, Input, Select, Textarea } from '@/components/ui/Fields';
import { QuickEditFormShell } from '@/components/ui/QuickEditFormShell';
import { ROOM_TYPE_LABELS } from '@/lib/constants';
import Button from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import ResourceIdCell from '@/components/ui/ResourceIdCell';
import RecordStateAlert from '@/components/ui/RecordStateAlert';
import { ROOM_STATUS_LABELS } from '@/lib/constants';
export function RoomQuickEditForm({ room, currentUser, onSuccess, onCancel }) {
  const { showToast } = useToasts();
  const readOnly = !canManageRooms(currentUser);

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      room_code: room.room_code || '',
      room_type: room.room_type || 'solo',
      capacity: String(room.capacity || '1'),
      monthly_rate: String(room.monthly_rate || ''),
      amenities: room.amenities || '',
      description: room.description || '',
      bed_spaces: (room.bed_spaces || []).map((b) => ({
        bed_space_id: b.bed_space_id,
        bed_label: b.bed_label,
        status: b.status || 'vacant',
        is_occupied: b.status === 'occupied' || !!b.active_contract,
      })),
      is_metered: !!room.is_metered,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'bed_spaces',
  });

  const roomType = useWatch({ control, name: 'room_type' });

  if (room.status === 'decommissioned') {
    return (
      <div className="p-8 space-y-6">
        <RecordStateAlert show variant="warning" title="Room Decommissioned">
          This room has been decommissioned from active inventory and is locked
          for editing. Restore the room via the Profile page if you need to
          modify its properties.
        </RecordStateAlert>
        <Button variant="secondary" onClick={onCancel} className="w-full">
          Close
        </Button>
      </div>
    );
  }
  const onSubmit = async (values) => {
    if (readOnly) return;
    try {
      const rate = parseMoneyInput(values.monthly_rate);
      const payload = {
        room_code: values.room_code,
        room_type: values.room_type,
        capacity: Number(values.capacity),
        monthly_rate: rate,
        amenities: values.amenities || null,
        description: values.description || null,
        bed_spaces: values.bed_spaces.map((b) => ({
          bed_space_id: b.bed_space_id,
          bed_label: b.bed_label,
        })),
        is_metered: !!values.is_metered,
      };
      await apiRequest(`/api/rooms/${room.room_id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      showToast(`Room ${values.room_code} updated successfully.`, 'success');
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
      submitLabel="Update Room"
    >
      {/* Forensic Anchor Header */}
      <div className="mb-8 border-b border-stone-100 bg-stone-50/50 -mx-8 -mt-8 p-8 flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">
            Resource context
          </p>
          <div className="flex items-center gap-3">
            <h4 className="text-sm font-bold text-stone-900 truncate">
              {room.room_code}
            </h4>
            <ResourceIdCell id={room.room_id} type="room" />
          </div>
        </div>
        <StatusBadge size="xs">{room.status}</StatusBadge>
      </div>

      <RecordStateAlert variant="info" className="mb-6">
        Room status is maintained automatically from bed space occupancy. Manual
        overrides are not permitted (BR-ROM-003).
      </RecordStateAlert>
      <div>
        <h3 className="hs-strip-title text-[10px] uppercase tracking-[0.2em] text-stone-400 mb-4 flex items-center gap-2">
          <DoorOpen size={12} /> Room Details
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Room Code" required error={errors.room_code?.message}>
            <Input
              className="!h-10 border-stone-200"
              disabled={readOnly}
              {...register('room_code', {
                required: 'Room code is required for room identification.',
              })}
            />
          </Field>
          <Field label="Status">
            <div className="h-10 flex items-center">
              <StatusBadge>{room.status}</StatusBadge>
            </div>
          </Field>
          <Field
            label="Monthly Rate"
            required
            error={errors.monthly_rate?.message}
          >
            <Input
              type="number"
              step="0.01"
              prefix="₱"
              className="!h-10 border-stone-200 font-mono font-bold"
              disabled={readOnly}
              {...register('monthly_rate', {
                required: 'Monthly rate is required for billing cycles.',
              })}
            />
          </Field>
          <Field label="Type" required>
            <Select
              className="!h-10 border-stone-200"
              disabled={readOnly || room?.has_occupied_beds}
              {...register('room_type')}
            >
              {Object.entries(ROOM_TYPE_LABELS).map(([val, label]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Utility Billing Type">
            <Select
              className="!h-10 border-stone-200 font-bold"
              disabled={readOnly}
              {...register('is_metered')}
            >
              <option value="1">Metered (Usage-based)</option>
              <option value="0">All-Inclusive (Fixed)</option>
            </Select>
          </Field>
        </div>
      </div>
      <div>
        <div className="mb-4">
          <h3 className="hs-strip-title text-[10px] uppercase tracking-[0.2em] text-stone-400 flex items-center gap-2">
            <ShieldCheck size={12} /> Bed Spaces
          </h3>
          <p className="text-[10px] text-stone-400 mt-1">
            {roomType === 'solo'
              ? 'Solo rooms enforce 1 bed.'
              : 'Manage bed labels manually.'}
          </p>
        </div>
        <div className="space-y-3">
          {fields.map((field, index) => (
            <div key={field.id} className="flex gap-2">
              <div className="flex-1">
                <Field error={errors.bed_spaces?.[index]?.bed_label?.message}>
                  <Input
                    placeholder="Bed Label"
                    className="!h-10 border-stone-200 text-sm"
                    disabled={readOnly || field.is_occupied}
                    {...register(`bed_spaces.${index}.bed_label`, {
                      required: 'Required',
                    })}
                  />
                </Field>
              </div>
              <div className="w-32 shrink-0 flex items-center justify-end">
                <StatusBadge size="xs">{field.status}</StatusBadge>
              </div>
              {roomType === 'shared' &&
                !field.is_occupied &&
                !readOnly &&
                fields.length > 2 && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => remove(index)}
                    className="!h-10 w-10 shrink-0 text-rose-400"
                  >
                    <Trash2 size={14} />
                  </Button>
                )}
            </div>
          ))}
          {roomType === 'shared' && !readOnly && (
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                append({
                  bed_label: `Bed ${fields.length + 1}`,
                  status: 'vacant',
                })
              }
              className="w-full !h-10 border-dashed border-stone-300 text-[10px] font-bold"
            >
              <Plus size={14} className="mr-2" /> Add Space
            </Button>
          )}
        </div>
      </div>
      <div>
        <h3 className="hs-strip-title text-[10px] uppercase tracking-[0.2em] text-stone-400 mb-4 flex items-center gap-2">
          <Info size={12} /> Notes & Amenities
        </h3>
        <div className="space-y-4">
          <Field label="Amenities">
            <Textarea
              rows={2}
              className="border-stone-200"
              disabled={readOnly}
              {...register('amenities')}
            />
          </Field>
          <Field label="Internal Memo">
            <Textarea
              rows={2}
              className="border-stone-200"
              disabled={readOnly}
              {...register('description')}
            />
          </Field>
        </div>
      </div>
    </QuickEditFormShell>
  );
}
