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
        "relative rounded-2xl bg-white p-6",
        "border border-stone-200 shadow-sm",
        "transition-[box-shadow,border-color] duration-150",
        "hover:shadow-lg hover:border-stone-300",
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
