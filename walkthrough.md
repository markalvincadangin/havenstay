# Walkthrough - User Module Lifecycle Standardization

Standardized the User module lifecycle to align with the forensic design system. This refactor separates operational attributes from account status transitions and implements high-friction security guards for destructive actions.

## Changes Made

### Backend
- **UserService**:
    - Refactored `listPaginated` to support `account_status` filtering (Active, Inactive, Archived).
    - Added `summary()` method providing system-wide user counts (Total, Active, Inactive, Archived, Admins).
    - Implemented service-level self-archival protection (BR-GEN-009).
- **UserController**: Added `GET /api/users/summary` endpoint.
- **Routes**: Registered `summary` route before wildcards in `api.php`.

### Frontend
- **Constants & Primitives**:
    - Added `archived` to account status labels.
    - Fixed `inactive` mapping in `StatusBadge.js` (Variant: `neutral`, Label: `Inactive`).
    - Extended `LifecycleActions.js` with `mode="user"` supporting deactivation/reactivation/archival/restoration.
- **Components**:
    - **UserQuickEditForm.js**: Removed the `is_active` checkbox to prevent accidental state changes during profile updates.
- **Pages**:
    - **Users List Page**:
        - Integrated system-wide KPI cards (Total, Active, Inactive, Admins).
        - Split lifecycle logic into directional handlers (`handleDeactivate`, `handleReactivate`).
        - Implemented username-based confirmation for deactivation and single-click for reactivation.
        - Added grayscale/muted visual treatment for archived account cards.
    - **User Detail Page**:
        - Added `LifecycleActions` to the header.
        - Implemented `RecordStateAlert` for Inactive and Archived states.
        - Guarded "Edit User" button against archived or self-editing accounts.

### Documentation
- Added **BR-GEN-009** to `BUSINESS_RULES.md` prohibiting self-account state changes.

### KPIs & Verification
Verified that user counts in the list page header match the system-wide database state. Fixed a runtime error in `UserDetailPage` caused by an incorrect import of `RecordStateAlert`.

Fixed an SWR request failure by updating `IndexUserRequest` to include `archived` in the allowed status validation rules. Also corrected a backend linter warning in `UserService` regarding the `ValidationException` constructor.

Fixed an issue where the "Restore Account" button was not appearing for archived users by adding `deleted_at` to `UserResource`. Polished the `UserDetailPage` to include an "Archived" status badge and optimized state transitions using SWR's `mutate()`.

### Lifecycle Friction
- **Deactivation**: Confirmed that typing the username is required to deactivate an account.
- **Reactivation**: Confirmed that reactivation is a seamless, single-click confirmation.
- **Archival**: Confirmed that archived users are visible only under the "Archived" filter and appear with muted visuals.

### Security Guards
Verified that `isSelf` accounts cannot be deactivated, archived, or edited via the detail page.
