'use client';

import { CheckCircle, ShieldCheck } from 'lucide-react';
import Button from '@/components/ui/Button';
import CurrencyDisplay from '@/components/ui/CurrencyDisplay';
import ResourceIdCell from '@/components/ui/ResourceIdCell';
import { METHOD_LABELS } from '@/lib/constants';
import { useFocusTrap } from '@/hooks/useFocusTrap';

/**
 * ConfirmPaymentModal — Specialized confirmation dialog for payment recording.
 * Extracted for reusability and cleaner parent component logic.
 */
export default function ConfirmPaymentModal({
  selectedBilling,
  residentName,
  values,
  onConfirm,
  onCancel,
  loading,
  isRefundMode = false,
  isDepositMode = false,
  isInitialSettlement = false,
}) {
  const modalRef = useFocusTrap(true);
  const currentBalance = Number(selectedBilling?.balance || 0);
  const amount = Number(values?.amount_paid) || 0;
  const newBalance = Math.max(currentBalance - amount, 0);

  return (
    <div
      className="fixed inset-0 z-50 flex min-h-screen items-center justify-center bg-stone-900/60 backdrop-blur-sm px-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        ref={modalRef}
        className="w-full max-w-[480px] rounded-3xl border border-stone-200 bg-white p-8 shadow-2xl animate-in zoom-in-95 duration-200"
      >
        <div className="flex items-start gap-4">
          <div
            className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${isRefundMode || isDepositMode ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'} shadow-sm`}
          >
            {isRefundMode || isDepositMode ? (
              <ShieldCheck size={24} />
            ) : (
              <CheckCircle size={24} />
            )}
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-stone-900">
              {isRefundMode
                ? 'Confirm Refund Disbursement'
                : isDepositMode
                  ? 'Confirm Deposit Receipt'
                  : isInitialSettlement
                    ? 'Confirm Initial Settlement'
                    : 'Confirm Payment'}
            </h3>
            <p className="mt-1 text-xs font-medium text-stone-500">
              {isRefundMode
                ? 'This will finalize the financial settlement and clear the security deposit balance for this contract.'
                : isDepositMode
                  ? 'This will record the initial security collateral for this contract. This amount is refundable upon move-out.'
                  : isInitialSettlement
                    ? "This will simultaneously record the first month's rent and security deposit for this contract."
                    : "This will log the payment against the tenant's ledger and release relevant inventory holds."}
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-stone-100 bg-stone-50/50 p-6 space-y-4">
          <div className="flex justify-between items-start">
            <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">
              Target Record
            </p>
            <div className="text-right">
              {isRefundMode || isDepositMode || isInitialSettlement ? (
                <ResourceIdCell id={values?.contract_id} type="contract" />
              ) : (
                <ResourceIdCell
                  id={selectedBilling?.billing_id}
                  type="billing"
                />
              )}
            </div>
          </div>

          <div className="flex justify-between items-start">
            <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">
              Tenant
            </p>
            <p className="text-sm font-bold text-stone-900 text-right">
              {residentName || '—'}
            </p>
          </div>

          <div className="h-px bg-stone-200/50 my-2"></div>

          <div className="flex justify-between items-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">
              {isRefundMode
                ? 'Disbursement Amount'
                : isDepositMode
                  ? 'Collateral Amount'
                  : isInitialSettlement
                    ? 'Settlement Total'
                    : 'Amount Paid'}
            </p>
            <CurrencyDisplay
              amount={amount}
              className={`text-sm font-black ${isRefundMode || isDepositMode ? 'text-amber-700' : isInitialSettlement ? 'text-stone-900' : 'text-stone-900'}`}
            />
          </div>

          <div className="flex justify-between items-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">
              Payment Method
            </p>
            <p className="text-xs font-bold text-stone-700 uppercase">
              {METHOD_LABELS[values?.payment_method] || values?.payment_method}
            </p>
          </div>

          {values?.reference_number && values?.payment_method !== 'cash' && (
            <div className="flex justify-between items-center">
              <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">
                Reference No.
              </p>
              <p className="text-xs font-mono font-bold text-teal-700">
                {values.reference_number}
              </p>
            </div>
          )}

          {!isRefundMode && !isDepositMode && !isInitialSettlement && (
            <div className="pt-4 border-t border-stone-200 mt-2">
              <div className="flex justify-between items-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">
                  Remaining Balance
                </p>
                <CurrencyDisplay
                  amount={newBalance}
                  className={`text-lg font-black ${newBalance === 0 ? 'text-stone-900' : 'text-teal-700'}`}
                />
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={loading}
            className="px-8 text-[10px] font-black uppercase tracking-widest"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={onConfirm}
            loading={loading}
            className={`px-10 rounded-xl text-[10px] font-black uppercase tracking-widest ${isRefundMode || isDepositMode ? 'bg-amber-600 hover:bg-amber-700' : ''}`}
          >
            {isRefundMode
              ? 'Disburse Refund'
              : isDepositMode
                ? 'Receipt Deposit'
                : isInitialSettlement
                  ? 'Confirm Settlement'
                  : 'Record Payment'}
          </Button>
        </div>
      </div>
    </div>
  );
}
