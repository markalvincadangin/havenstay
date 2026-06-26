/**
 * PageHeader — page title row per design-system/havenstay/MASTER.md (Section 3, §3.1, layout §4.2, component §5.4).
 *
 * @param {string} title - Page title (h1).
 * @param {React.ReactNode} [subtitle] - Description below the title (string or custom node).
 * @param {React.ReactNode} [actions] - Right-aligned slot (buttons, UserRoleBadge).
 * @param {React.ReactNode} [breadcrumbs] - Optional breadcrumb trail.
 */
export default function PageHeader({ title, subtitle, actions, breadcrumbs }) {
  return (
    <div className="flex flex-col gap-3 py-1">
      {breadcrumbs ? <div className="mb-0.5">{breadcrumbs}</div> : null}
      <div className="flex flex-wrap items-start justify-between gap-4 lg:items-center">
        <div className="max-w-3xl space-y-1.5">
          <h1 className="hs-page-title">{title}</h1>
          {subtitle ? (
            <div className="hs-page-subtitle text-[13px] font-medium leading-relaxed text-stone-500">
              {subtitle}
            </div>
          ) : null}
        </div>
        {actions ? (
          <div
            className={[
              'flex flex-wrap items-center justify-end gap-3',
              // Harmonize action affordances across pages.
              '[&>a]:inline-flex [&>a]:h-11 [&>a]:items-center [&>a]:justify-center [&>a]:rounded-xl [&>a]:px-5 [&>a]:text-[10px] [&>a]:font-bold [&>a]:uppercase [&>a]:tracking-widest',
              '[&>button]:h-11 [&>button]:rounded-xl [&>button]:px-5 [&>button]:text-[10px] [&>button]:font-bold [&>button]:uppercase [&>button]:tracking-widest',
            ].join(' ')}
          >
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );
}
