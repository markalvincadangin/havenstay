"use client";

/**
 * Button — variants per design-system/havenstay/MASTER.md Section 5.5.
 * The `outline` alias maps to `secondary` for backwards compatibility.
 *
 * @param {"button"|"submit"|"reset"} [type="button"]
 * @param {"primary"|"secondary"|"danger"|"ghost"|"dangerGhost"|"outline"} [variant="primary"]
 * @param {"sm"|"md"|"lg"} [size="md"]
 * @param {boolean} [loading=false] - Shows spinner, keeps button width stable.
 * @param {boolean} [disabled=false]
 * @param {string} [className]
 * @param {React.ReactNode} children
 */
export default function Button({
  type = "button",
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  className = "",
  children,
  ...props
}) {
  const isDisabled = disabled || loading;

  // "outline" is a legacy alias — maps to secondary per MASTER.md Section 5.5
  const resolvedVariant = variant === "outline" ? "secondary" : variant;

  const variantClasses = {
    /** Primary: teal fill — one per page section max */
    primary:
      "bg-[var(--color-primary)] text-white " +
      "hover:bg-[var(--color-primary-dark)] " +
      "active:scale-[0.98] " +
      "focus:outline-none focus:shadow-[0_0_0_3px_rgba(13,148,136,0.3)]",
    /** Secondary: transparent with border — cancel / back actions */
    secondary:
      "border border-[var(--color-border-strong)] bg-transparent text-[var(--color-text)] " +
      "hover:bg-[var(--color-bg)] hover:border-[var(--color-text-secondary)] " +
      "focus:outline-none focus:shadow-[0_0_0_3px_rgba(13,148,136,0.3)]",
    /** Danger: red outline — destructive actions (Void, Delete) */
    danger:
      "border border-[#FECACA] bg-transparent text-[#991B1B] " +
      "hover:bg-[#FEF2F2] hover:border-[#FCA5A5] " +
      "focus:outline-none focus:shadow-[0_0_0_3px_rgba(153,27,27,0.2)]",
    /** Ghost: subtle — tertiary actions */
    ghost:
      "bg-transparent text-[var(--color-text)] " +
      "hover:bg-[var(--color-bg)]",
    /** DangerGhost: alias kept for compatibility */
    dangerGhost:
      "border border-[#FECACA] bg-transparent text-[#991B1B] " +
      "hover:bg-[#FEF2F2] hover:border-[#FCA5A5]",
  };

  const sizeClasses = {
    sm: "h-8 px-4 text-xs",
    md: "h-10 px-5 text-sm",
    lg: "h-12 px-8 text-base",
  };

  return (
    <button
      type={type}
      disabled={isDisabled}
      className={[
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium",
        "transition-[background-color,border-color,box-shadow] duration-150",
        "cursor-pointer",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variantClasses[resolvedVariant] ?? variantClasses.primary,
        sizeClasses[size] ?? sizeClasses.md,
        className,
      ].join(" ")}
      {...props}
    >
      {loading ? (
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      ) : null}
      {children}
    </button>
  );
}
