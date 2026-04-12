/**
 * Primary filled CTA link — list pages: New, Create, Record Payment, etc.
 * Uses --color-primary per MASTER.md Section 5.6.
 */
export const primaryLinkCtaClass =
  "inline-flex h-10 min-h-[40px] cursor-pointer items-center justify-center gap-2 rounded-lg " +
  "bg-[var(--color-primary)] px-5 text-sm font-medium text-white " +
  "transition-[background-color,box-shadow] duration-150 " +
  "hover:bg-[var(--color-primary-dark)] " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]";

/**
 * Secondary outline action link — detail pages: Edit.
 * Uses --color-primary border per MASTER.md Section 5.6.
 */
export const secondaryOutlineLinkClass =
  "inline-flex h-10 min-h-[40px] cursor-pointer items-center justify-center gap-2 rounded-lg " +
  "border border-[var(--color-border-strong)] bg-transparent px-4 text-sm font-medium text-[var(--color-text)] " +
  "transition-[background-color,border-color] duration-150 " +
  "hover:bg-[var(--color-bg)] hover:border-[var(--color-text-secondary)] " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]";
