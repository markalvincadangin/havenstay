'use client';

import Button from './Button';

export default function ReportHeaderActions({
  user,
  onExport,
  exporting = false,
  exportDisabled = false,
  showExport = true,
  exportLabel = 'Export CSV',
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-3">
      {showExport ? (
        <Button
          type="button"
          variant="primary"
          onClick={onExport}
          loading={exporting}
          disabled={exportDisabled}
          className="!h-11 rounded-xl px-8 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-teal-900/10"
        >
          {exportLabel}
        </Button>
      ) : null}
    </div>
  );
}
