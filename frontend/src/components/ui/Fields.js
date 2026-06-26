/**
 * Form field primitives — design-system/havenstay/MASTER.md Section 5.7.
 * Input height: 40px. Focus: 3px teal ring. Error: red border + shadow.
 */

/**
 * Field wrapper — label, required indicator, error/help text.
 *
 * @param {string} label
 * @param {boolean} [required]
 * @param {string} [error]
 * @param {string} [warning]
 * @param {string} [helpText]
 * @param {React.ReactNode} children
 * @param {string} [className]
 */
export function Field({
  label,
  required,
  error,
  warning,
  helpText,
  children,
  className = '',
}) {
  return (
    <div className={className}>
      <label className="mb-2 block text-[11px] font-black uppercase tracking-widest text-stone-500">
        {label}
        {required ? (
          <span className="ml-1.5 text-red-500" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      {children}
      {error ? (
        <div
          className="mt-1.5 text-[10px] font-bold uppercase tracking-wide text-red-600"
          role="alert"
        >
          {error}
        </div>
      ) : warning ? (
        <div
          className="mt-1.5 text-[10px] font-bold uppercase tracking-wide text-amber-600"
          role="alert"
        >
          {warning}
        </div>
      ) : null}
      {!error && !warning && helpText ? (
        <div className="mt-1 text-xs text-[var(--color-text-secondary)]">
          {helpText}
        </div>
      ) : null}
    </div>
  );
}

const baseInput =
  'h-10 w-full rounded-lg border px-3.5 text-sm text-[var(--color-text)] bg-white ' +
  'placeholder:text-[var(--color-text-disabled)] ' +
  'transition-[border-color,box-shadow] duration-150 outline-none ' +
  'hover:border-[var(--color-border-strong)] ' +
  'disabled:bg-[var(--color-bg)] disabled:text-[var(--color-text-disabled)] disabled:cursor-not-allowed';

const normalBorder =
  'border-[var(--color-border)] focus:border-[var(--color-primary)] focus:shadow-[0_0_0_3px_rgba(13,148,136,0.15)]';

const errorBorder =
  'border-[#EF4444] focus:border-[#EF4444] focus:shadow-[0_0_0_3px_rgba(239,68,68,0.15)]';

/**
 * Text / number input.
 * Supports prefix/suffix icons or text.
 * @param {boolean} [hasError=false]
 * @param {React.ReactNode} [icon] - Leading icon (absolute positioned)
 * @param {string} [prefix] - Leading text (e.g. "₱")
 */
export function Input({
  className = '',
  hasError = false,
  icon: Icon,
  prefix,
  ...props
}) {
  if (Icon || prefix) {
    return (
      <div className="relative group w-full">
        {Icon && (
          <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 transition-colors group-focus-within:text-teal-600">
            <Icon size={18} aria-hidden />
          </div>
        )}
        {prefix && (
          <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[10px] font-bold tracking-widest text-stone-400 transition-colors group-focus-within:text-teal-600 uppercase">
            {prefix}
          </div>
        )}
        <input
          className={[
            baseInput,
            hasError ? errorBorder : normalBorder,
            Icon || prefix ? 'pl-11' : '',
            className,
          ].join(' ')}
          {...props}
        />
      </div>
    );
  }

  return (
    <input
      className={[
        baseInput,
        hasError ? errorBorder : normalBorder,
        className,
      ].join(' ')}
      {...props}
    />
  );
}

/**
 * Select dropdown — custom chevron via background-image per MASTER.md Section 5.7.
 * @param {boolean} [hasError=false]
 */
export function Select({ className = '', hasError = false, ...props }) {
  return (
    <select
      className={[
        baseInput,
        'appearance-none pr-10',
        "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2378716C' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")] bg-no-repeat bg-[right_12px_center]",
        hasError ? errorBorder : normalBorder,
        className,
      ].join(' ')}
      {...props}
    />
  );
}

/**
 * Textarea — resizable, min 100px height.
 * @param {boolean} [hasError=false]
 */
export function Textarea({ className = '', hasError = false, ...props }) {
  return (
    <textarea
      className={[
        'min-h-[100px] w-full rounded-lg border px-3.5 py-2.5 text-sm text-[var(--color-text)] bg-white',
        'placeholder:text-[var(--color-text-disabled)] resize-vertical leading-relaxed',
        'transition-[border-color,box-shadow] duration-150 outline-none',
        'hover:border-[var(--color-border-strong)]',
        'disabled:bg-[var(--color-bg)] disabled:text-[var(--color-text-disabled)] disabled:cursor-not-allowed',
        hasError ? errorBorder : normalBorder,
        className,
      ].join(' ')}
      {...props}
    />
  );
}

/**
 * Checkbox — custom toggle with text label.
 */
export function Checkbox({ label, className = '', ...props }) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 select-none ${className}`}
    >
      <div className="relative flex items-center h-5">
        <input
          type="checkbox"
          className="peer h-5 w-5 cursor-pointer rounded border-stone-300 text-teal-600 focus:ring-teal-500 focus:ring-offset-0"
          {...props}
        />
      </div>
      <span className="text-sm font-medium text-stone-700 leading-tight">
        {label}
      </span>
    </label>
  );
}
