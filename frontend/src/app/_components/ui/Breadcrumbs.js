import Link from "next/link";

export default function Breadcrumbs({ items = [] }) {
  if (!items.length) {
    return null;
  }

  return (
    <nav
      aria-label="Breadcrumb"
      className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-text)]/40 [word-spacing:0.12em]"
    >
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          
          // CRITICAL: Hide single-item breadcrumbs that merely repeat the page title
          // and hide the last item if it's part of a longer trail (redundant with h1)
          if (isLast && index >= 0 && items.length <= 1) return null;
          if (isLast && index > 0) return null;
          
          return (
            <li key={`${item.label}-${index}`} className="inline-flex items-center gap-1.5">
              {item.href ? (
                <Link className="transition-colors hover:text-[var(--color-primary)]" href={item.href}>
                  {item.label}
                </Link>
              ) : (
                <span>{item.label}</span>
              )}
              {!isLast ? <span className="text-[var(--color-text)]/20" aria-hidden="true">•</span> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
