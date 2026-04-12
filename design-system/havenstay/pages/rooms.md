# Room Inventory Design Specification — v4.3 (Master-Aligned)

> **PROJECT:** HavenStay Boarding House Management System (BHMS)
> **Last Updated:** 2026-04-12
> **Page Type:** Inventory / Detail / Form Pages
> **Routes:** `/rooms`, `/rooms/[id]`, `/rooms/new`, `/rooms/[id]/edit`

> ⚠️ **IMPORTANT:** Rules in this file **override** the Master file (`../MASTER.md`) for Rooms pages only.
> Only deviations from the Master are documented here. For all other rules, refer to the Master.

---

## 1. Page Purpose

The Room Inventory manages real-time property capacity across four views:

1. **Room Inventory** (`/rooms`) - Browse room capacity and occupancy status.
2. **Room Details** (`/rooms/[id]`) - View specific unit profile and bed assignments.
3. **Register unit** (`/rooms/new`) - Create new unit record.
4. **Update unit** (`/rooms/[id]/edit`) - Modify existing room information.

**Design Philosophy:** Clarity, Speed, Trust — operators must quickly understand unit availability and maintenance states.

---

## 2. Layout Structure (Master §4)

### 2.1 Rooms List Page (`/rooms`)
1.  **Page Header**: `Room Inventory` with "Register Unit" Primary CTA.
2.  **Summary KPIs**: 3-column `KpiCard` grid (Total Beds, Vacancies, Revenue).
3.  **Filter Hub**: `Registry Card` with strip title **Filters** (**MASTER §5.8.3**).
4.  **Unit Grid**: Standard `room-card` grid (§112).

### 2.2 Room Detail Page (`/rooms/[id]`)
1.  **Page Header**: `Unit {room_code}` with "Update Details" Secondary action.
2.  **Status Well**: Standard `StatusBadge`.
3.  **Split View**:
    - **Sidebar (4)**: Room Profile (Monthly Rate, Floor, Amenities).
    - **Main (8)**: Bed Assignments table with occupancy progress.

### 2.3 Unit Registration Form
1.  **Form Shell**: Centered `max-w-4xl` column containing `PageHeader` and `Registry Cards`.  
  [Cancel] [Save Changes / Register Room]
```
tn-primary)]
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
