/**
 * Primary filled CTA link — list pages: New, Create, Record Payment, etc.
 * Uses --color-primary per MASTER.md Section 5.6.
 */
export const primaryLinkCtaClass =
  'inline-flex h-11 min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-xl ' +
  'bg-teal-600 px-4 sm:px-8 text-[10px] font-black uppercase tracking-widest text-white ' +
  'shadow-xl shadow-teal-900/10 active:scale-95 ' +
  'transition-all duration-200 ' +
  'hover:bg-teal-700 hover:shadow-teal-900/20 ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600';

/**
 * Secondary outline action link — detail pages: Edit.
 * Uses --color-primary border per MASTER.md Section 5.6.
 */
export const secondaryOutlineLinkClass =
  'inline-flex h-11 min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-xl ' +
  'border border-[var(--color-border-strong)] bg-transparent px-5 text-[10px] font-bold uppercase tracking-widest text-[var(--color-text)] ' +
  'transition-[background-color,border-color] duration-150 ' +
  'hover:bg-[var(--color-bg)] hover:border-[var(--color-text-secondary)] ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]';

/** Header icon back button token used on detail/form pages. */
export const headerIconBackButtonClass =
  'inline-flex size-11 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-500 transition-colors hover:bg-stone-50';
