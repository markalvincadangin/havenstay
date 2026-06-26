export default function FilterChips({ items = [], onClearAll }) {
  const active = items.filter((item) => item.value);

  if (!active.length) {
    return null;
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      {active.map((item) => (
        <span
          key={item.key}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--color-primary)]/20 bg-[var(--color-primary)]/5 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[var(--color-primary)] shadow-sm"
        >
          {item.label}: <span className="opacity-70">{item.value}</span>
          <button
            type="button"
            className="ml-1 text-[var(--color-primary)] hover:scale-125 transition-transform"
            onClick={item.onClear}
            aria-label={`Clear filter ${item.label}`}
          >
            ✕
          </button>
        </span>
      ))}
      {onClearAll ? (
        <button
          type="button"
          className="ml-1 text-[10px] font-black uppercase tracking-widest text-[var(--color-text)]/40 hover:text-[var(--color-cta)] hover:underline"
          onClick={onClearAll}
        >
          CLEAR ALL
        </button>
      ) : null}
    </div>
  );
}
