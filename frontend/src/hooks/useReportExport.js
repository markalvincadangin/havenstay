import { useState } from "react";
import { useToasts } from "@/context/ToastContext";
import { exportReportCsv } from "@/lib/downloads";
import { flattenApiErrors } from "@/lib/errors";

/**
 * useReportExport
 * 
 * Standardized hook for administrative report exports with HCI-compliant feedback.
 * Provides consistent loading states and toast notifications.
 */
export function useReportExport() {
  const [exporting, setExporting] = useState(false);
  const { showToast } = useToasts();

  const performExport = async ({ endpoint, filters, filenamePrefix, label = "Report" }) => {
    setExporting(true);
    showToast(`Preparing ${label} export...`, "info");
    try {
      await exportReportCsv({ 
        endpoint, 
        filters, 
        filenamePrefix 
      });
      showToast(`${label} exported successfully.`, "success");
    } catch (error) {
      console.error(`Export failed: ${label}`, error);
      showToast(flattenApiErrors(error) || `Failed to export ${label}.`, "error");
    } finally {
      setExporting(false);
    }
  };

  return { exporting, performExport };
}
