import {
  TENANT_STATUS_LABELS,
  ROOM_STATUS_LABELS,
  BED_STATUS_LABELS,
  CONTRACT_STATUS_LABELS,
  BILLING_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  ROOM_TYPE_LABELS,
  AUDIT_ACTION_LABELS,
} from "@/lib/constants";
import { 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  XCircle, 
  Archive, 
  User, 
  Shield, 
  Eye, 
  Zap, 
  Activity,
  History,
  FileText,
  DoorOpen,
  X,
  CreditCard
} from "lucide-react";

/**
 * StatusBadge Component
 *
 * Displays a semantic status indicator with strict variant mapping
 * according to MASTER.md Section 6.4 specifications.
 *
 * Design System Compliance:
 * - Pill shape (border-radius: 999px)
 * - 12px font size (0.75rem), weight 500
 * - 1px border matching semantic color's border token
 * - Human-readable labels (e.g., "Moved Out" not "moved_out")
 *
 * Semantic Mapping (Requirements 4.1-4.4):
 * - paid → badge-success (emerald)
 * - partial → badge-warning (amber)
 * - unpaid → badge-danger (red)
 * - overdue → badge-danger (red)
 * - active → badge-success (emerald)
 * - moved_out → badge-neutral (stone)
 * - available → badge-success (emerald)
 * - occupied → badge-info (teal)
 * - ended → badge-neutral (stone)
 * - voided → badge-neutral (stone)
 */

export function StatusBadge({ children }) {
  const rawValue = String(children || "").toLowerCase().trim();

  // Normalize value (handle spaces and underscores)
  const normalizedValue = rawValue.replace(/\s+/g, "_");

  // Strict variant mapping per MASTER.md Section 6.4
  const variantMap = {
    // Payment & Billing statuses
    paid: "badge-success",
    partial: "badge-warning",
    unpaid: "badge-warning",
    overdue: "badge-danger",
    "past_due": "badge-danger",
    posted: "badge-success",
    voided: "badge-neutral",

    // Tenant statuses
    active: "badge-success",
    inactive: "badge-neutral",
    moved_out: "badge-neutral",
    archived: "badge-neutral",

    // Room & Bed statuses
    available: "badge-success",
    unavailable: "badge-danger",
    maintenance: "badge-warning",
    occupied: "badge-info",
    vacant: "badge-success", // Bed space status
    cleared: "badge-success", // Contract deposit cleared
    replaced: "badge-neutral", // Meter hardware status

    // Contract statuses
    pending_payment: "badge-warning",
    completed: "badge-neutral",
    terminated: "badge-danger",
    voided_contract: "badge-neutral",

    // RBAC roles
    admin: "badge-success",
    staff: "badge-info",
    viewer: "badge-neutral",

    // Audit & Transaction
    create: "badge-success",
    insert: "badge-success",
    update: "badge-info",
    status_change: "badge-warning",
    delete: "badge-danger",
    access_denied: "badge-danger",
    login: "badge-success",
    logout: "badge-neutral",
    started: "badge-info",
    superseded: "badge-neutral",
  };

  const iconMap = {
    paid: CheckCircle,
    active: Activity,
    overdue: AlertTriangle,
    past_due: AlertTriangle,
    unpaid: Clock,
    pending_payment: Clock,
    voided: XCircle,
    voided_contract: XCircle,
    terminated: XCircle,
    archived: Archive,
    available: CheckCircle,
    vacant: CheckCircle,
    occupied: DoorOpen,
    maintenance: AlertTriangle,
    unavailable: X,
    admin: Shield,
    staff: User,
    viewer: Eye,
    cleared: CheckCircle,
    create: Zap,
    insert: Zap,
    update: History,
    status_change: AlertTriangle,
    delete: X,
    login: Activity,
    logout: X,
    posted: FileText,
    billing: CreditCard,
  };

  const variant = variantMap[normalizedValue] || "badge-neutral";
  const IconComponent = iconMap[normalizedValue] || null;

  // Badge variant styles per MASTER.md Section 6.4
  const variantStyles = {
    "badge-success": {
      background: "#D1FAE5",
      color: "#065F46",
      borderColor: "#A7F3D0",
    },
    "badge-info": {
      background: "#CCFBF1",
      color: "#115E59",
      borderColor: "#99F6E4",
    },
    "badge-warning": {
      background: "#FFFBEB",
      color: "#92400E",
      borderColor: "#FDE68A",
    },
    "badge-danger": {
      background: "#FEF2F2",
      color: "#991B1B",
      borderColor: "#FECACA",
    },
    "badge-neutral": {
      background: "var(--surface-muted)",
      color: "#57534E",
      borderColor: "#D6D3D1",
    },
  };

  const styles = variantStyles[variant];

  // Human-readable label mapping (Requirement 4.5)
  // Derived from centralized constants in src/lib/constants.js
  const labelMap = {
    ...TENANT_STATUS_LABELS,
    ...ROOM_STATUS_LABELS,
    ...BED_STATUS_LABELS,
    ...CONTRACT_STATUS_LABELS,
    ...BILLING_STATUS_LABELS,
    ...PAYMENT_STATUS_LABELS,
    ...ROOM_TYPE_LABELS,
    ...AUDIT_ACTION_LABELS,
    inactive: "Inactive",
    voided: "Voided",
    voided_contract: "Voided",
    settled: "Paid",
    past_due: "Overdue",
    admin: "Admin",
    staff: "Staff",
    viewer: "Viewer",
    cleared: "Deposit Cleared",
  };

  const displayLabel = labelMap[normalizedValue] || children;

  const indicatorMap = {
    "badge-success": "bg-emerald-500",
    "badge-info": "bg-teal-500",
    "badge-warning": "bg-amber-500",
    "badge-danger": "bg-red-500",
    "badge-neutral": null,
  };

  const indicatorClass = indicatorMap[variant];
  const shouldPulse = ["active", "pending_sync"].includes(normalizedValue);

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "3px 10px",
        borderRadius: "999px",
        fontSize: "0.75rem",
        fontWeight: "500",
        lineHeight: "1.2",
        border: `1px solid ${styles.borderColor}`,
        backgroundColor: styles.background,
        color: styles.color,
        whiteSpace: "nowrap",
      }}
      role="status"
      aria-label={`Status: ${displayLabel}`}
    >
      {IconComponent ? (
        <IconComponent size={12} className="mr-1.5 shrink-0" strokeWidth={2.5} />
      ) : indicatorClass ? (
        <span 
          className={[
            "mr-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
            indicatorClass,
            shouldPulse ? "animate-[pulse_2s_ease-in-out_infinite]" : ""
          ].join(" ")} 
          aria-hidden="true" 
        />
      ) : null}
      {displayLabel}
    </span>
  );
}

export default StatusBadge;
