import React from "react";

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
  const normalizedValue = rawValue.replace(/\s+/g, '_');
  
  // Strict variant mapping per MASTER.md Section 6.4
  const variantMap = {
    // Payment statuses
    'paid': 'badge-success',
    'partial': 'badge-warning',
    'unpaid': 'badge-danger',
    'overdue': 'badge-danger',
    'posted': 'badge-success',
    'voided': 'badge-neutral',
    
    // Tenant statuses (tenants.status — schema: active | moved_out | archived)
    'active': 'badge-success',
    'moved_out': 'badge-neutral',
    'inactive': 'badge-neutral',
    'archived': 'badge-neutral',

    // Room statuses (rooms.status — schema: available | unavailable | maintenance; never "occupied" on rooms)
    'available': 'badge-success',
    'maintenance': 'badge-warning',
    'unavailable': 'badge-warning',

    // Bed space statuses (bed_spaces.status — vacant | occupied | maintenance)
    'vacant': 'badge-success',
    'occupied': 'badge-info',
    
    // Contract statuses
    'ended': 'badge-neutral',
    'voided_contract': 'badge-neutral',
    'terminated': 'badge-danger',
    
    // Generic statuses
    'completed': 'badge-neutral',
    'error': 'badge-danger',

    // RBAC roles (user directory)
    'admin': 'badge-success',
    'staff': 'badge-info',
    'viewer': 'badge-neutral',
  };
  
  const variant = variantMap[normalizedValue] || 'badge-neutral';
  
  // Badge variant styles per MASTER.md Section 6.4
  const variantStyles = {
    'badge-success': {
      background: '#ECFDF5',
      color: '#065F46',
      borderColor: '#A7F3D0',
    },
    'badge-info': {
      background: '#F0FDFA',
      color: '#134E4A',
      borderColor: '#99F6E4',
    },
    'badge-warning': {
      background: '#FFFBEB',
      color: '#92400E',
      borderColor: '#FDE68A',
    },
    'badge-danger': {
      background: '#FEF2F2',
      color: '#991B1B',
      borderColor: '#FECACA',
    },
    'badge-neutral': {
      background: 'var(--surface-muted)',
      color: '#57534E',
      borderColor: '#D6D3D1',
    },
  };
  
  const styles = variantStyles[variant];
  
  // Human-readable label mapping (Requirement 4.5)
  const labelMap = {
    'moved_out': 'Moved Out',
    'active': 'Active',
    'inactive': 'Inactive',
    'paid': 'Paid',
    'partial': 'Partial',
    'unpaid': 'Unpaid',
    'overdue': 'Overdue',
    'posted': 'Posted',
    'voided': 'Voided',
    'voided_contract': 'Voided',
    'available': 'Available',
    'occupied': 'Occupied',
    'maintenance': 'Maintenance',
    'unavailable': 'Unavailable',
    'vacant': 'Vacant',
    'ended': 'Ended',
    'terminated': 'Terminated',
    'completed': 'Completed',
    'archived': 'Archived',
    'error': 'Error',
    'solo': 'Solo Room',
    'shared': 'Shared Room',
    'admin': 'Admin',
    'staff': 'Staff',
    'viewer': 'Viewer',
  };
  
  const displayLabel = labelMap[normalizedValue] || children;
  
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 10px',
        borderRadius: '999px',
        fontSize: '0.75rem',
        fontWeight: '500',
        lineHeight: '1',
        border: `1px solid ${styles.borderColor}`,
        backgroundColor: styles.background,
        color: styles.color,
        whiteSpace: 'nowrap',
      }}
      role="status"
      aria-label={`Status: ${displayLabel}`}
    >
      {displayLabel}
    </span>
  );
}

export default StatusBadge;
