# Tenants Page Design Specification

> **PROJECT:** HavenStay
> **Last Updated:** 2026-04-10
> **Page Type:** List / Detail / Form Pages
> **Routes:** `/tenants`, `/tenants/[id]`, `/tenants/new`, `/tenants/[id]/edit`

> ⚠️ **IMPORTANT:** Rules in this file **override** the Master file (`../MASTER.md`) for Tenants pages only.
> Only deviations from the Master are documented here. For all other rules, refer to the Master.

---

## Page Purpose

The Tenants pages manage tenant records across four views:

1. **Tenants List** (`/tenants`) - Browse, search, and filter all tenants
2. **Tenant Detail** (`/tenants/[id]`) - View tenant profile and contract history
3. **New Tenant Form** (`/tenants/new`) - Create new tenant records
4. **Edit Tenant Form** (`/tenants/[id]/edit`) - Update existing tenant information

**Design Philosophy:** Clarity, Speed, Trust — operators must quickly find tenants, understand their status, and manage records with minimal friction.

**Research Foundation (UX guidelines.csv):**
- **Form Best Practices** (UX #54-63): 
  - Every input needs visible label (not placeholder-only)
  - Show errors below related input
  - Validate on blur for most fields
  - Mark required fields clearly
  - Show loading then success/error state
- **Table Best Practices** (UX #7, UI reasoning #19):
  - Hover tooltips for data points
  - Row hover state with 100ms transition
  - Click-to-navigate entire row
  - Empty states with helpful guidance
- **Mobile Optimization** (UX #22-23, #66):
  - Minimum 44x44px touch targets
  - Minimum 8px gap between touch targets
  - Larger buttons on mobile breakpoints

---

## Database Schema Alignment

### Critical Data Keys

**Always use these exact field names:**

```typescript
interface Tenant {
  tenant_id: number;           // PRIMARY KEY — never use generic "id"
  first_name: string;
  last_name: string;
  contact_number: string;      // PH mobile format: 09XXXXXXXXX or +639XXXXXXXXX
  email: string | null;
  emergency_contact_name: string | null;
  emergency_contact_number: string | null;
  address: string | null;
  status: 'active' | 'moved_out' | 'archived';  // ENUM — never expose raw values
  created_at: string;          // ISO date string
  updated_at: string;          // ISO date string
}
```

**Status Enum Mapping:**
- `active` → "Active" (badge-success)
- `moved_out` → "Moved Out" (badge-neutral)
- `archived` → "Archived" (badge-neutral)

---

## Layout Structures

### Tenants List Page

```
[Page Header]
  [Breadcrumb: Tenants]                      [user@email · Role]
  [H1: Tenants]                              [+ New Tenant (btn-primary)]
  [Subtitle: Manage tenant records and profiles]

[Search and Filter Controls]
  [Search Input (320px)]  [Status Filter Dropdown]  [Clear All]
  [Active Filter Chips]

[Data Table]
  Columns: Tenant ID | Name | Contact | Email | Status | Actions
  
[Pagination Controls]
```

### Tenant Detail Page

```
[Page Header]
  [Breadcrumb: Tenants / {Tenant Name}]     [user@email · Role]
  [H1: {First Name} {Last Name}]            [Edit Profile (btn-primary)]
  [Status Badge]

[Profile Card]
  [Contact Information Section]
  [Emergency Contact Section]
  [Address Section]

[Contract History Table]
  Columns: Contract ID | Room | Move-In | Expected Move-Out | Deposit | Status
```

### New/Edit Tenant Form

```
[Page Header]
  [Breadcrumb: Tenants / New Tenant]        [user@email · Role]
  [H1: New Tenant]
  [Subtitle: * Required fields]

[Form Card (max-width: 640px centered)]
  [Personal Information Section]
    - First Name * | Last Name *
    - Contact Number *
    - Email
  
  [Emergency Contact Section]
    - Emergency Contact Name
    - Emergency Contact Number
  
  [Address Section]
    - Address (textarea)
  
  [Status Information Panel] (Edit only)
    - Current Status (read-only)
    - Status explanation text
  
  [Form Actions]
    [Cancel (btn-secondary)]  [Save Tenant (btn-primary)]
```

---

## Component Overrides

### Tenants Table Specifications

**Override Reason:** Tenants table has unique column structure and click behavior.

**Columns:**
1. **Tenant ID** - DM Mono font, 12px, secondary text, 70% opacity
2. **Name** - `${first_name} ${last_name}`, font-semibold, primary text
3. **Contact** - contact_number, DM Mono font, 14px
4. **Email** - email or "—", 70% opacity
5. **Status** - StatusBadge component
6. **Actions** - "VIEW" and "EDIT" links, right-aligned, teal CTA color

**Row Click Behavior:**
```javascript
const handleRowClick = (tenantId) => {
  router.push(`/tenants/${tenantId}`);
};

// Prevent double navigation on action links
const handleEditClick = (e, tenantId) => {
  e.stopPropagation();
  router.push(`/tenants/${tenantId}/edit`);
};
```

**Empty State:**
```jsx
<div className="table-empty">
  <p>No tenants found</p>
  <p className="text-sm">Try clearing filters or add your first tenant</p>
</div>
```

---

### Search and Filter Controls

**Override Reason:** Tenants page has specific search and filter requirements.

```css
.search-filter-container {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.search-input {
  width: 100%;
  max-width: 320px;
}

.status-filter {
  min-width: 160px;
}

@media (max-width: 768px) {
  .search-input {
    max-width: 100%;
  }
}
```

**Search Behavior:**
```javascript
// Filter by name, contact, email, or tenant ID
const filteredTenants = useMemo(() => {
  return tenants.filter(tenant => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = 
      tenant.first_name.toLowerCase().includes(searchLower) ||
      tenant.last_name.toLowerCase().includes(searchLower) ||
      tenant.contact_number.includes(searchQuery) ||
      (tenant.email && tenant.email.toLowerCase().includes(searchLower)) ||
      String(tenant.tenant_id).includes(searchQuery);
    
    const matchesStatus = statusFilter === 'all' || tenant.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });
}, [tenants, searchQuery, statusFilter]);
```

**Filter Chips:**
```jsx
{statusFilter !== 'all' && (
  <div className="filter-chip">
    <span>Status: {statusFilter}</span>
    <button onClick={() => setStatusFilter('all')}>
      <XCircle className="h-3 w-3" />
    </button>
  </div>
)}
```

---

### Profile Card (Detail Page)

**Override Reason:** Detail page has unique card layout for tenant information.

```css
.profile-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;
}

.profile-section {
  margin-bottom: 24px;
}

.profile-section:last-child {
  margin-bottom: 0;
}

.profile-section-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--color-border);
}

.profile-field {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
}

.profile-field-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text-secondary);
}

.profile-field-value {
  font-size: 0.875rem;
  color: var(--color-text);
  text-align: right;
}

.profile-field-value.mono {
  font-family: var(--font-mono);
}
```

**Profile Sections:**
1. **Contact Information** - Name, Contact Number, Email
2. **Emergency Contact** - Name, Number
3. **Address** - Full address text

---

### Contract History Table (Detail Page)

**Override Reason:** Detail page has unique contract history display.

**Columns:**
1. **Contract ID** - DM Mono font, clickable link to contract detail
2. **Room** - room_number
3. **Move-In** - formatDateString(move_in_date)
4. **Expected Move-Out** - formatDateString(expected_move_out_date) or "—"
5. **Deposit** - formatPHP(deposit_amount)
6. **Status** - StatusBadge (active, ended, voided)

**Empty State:**
```jsx
<div className="table-empty">
  <p>This tenant has no contracts on file</p>
</div>
```

**Row Click Behavior:**
```javascript
const handleContractClick = (contractId) => {
  router.push(`/contracts/${contractId}`);
};
```

---

### Form Validation Rules

**Override Reason:** Tenants form has specific validation requirements.

**Required Fields:**
- First Name
- Last Name
- Contact Number

**Validation Patterns:**

```javascript
// Contact Number Validation (PH mobile format)
const contactPattern = /^(09\d{9}|(\+639)\d{9})$/;

const validateContactNumber = (value) => {
  if (!value) return "Contact number is required";
  if (!contactPattern.test(value)) {
    return "Enter a valid PH mobile number (e.g. 09XXXXXXXXX)";
  }
  return true;
};

// Email Validation
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validateEmail = (value) => {
  if (!value) return true; // Email is optional
  if (!emailPattern.test(value)) {
    return "Enter a valid email address";
  }
  return true;
};

// Emergency Contact Number Validation
const validateEmergencyContact = (value) => {
  if (!value) return true; // Emergency contact is optional
  if (!contactPattern.test(value)) {
    return "Enter a valid PH mobile number (e.g. 09XXXXXXXXX)";
  }
  return true;
};
```

**Form Submission:**
```javascript
const onSubmit = async (data) => {
  setIsSubmitting(true);
  try {
    const endpoint = isEditMode 
      ? `/api/tenants/${tenantId}` 
      : '/api/tenants';
    const method = isEditMode ? 'PUT' : 'POST';
    
    const response = await apiRequest(endpoint, {
      method,
      body: JSON.stringify(data),
    });
    
    // Show success toast
    toast.success(isEditMode ? 'Tenant updated successfully' : 'Tenant created successfully');
    
    // Navigate to detail page
    router.push(`/tenants/${response.tenant_id}`);
  } catch (error) {
    setError(error.message || 'Failed to save tenant');
  } finally {
    setIsSubmitting(false);
  }
};
```

---

### Status Information Panel (Edit Page Only)

**Override Reason:** Edit page has unique status display requirements.

```css
.status-info-panel {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 24px;
}

.status-info-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.status-indicator-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-indicator-dot.active {
  background: #065F46;  /* Emerald */
}

.status-indicator-dot.moved_out {
  background: #57534E;  /* Stone */
}

.status-info-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text);
}

.status-info-text {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  line-height: 1.5;
}
```

**Status Explanation Text:**
- **Active:** "This tenant has an active contract. Status is automatically managed by the system."
- **Moved Out:** "This tenant has moved out. Status is automatically updated when contracts end."
- **Archived:** "This tenant record is archived. Contact support to restore."

---

## Form Layout Rules

### Two-Column Field Layout

**Name Fields (First Name + Last Name):**
```css
.name-fields-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

@media (max-width: 768px) {
  .name-fields-grid {
    grid-template-columns: 1fr;
  }
}
```

### Single-Column Fields

All other fields stack vertically with 16px gap:
- Contact Number
- Email
- Emergency Contact Name
- Emergency Contact Number
- Address (textarea)

### Form Card Centering

```css
.form-container {
  max-width: 640px;
  margin: 0 auto;
  padding: 32px 16px;
}
```

---

## Animation Specifications

### Page Entrance (List Page)
```javascript
const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.2, ease: 'easeOut' }
};
```

### Table Row Stagger (List Page)
```javascript
const tableStagger = {
  animate: {
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.05
    }
  }
};

const tableRowVariants = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0 }
};

// Cap at 12 rows — rows 13+ appear instantly
```

### Skeleton Loaders (Detail Page)
```javascript
const skeletonVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.3 }
};
```

---

## Loading States

### List Page Loading
```jsx
{loading && (
  <div className="flex items-center justify-center py-12">
    <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
    <span className="ml-3 text-sm text-gray-600">Loading tenants...</span>
  </div>
)}
```

### Detail Page Loading
```jsx
{loading && (
  <div className="space-y-4">
    <div className="h-8 bg-gray-200 rounded animate-pulse w-1/3" />
    <div className="h-4 bg-gray-200 rounded animate-pulse w-1/4" />
    <div className="h-64 bg-gray-200 rounded animate-pulse" />
  </div>
)}
```

### Form Submitting State
```jsx
<button 
  type="submit" 
  disabled={isSubmitting}
  className="btn-primary"
>
  {isSubmitting ? (
    <>
      <Loader2 className="h-4 w-4 animate-spin mr-2" />
      Saving...
    </>
  ) : (
    'Save Tenant'
  )}
</button>
```

---

## Error Handling

### API Error Display
```jsx
{error && (
  <Alert variant="error" className="mb-6">
    <AlertCircle className="h-4 w-4" />
    <div>
      <p className="font-semibold">Failed to load tenant data</p>
      <p className="text-sm">{error}</p>
      <button onClick={handleRetry} className="btn-secondary mt-2">
        <RefreshCw className="h-4 w-4 mr-2" />
        Retry
      </button>
    </div>
  </Alert>
)}
```

### Form Validation Errors
```jsx
{errors.contact_number && (
  <p className="input-error-msg">
    {errors.contact_number.message}
  </p>
)}
```

### Form Submission Errors
```jsx
{submitError && (
  <Alert variant="error" className="mb-6">
    <AlertCircle className="h-4 w-4" />
    <div>
      <p className="font-semibold">Failed to save tenant</p>
      <p className="text-sm">{submitError}</p>
    </div>
  </Alert>
)}
```

---

## Unsaved Changes Warning

**Implementation:**
```javascript
import { useUnsavedChangesWarning } from '@/hooks/useUnsavedChangesWarning';

const { isDirty } = formState;
useUnsavedChangesWarning(isDirty && !isSubmitting);
```

**Warning Dialog:**
```
Title: "Unsaved Changes"
Message: "You have unsaved changes. Are you sure you want to leave?"
Actions: [Cancel] [Leave]
```

---

## Authorization and Permissions

### Permission Check
```javascript
import { canManageTenants } from '@/utils/permissions';

const canManage = canManageTenants(user);
```

### Read-Only Mode (List Page)
```jsx
{!canManage && (
  <Alert variant="info" className="mb-6">
    <Info className="h-4 w-4" />
    <p>You have read-only access to tenant records.</p>
  </Alert>
)}

<button 
  disabled={!canManage}
  className="btn-primary"
>
  + New Tenant
</button>
```

### Read-Only Mode (Form Page)
```jsx
{!canManage && (
  <Alert variant="info" className="mb-6">
    <Info className="h-4 w-4" />
    <p>You do not have permission to edit tenant records.</p>
  </Alert>
)}

<input 
  {...register('first_name')}
  disabled={!canManage}
  className="input"
/>
```

---

## Responsive Breakpoints

### Mobile (< 768px)
- Search input: full width
- Status filter: full width
- Table: horizontally scrollable
- Form: single column
- Name fields: stacked vertically

### Tablet (768px - 1024px)
- Search input: 320px fixed
- Status filter: 160px min-width
- Table: full width
- Form: centered 640px max-width
- Name fields: two columns

### Desktop (1024px+)
- Search input: 320px fixed
- Status filter: 160px min-width
- Table: full width
- Form: centered 640px max-width
- Name fields: two columns

---

## Accessibility Requirements

- [ ] All form inputs have associated labels
- [ ] Required fields marked with red asterisk
- [ ] Error messages linked to inputs via `aria-describedby`
- [ ] Table has `<caption>` or `aria-label`
- [ ] Status badges include text labels (not color-only)
- [ ] All interactive elements have `cursor: pointer`
- [ ] Focus rings visible on all interactive elements (3px teal)
- [ ] Keyboard navigation works for all forms and tables
- [ ] Animations respect `prefers-reduced-motion`
- [ ] Color contrast 4.5:1 minimum for all text

---

## Anti-Patterns (Tenants-Specific)

- ❌ **Using generic "id" field** — Always use `tenant_id`, `room_id`, `contract_id`
- ❌ **Displaying raw enum values** — Map to human labels (e.g., "Moved Out" not "moved_out")
- ❌ **Manual status editing** — Status is system-managed based on contracts
- ❌ **Missing contact number validation** — Must validate PH mobile format
- ❌ **Form without unsaved changes warning** — Always implement on edit forms
- ❌ **Table rows without click handler** — All rows should navigate to detail
- ❌ **Action links without stopPropagation** — Prevents double navigation
- ❌ **Empty state without helpful message** — Always provide next action guidance
- ❌ **Loading state without label** — Always specify what's loading

---

## Z-Index Scale

```css
:root {
  --z-base: 0;
  --z-dropdown: 10;
  --z-sticky: 20;
  --z-modal-backdrop: 30;
  --z-modal: 40;
  --z-toast: 50;
}
```

**Usage:**
- Table sticky header: `z-sticky` (20)
- Filter dropdowns: `z-dropdown` (10)
- Unsaved changes modal: `z-modal` (40)
- Success toast: `z-toast` (50)

---

*This document defines Tenants-specific design rules. For all other specifications, refer to `../MASTER.md`.*
