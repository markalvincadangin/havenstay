# HavenStay Page-Specific Design Specifications

This directory contains page-specific design overrides that supplement the Master design system file (`../MASTER.md`).

## Purpose

Page-specific files document **only the deviations** from the Master design system. They provide:
- Unique component specifications not covered in the Master
- Page-specific layout patterns
- Custom data calculations and API integrations
- Specialized interaction behaviors
- Page-specific validation rules

## Usage Logic

```
When building a page:
1. First, check if a page-specific file exists in this directory
2. If it exists, apply its rules (they OVERRIDE the Master)
3. For everything not specified in the page file, follow the Master
4. The Master file is the fallback for all unspecified rules
```

## Available Page Specifications

### Dashboard (`dashboard.md`)
**Routes:** `/dashboard`

**Key Overrides:**
- KPI card styling (unique label/value sizing, decorative circles, progress bars)
- Due Today table structure and empty state
- Quick Links panel component
- Financial and occupancy metric calculations
- API fallback logic for occupancy data

**When to Reference:**
- Building or modifying dashboard KPI cards
- Implementing financial metric calculations
- Styling the Due Today table
- Handling dashboard-specific API errors

---

### Tenants (`tenants.md`)
**Routes:** `/tenants`, `/tenants/[id]`, `/tenants/new`, `/tenants/[id]/edit`

**Key Overrides:**
- Database schema alignment (tenant_id, room_id, contract_id)
- Status enum mapping (active, moved_out, archived)
- Search and filter controls
- Profile card layout (detail page)
- Contract history table (detail page)
- Form validation rules (PH mobile format)
- Status information panel (edit page)
- Unsaved changes warning

**When to Reference:**
- Building or modifying tenant list, detail, or form pages
- Implementing tenant search and filtering
- Validating contact numbers
- Displaying tenant status
- Handling tenant-specific API errors

---

## File Structure

Each page-specific file follows this structure:

```markdown
# [Page Name] Design Specification

> Metadata (project, date, routes)
> Override warning

## Page Purpose
Brief description of the page's role and goals

## Layout Structure
Visual representation of page sections

## Component Overrides
Detailed specifications for page-specific components

## Data Calculations
Formulas and logic for page-specific metrics

## API Integration
Endpoints, fallback logic, error handling

## Animation Specifications
Page-specific motion patterns

## Responsive Breakpoints
Mobile, tablet, desktop behaviors

## Accessibility Requirements
Page-specific a11y checklist

## Anti-Patterns
Page-specific things to avoid

## Z-Index Scale
Page-specific layering rules
```

---

## Design System Hierarchy

```
MASTER.md (Foundation)
    ↓
    Defines global rules:
    - Color system
    - Typography
    - Spacing
    - Component base styles
    - Interaction patterns
    - Accessibility standards
    
    ↓
    
pages/[page-name].md (Overrides)
    ↓
    Defines page-specific rules:
    - Unique component variants
    - Page-specific layouts
    - Custom calculations
    - Specialized behaviors
```

---

## When to Create a New Page File

Create a page-specific file when:

1. **Unique Component Variants** - The page needs component styling that differs from the Master
2. **Complex Data Logic** - The page has calculations or transformations not covered elsewhere
3. **Specialized Interactions** - The page has unique user flows or behaviors
4. **Custom Validation** - The page has form validation rules specific to its domain
5. **API Integration Patterns** - The page has unique API handling or fallback logic

**Do NOT create a page file if:**
- The page follows all Master specifications without deviation
- The only differences are content/copy changes
- The page is a simple variation of an existing pattern

---

## Maintenance Guidelines

### Updating Page Files

1. **Document the reason** - Always explain WHY an override exists
2. **Reference the Master** - Link to Master sections being overridden
3. **Keep it minimal** - Only document deviations, not repetitions
4. **Update timestamps** - Change "Last Updated" date when modifying
5. **Test thoroughly** - Verify overrides don't break Master patterns

### Reviewing Page Files

Before approving a page file update:
- [ ] Overrides are justified and necessary
- [ ] Master file is referenced for context
- [ ] Code examples are accurate and tested
- [ ] Accessibility requirements are maintained
- [ ] Responsive behaviors are specified
- [ ] Anti-patterns are documented

---

## Quick Reference

| Page | File | Primary Overrides |
|------|------|-------------------|
| Dashboard | `dashboard.md` | KPI cards, Due Today table, Quick Links, financial calculations |
| Tenants | `tenants.md` | Database keys, status mapping, search/filter, form validation |

---

## Contributing

When adding a new page specification:

1. Copy the template structure from an existing page file
2. Fill in all required sections
3. Document only the deviations from the Master
4. Include code examples for complex overrides
5. Add the page to the Quick Reference table above
6. Update this README with the new page entry

---

*For global design system rules, always refer to `../MASTER.md` first.*
