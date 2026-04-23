export default function Spinner({ label = "Loading..." }) {
  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center gap-6">
      <div className="relative">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-[var(--color-primary)]/10 border-t-[var(--color-primary)]" aria-hidden="true" />
        <div className="absolute inset-0 h-12 w-12 animate-ping rounded-full border border-[var(--color-primary)]/20" />
      </div>
      {label ? (
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--color-primary)] animate-pulse">
          {label}
        </span>
      ) : null}
    </div>
  );
}
