import { CheckCircle, AlertTriangle, AlertCircle, Info } from 'lucide-react';

export default function Alert({
  variant = 'info',
  title,
  children,
  className = '',
  ...rest
}) {
  const variantStyles = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-800',
    error: 'border-red-200 bg-red-50 text-red-800',
    info: 'border-teal-200 bg-teal-50 text-teal-800',
  };

  const Icons = {
    success: CheckCircle,
    warning: AlertTriangle,
    error: AlertCircle,
    info: Info,
  };
  const Icon = Icons[variant] || Icons.info;

  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      aria-live={variant === 'error' ? 'assertive' : 'polite'}
      className={[
        'rounded-xl border px-5 py-4 text-sm shadow-sm',
        variantStyles[variant] || variantStyles.info,
        className,
      ].join(' ')}
      {...rest}
    >
      <div className="flex gap-3">
        <Icon
          size={18}
          className="mt-0.5 shrink-0 opacity-80"
          strokeWidth={2.5}
        />
        <div className="flex-1">
          {title ? (
            <div className="font-bold tracking-tight">{title}</div>
          ) : null}
          {children ? (
            <div className={title ? 'mt-1.5' : ''}>{children}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
