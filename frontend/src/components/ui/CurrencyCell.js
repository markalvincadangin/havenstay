'use client';

import CurrencyDisplay from '@/components/ui/CurrencyDisplay';

/**
 * CurrencyCell — table cell currency display.
 * Color-codes by sign: positive balance = rose, credit = emerald, zero = muted.
 */
export default function CurrencyCell({
  amount,
  value,
  suffix = '',
  className = '',
}) {
  const finalAmount =
    amount !== undefined ? amount : value !== undefined ? value : 0;

  const colorClass =
    finalAmount > 0
      ? 'text-rose-600'
      : finalAmount < 0
        ? 'text-emerald-700'
        : 'text-stone-400';

  return (
    <span
      className={`whitespace-nowrap text-sm font-bold ${colorClass} ${className}`}
    >
      <CurrencyDisplay amount={finalAmount} />
      {suffix && (
        <span className="ml-1 text-[10px] font-medium text-stone-400 lowercase tracking-tight">
          {suffix}
        </span>
      )}
    </span>
  );
}
