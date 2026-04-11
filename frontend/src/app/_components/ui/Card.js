/**
 * Card — general surface wrapper.
 * Hover uses box-shadow + border-color transition only (no transform per MASTER.md Section 6).
 * @param {object} props
 * @param {React.ReactNode} props.children
 * @param {string} [props.className]
 */
export function Card({ children, className = "" }) {
  return (
    <div
      className={[
        "relative rounded-xl bg-white p-6",
        "border border-[var(--color-border)]",
        "transition-[box-shadow,border-color] duration-150",
        "hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] hover:border-[var(--color-border-strong)]",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

/**
 * Section — nested content wrapper within cards.
 * @param {object} props
 * @param {React.ReactNode} props.children
 * @param {string} [props.className]
 */
export function Section({ children, className = "" }) {
  return <div className={["rounded-xl border border-[var(--color-primary)]/10 bg-[var(--color-bg)] p-4 shadow-sm", className].join(" ")}>{children}</div>;
}
