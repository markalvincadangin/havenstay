"use client";

import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";

export function QuickEditFormShell({
  onSubmit,
  isSubmitting,
  isSubmitDisabled = false,
  apiError,
  onCancel,
  submitLabel = "Save Changes",
  children,
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-8">
      {children}

      <div className="flex flex-col-reverse gap-3 pt-6 mt-8 sm:flex-row sm:justify-end border-t border-stone-100">
        <Button variant="secondary" onClick={onCancel} disabled={isSubmitting} type="button">
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={isSubmitting} disabled={isSubmitting || isSubmitDisabled} className="h-10 px-6 rounded-xl font-black uppercase tracking-widest text-xs">
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
