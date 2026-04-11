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
    <div className="flex flex-col gap-3 py-2">
      {breadcrumbs ? <div className="mb-0.5">{breadcrumbs}</div> : null}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="hs-page-title">{title}</h1>
          {subtitle ? (
            <div className="hs-page-subtitle text-sm font-medium leading-relaxed text-stone-500">{subtitle}</div>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center justify-end gap-3">{actions}</div> : null}
      </div>
    </div>
  );
}
