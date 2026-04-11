export default function Alert({ variant = "info", title, children, className = "", ...rest }) {
  const variantStyles = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
    error: "border-rose-200 bg-rose-50 text-rose-800",
    info: "border-[var(--color-primary)]/20 bg-[var(--color-background)] text-[var(--color-text)]",
  };

  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      aria-live={variant === "error" ? "assertive" : "polite"}
      className={[
        "rounded-xl border px-5 py-4 text-sm shadow-sm",
        variantStyles[variant] || variantStyles.info,
        className,
      ].join(" ")}
      {...rest}
    >
      {title ? <div className="font-bold tracking-tight">{title}</div> : null}
      {children ? <div className={title ? "mt-1.5 opacity-90" : "opacity-90"}>{children}</div> : null}
    </div>
  );
}
