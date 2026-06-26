/**
 * Modular Spinner component for HavenStay.
 * Used for micro-interactions (buttons) and container-level loading.
 * Full-page loading should use Skeleton screens instead (HCI Best Practice).
 *
 * @param {string} [label] - Optional text to show below the spinner.
 * @param {"sm"|"md"|"lg"} [size="md"] - Controls the spinner dimensions.
 * @param {boolean} [center=true] - Whether to center the spinner in its parent.
 */
export default function Spinner({ label = '', size = 'md', center = true }) {
  const sizeMap = {
    sm: 'h-4 w-4 border-2',
    md: 'h-8 w-8 border-3',
    lg: 'h-12 w-12 border-4',
  };

  const containerClasses = [
    center
      ? 'flex flex-col items-center justify-center gap-4'
      : 'inline-flex items-center gap-3',
    center && size === 'lg' ? 'min-h-[200px]' : '',
  ].join(' ');

  return (
    <div className={containerClasses}>
      <div className="relative">
        <div
          className={`${sizeMap[size] || sizeMap.md} animate-spin rounded-full border-[var(--color-primary)]/10 border-t-[var(--color-primary)]`}
          aria-hidden="true"
        />
        {size === 'lg' && (
          <div className="absolute inset-0 h-12 w-12 animate-ping rounded-full border border-[var(--color-primary)]/20" />
        )}
      </div>
      {label ? (
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--color-primary)] animate-pulse">
          {label}
        </span>
      ) : null}
    </div>
  );
}
