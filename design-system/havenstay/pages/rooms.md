# Rooms Page Design Specification

> **PROJECT:** HavenStay
> **Last Updated:** 2026-04-10
> **Page Type:** List / Detail / Form Pages
> **Routes:** `/rooms`, `/rooms/[id]`, `/rooms/new`, `/rooms/[id]/edit`

> ⚠️ **IMPORTANT:** Rules in this file **override** the Master file (`../MASTER.md`) for Rooms pages only.
> Only deviations from the Master are documented here. For all other rules, refer to the Master.

---

## Page Purpose

The Rooms pages manage room and bed space records across four views:

1. **Rooms List** (`/rooms`) - Browse all rooms with occupancy status
2. **Room Detail** (`/rooms/[id]`) - View room details and bed space assignments
3. **New Room Form** (`/rooms/new`) - Create new room records
4. **Edit Room Form** (`/rooms/[id]/edit`) - Update existing room information

**Design Philosophy:** Clarity, Speed, Trust — operators must quickly understand room occupancy, manage bed spaces, and track availability.

**Research Foundation (UI reasoning #17: Real Estate):**
- **Pattern**: Hero-Centric + Feature-Rich with property visualization
- **Color Mood**: Trust Blue + Gold + White for professional property management
- **Key Effects**: 3D property tour zoom + Map hover for spatial understanding
- **Decision Rules**: 
  - IF luxury: add-3d-models (not applicable for boarding house)
  - MUST HAVE: map-integration for room layout visualization
- **Anti-Patterns to AVOID**: 
  - Poor photos (ensure high-quality room images)
  - No virtual tours (provide clear room visualization)

---

## Database Schema Alignment

### Critical Data Keys

**Always use these exact field names:**

```typescript
interface Room {
  room_id: number;              // PRIMARY KEY
  room_number: string;          // Display identifier (e.g., "101", "A-1")
  floor: number | null;         // Floor number
  capacity: number;             // Total bed spaces in room
  monthly_rate: number;         // Base monthly rent per bed
  status: 'available' | 'occupied' | 'maintenance';  // ENUM
  description: string | null;   // Room features/amenities
  created_at: string;
  updated_at: string;
}

interface BedSpace {
  bed_space_id: number;         // PRIMARY KEY
  room_id: number;              // FOREIGN KEY
  bed_number: string;           // Identifier within room (e.g., "A", "1")
  status: 'available' | 'occupied';  // ENUM
  current_tenant_id: number | null;  // FOREIGN KEY (nullable)
}
```

**Status Enum Mapping:**
- Room: `available` → "Available" (badge-success), `occupied` → "Occupied" (badge-info), `maintenance` → "Maintenance" (badge-warning)
- Bed Space: `available` → "Available" (badge-success), `occupied` → "Occupied" (badge-info)

---

## Layout Structures

### Rooms List Page

```
[Page Header]
  [Breadcrumb: Rooms]                        [user@email · Role]
  [H1: Rooms]                                [+ New Room (btn-primary)]
  [Subtitle: Manage rooms and bed spaces]

[Filter Controls]
  [Status Filter Dropdown]  [Floor Filter Dropdown]  [Clear All]
  [Active Filter Chips]

[Room Cards Grid]
  3 columns on desktop, 2 on tablet, 1 on mobile
  Each card shows: room_number, capacity, occupancy, status, monthly_rate
```

### Room Detail Page

```
[Page Header]
  [Breadcrumb: Rooms / Room {room_number}]  [user@email · Role]
  [H1: Room {room_number}]                  [Edit Room (btn-primary)]
  [Status Badge]  [Floor Badge]

[Room Information Card]
  [Details Section: Capacity, Monthly Rate, Floor, Description]
  [Occupancy Progress Bar]

[Bed Spaces Table]
  Columns: Bed Number | Status | Current Tenant | Move-In Date | Actions
  
[Room History Timeline] (Optional future enhancement)
```

### New/Edit Room Form

```
[Page Header]
  [Breadcrumb: Rooms / New Room]            [user@email · Role]
  [H1: New Room]
  [Subtitle: * Required fields]

[Form Card (max-width: 640px centered)]
  [Room Information Section]
    - Room Number * | Floor
    - Capacity * | Monthly Rate *
    - Description (textarea)
  
  [Status Section] (Edit only)
    - Current Status (read-only with explanation)
  
  [Form Actions]
    [Cancel (btn-secondary)]  [Save Room (btn-primary)]
```

---

## Component Overrides

### Room Card Specifications

**Override Reason:** Rooms list uses card grid layout instead of table for better visual hierarchy.

```css
.room-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 20px;
  transition: box-shadow 150ms ease, border-color 150ms ease;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.room-card:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.06);
  border-color: var(--color-border-strong);
}

.room-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.room-card-number {
  font-size: 1.25rem;           /* 20px */
  font-weight: 600;
  color: var(--color-text);
  font-family: var(--font-mono);
}

.room-card-status {
  /* StatusBadge component */
}

.room-card-details {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.room-card-detail-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.875rem;
}

.room-card-detail-label {
  color: var(--color-text-secondary);
}

.room-card-detail-value {
  color: var(--color-text);
  font-weight: 500;
}

.room-card-detail-value.amount {
  font-family: var(--font-mono);
  color: var(--color-primary);
}

.room-card-occupancy {
  margin-top: 8px;
}

.room-card-occupancy-label {
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-secondary);
  margin-bottom: 6px;
}

.room-card-occupancy-bar {
  background: var(--color-bg);
  height: 6px;
  border-radius: 999px;
  overflow: hidden;
}

.room-card-occupancy-fill {
  height: 100%;
  background: var(--color-primary);
  transition: width 400ms cubic-bezier(0.34, 1.56, 0.64, 1);
}

.room-card-occupancy-text {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  margin-top: 4px;
}
```

**Room Card Content:**
- **Header**: Room number (large, mono font) + Status badge
- **Details**: 
  - Capacity: "X beds"
  - Floor: "Floor X" or "—"
  - Monthly Rate: formatPHP(monthly_rate) per bed
- **Occupancy**: Progress bar showing occupied/total beds with text "X of Y occupied"

---

### Bed Spaces Table (Detail Page)

**Override Reason:** Room detail page has unique bed space management table.

**Columns:**
1. **Bed Number** - bed_number, DM Mono font, 14px
2. **Status** - StatusBadge component
3. **Current Tenant** - tenant name (clickable link) or "—"
4. **Move-In Date** - formatDateString(contract.move_in_date) or "—"
5. **Actions** - "Assign Tenant" link (if available) or "View Contract" (if occupied)

**Empty State:**
```jsx
<div className="table-empty">
  <p>No bed spaces configured</p>
  <p className="text-sm">Add bed spaces to this room to track occupancy</p>
</div>
```

**Row Click Behavior:**
```javascript
// Clicking bed row navigates to tenant detail if occupied
const handleBedClick = (bedSpace) => {
  if (bedSpace.current_tenant_id) {
    router.push(`/tenants/${bedSpace.current_tenant_id}`);
  }
};
```

---

### Room Information Card (Detail Page)

**Override Reason:** Detail page has unique card layout for room information.

```css
.room-info-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;
}

.room-info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}

@media (max-width: 768px) {
  .room-info-grid {
    grid-template-columns: 1fr;
  }
}

.room-info-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.room-info-label {
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-secondary);
}

.room-info-value {
  font-size: 1rem;
  color: var(--color-text);
  font-weight: 500;
}

.room-info-value.amount {
  font-family: var(--font-mono);
  color: var(--color-primary);
  font-size: 1.125rem;
}

.room-info-description {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--color-border);
}

.room-info-description-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 8px;
}

.room-info-description-text {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  line-height: 1.6;
}
```

---

### Form Validation Rules

**Override Reason:** Rooms form has specific validation requirements.

**Required Fields:**
- Room Number
- Capacity
- Monthly Rate

**Validation Patterns:**

```javascript
// Room Number Validation
const validateRoomNumber = (value) => {
  if (!value) return "Room number is required";
  if (value.length > 10) return "Room number must be 10 characters or less";
  return true;
};

// Capacity Validation
const validateCapacity = (value) => {
  if (!value) return "Capacity is required";
  const num = Number(value);
  if (!Number.isInteger(num) || num < 1) {
    return "Capacity must be a positive integer";
  }
  if (num > 20) return "Capacity cannot exceed 20 beds";
  return true;
};

// Monthly Rate Validation
const validateMonthlyRate = (value) => {
  if (!value) return "Monthly rate is required";
  const num = Number(value);
  if (isNaN(num) || num <= 0) {
    return "Monthly rate must be a positive number";
  }
  if (num > 100000) return "Monthly rate seems unusually high";
  return true;
};

// Floor Validation (optional field)
const validateFloor = (value) => {
  if (!value) return true; // Optional
  const num = Number(value);
  if (!Number.isInteger(num)) {
    return "Floor must be an integer";
  }
  if (num < 0 || num > 50) return "Floor must be between 0 and 50";
  return true;
};
```

---

### Filter Controls

**Override Reason:** Rooms page has specific filter requirements.

```css
.filter-container {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.status-filter {
  min-width: 160px;
}

.floor-filter {
  min-width: 140px;
}

@media (max-width: 768px) {
  .filter-container {
    flex-direction: column;
  }
  
  .status-filter,
  .floor-filter {
    width: 100%;
  }
}
```

**Filter Behavior:**
```javascript
// Filter by status and floor
const filteredRooms = useMemo(() => {
  return rooms.filter(room => {
    const matchesStatus = statusFilter === 'all' || room.status === statusFilter;
    const matchesFloor = floorFilter === 'all' || room.floor === Number(floorFilter);
    return matchesStatus && matchesFloor;
  });
}, [rooms, statusFilter, floorFilter]);
```

---

## Occupancy Calculations

### Room Occupancy Percentage

```javascript
const occupancyPercentage = (occupiedBeds, totalCapacity) => {
  if (totalCapacity === 0) return 0;
  return Math.round((occupiedBeds / totalCapacity) * 100);
};

// Occupied beds count from bed_spaces table
const occupiedBeds = bedSpaces.filter(b => b.status === 'occupied').length;
```

### Room Status Logic

```javascript
// Room status is derived from bed space occupancy
const deriveRoomStatus = (room, bedSpaces) => {
  if (room.status === 'maintenance') return 'maintenance';
  
  const occupiedCount = bedSpaces.filter(b => b.status === 'occupied').length;
  
  if (occupiedCount === 0) return 'available';
  if (occupiedCount === room.capacity) return 'occupied';
  return 'occupied'; // Partially occupied still shows as occupied
};
```

---

## API Integration

### Endpoints Used

1. **GET `/api/rooms`** - All room records with capacity and status
2. **GET `/api/rooms/[id]`** - Single room with bed spaces
3. **GET `/api/bed-spaces?room_id=[id]`** - Bed spaces for specific room
4. **POST `/api/rooms`** - Create new room
5. **PUT `/api/rooms/[id]`** - Update room
6. **DELETE `/api/rooms/[id]`** - Delete room (if no active contracts)

### Error Handling

**Display inline error alert with retry button:**
```jsx
{error && (
  <Alert variant="error" className="mb-6">
    <AlertCircle className="h-4 w-4" />
    <div>
      <p className="font-semibold">Failed to load room data</p>
      <p className="text-sm">{error}</p>
      <button onClick={handleRetry} className="btn-secondary mt-2">
        <RefreshCw className="h-4 w-4 mr-2" />
        Retry
      </button>
    </div>
  </Alert>
)}
```

---

## Animation Specifications

### Page Entrance
```javascript
const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.2, ease: 'easeOut' }
};
```

### Room Card Stagger
```javascript
const cardStagger = {
  animate: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1
    }
  }
};

const cardVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 }
};
```

---

## Responsive Breakpoints

### Mobile (< 768px)
- Room cards: single column
- Filters: stacked vertically
- Bed spaces table: horizontally scrollable

### Tablet (768px - 1024px)
- Room cards: 2-column grid
- Filters: horizontal row

### Desktop (1024px+)
- Room cards: 3-column grid
- Filters: horizontal row

---

## Accessibility Requirements

- [ ] All room cards have aria-label describing room
- [ ] Bed spaces table has <caption> or aria-label
- [ ] Status badges do not rely on color alone
- [ ] All animations respect prefers-reduced-motion
- [ ] Color contrast 4.5:1 minimum for all text
- [ ] Keyboard navigation works for all interactive elements
- [ ] Touch targets minimum 44x44px on mobile

---

## Anti-Patterns (Rooms-Specific)

- ❌ **Using generic "id" field** — Always use `room_id`, `bed_space_id`
- ❌ **Displaying raw enum values** — Map to human labels
- ❌ **Manual status editing without validation** — Status should reflect actual occupancy
- ❌ **Missing capacity validation** — Must validate positive integer
- ❌ **Table layout on mobile** — Use card grid for better mobile UX
- ❌ **No occupancy visualization** — Always show progress bar
- ❌ **Empty state without guidance** — Provide next action

---

*This document defines Rooms-specific design rules. For all other specifications, refer to `../MASTER.md`.*
