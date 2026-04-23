<?php
 
 namespace App\Services\Core;
 
 use App\Models\User;
 use App\Enums\RoleEnum;
 use Illuminate\Auth\Access\AuthorizationException;
 
 /**
  * Core Forensic Authorization Service
  * 
  * The central authority for RBAC sovereignty. Enforces role-based permissions
  * and ensures that all unauthorized attempts are logged for forensic review.
  * Optimized for HavenStay Forensic v5.0 with Native Enum Support.
  */
 class AuthorizationService
 {
     /**
      * Resolve the authenticated user's role as a typed Enum.
      * 
      * @param User $user
      * @return RoleEnum|null
      */
     private static function resolveRole(User $user): ?RoleEnum
     {
         $user->loadMissing('role');
         return RoleEnum::tryFrom(strtolower($user->role?->role_name ?? ''));
     }
 
     /**
      * Internal assertion: Ensures a condition is met, otherwise throws a logged exception.
      * 
      * @param bool $condition
      * @param string $message
      * @return void
      * @throws AuthorizationException
      */
     private static function ensure(bool $condition, string $message = 'Forbidden.'): void
     {
         if (! $condition) {
             throw new AuthorizationException($message);
         }
     }
 
     // ── RBAC RULESET ──
 
     /**
      * Authorized: Admin, Staff.
      */
     public static function canManageRooms(?User $user): bool
     {
         if (! $user) return false;
         $role = self::resolveRole($user);
         return in_array($role, [RoleEnum::ADMIN, RoleEnum::STAFF], true);
     }
 
     /**
      * Authorized: Admin.
      */
     public static function canManageUsers(?User $user): bool
     {
         if (! $user) return false;
         return self::resolveRole($user) === RoleEnum::ADMIN;
     }
 
     /**
      * Authorized: Admin.
      */
     public static function canViewAuditLogs(?User $user): bool
     {
         if (! $user) return false;
         return self::resolveRole($user) === RoleEnum::ADMIN;
     }
 
     /**
      * Authorized: Admin, Staff.
      */
     public static function canManageTenants(?User $user): bool
     {
         if (! $user) return false;
         $role = self::resolveRole($user);
         return in_array($role, [RoleEnum::ADMIN, RoleEnum::STAFF], true);
     }
 
     /**
      * Authorized: Admin, Staff, Viewer.
      */
     public static function canViewTenants(?User $user): bool
     {
         if (! $user) return false;
         $role = self::resolveRole($user);
         return in_array($role, [RoleEnum::ADMIN, RoleEnum::STAFF, RoleEnum::VIEWER], true);
     }
 
     /**
      * Authorized: Admin, Staff.
      */
     public static function canManageContracts(?User $user): bool
     {
         if (! $user) return false;
         $role = self::resolveRole($user);
         return in_array($role, [RoleEnum::ADMIN, RoleEnum::STAFF], true);
     }
 
     /**
      * Authorized: Admin, Staff, Viewer.
      */
     public static function canViewContracts(?User $user): bool
     {
         if (! $user) return false;
         $role = self::resolveRole($user);
         return in_array($role, [RoleEnum::ADMIN, RoleEnum::STAFF, RoleEnum::VIEWER], true);
     }
 
     /**
      * Authorized: Admin, Staff.
      */
     public static function canManageBilling(?User $user): bool
     {
         if (! $user) return false;
         $role = self::resolveRole($user);
         return in_array($role, [RoleEnum::ADMIN, RoleEnum::STAFF], true);
     }
 
     /**
      * Authorized: Admin, Staff, Viewer.
      */
     public static function canViewBilling(?User $user): bool
     {
         if (! $user) return false;
         $role = self::resolveRole($user);
         return in_array($role, [RoleEnum::ADMIN, RoleEnum::STAFF, RoleEnum::VIEWER], true);
     }
 
     /**
      * Authorized: Admin, Staff.
      */
     public static function canManagePayments(?User $user): bool
     {
         if (! $user) return false;
         $role = self::resolveRole($user);
         return in_array($role, [RoleEnum::ADMIN, RoleEnum::STAFF], true);
     }
 
     /**
      * Authorized: Admin, Staff, Viewer.
      */
     public static function canViewPayments(?User $user): bool
     {
         if (! $user) return false;
         $role = self::resolveRole($user);
         return in_array($role, [RoleEnum::ADMIN, RoleEnum::STAFF, RoleEnum::VIEWER], true);
     }
 
     /**
      * Authorized: Admin, Staff, Viewer.
      */
     public static function canViewMetrology(?User $user): bool
     {
         if (! $user) return false;
         $role = self::resolveRole($user);
         return in_array($role, [RoleEnum::ADMIN, RoleEnum::STAFF, RoleEnum::VIEWER], true);
     }
 
     /**
      * Authorized: Admin, Staff.
      */
     public static function canManageMetrology(?User $user): bool
     {
         if (! $user) return false;
         $role = self::resolveRole($user);
         return in_array($role, [RoleEnum::ADMIN, RoleEnum::STAFF], true);
     }
 
    /**
     * Authorized: Admin, Staff, Viewer.
     */
    public static function canViewRooms(?User $user): bool
    {
        if (! $user) return false;
        $role = self::resolveRole($user);
        return in_array($role, [RoleEnum::ADMIN, RoleEnum::STAFF, RoleEnum::VIEWER], true);
    }

    /**
     * Authorized: Admin.
     */
    public static function canViewReports(?User $user): bool
    {
        if (! $user) return false;
        return self::resolveRole($user) === RoleEnum::ADMIN;
    }

    // ── ASSERTION LAYER (Injected into Controllers) ──

    /**
     * @throws AuthorizationException
     */
    public static function ensureCanViewRooms(?User $user): void
    {
        self::ensure(self::canViewRooms($user), 'Unauthorized to view room listings.');
    }

    /**
     * @throws AuthorizationException
     */
    public static function ensureCanManageRooms(?User $user): void
    {
        self::ensure(self::canManageRooms($user), 'Unauthorized to manage rooms.');
    }
 
     /**
      * @throws AuthorizationException
      */
     public static function ensureCanManageUsers(?User $user): void
     {
         self::ensure(self::canManageUsers($user), 'Unauthorized to manage users.');
     }
 
     /**
      * @throws AuthorizationException
      */
     public static function ensureCanViewAuditLogs(?User $user): void
     {
         self::ensure(self::canViewAuditLogs($user), 'Unauthorized to inspect audit logs. Forensic records are restricted to System Administrators.');
     }
 
     /**
      * @throws AuthorizationException
      */
     public static function ensureCanManageTenants(?User $user): void
     {
         self::ensure(self::canManageTenants($user), 'Unauthorized to manage tenants.');
     }
 
     /**
      * @throws AuthorizationException
      */
     public static function ensureCanViewTenants(?User $user): void
     {
         self::ensure(self::canViewTenants($user), 'Unauthorized to view tenants.');
     }
 
     /**
      * @throws AuthorizationException
      */
     public static function ensureCanManageContracts(?User $user): void
     {
         self::ensure(self::canManageContracts($user), 'Unauthorized to manage contracts.');
     }
 
     /**
      * @throws AuthorizationException
      */
     public static function ensureCanViewContracts(?User $user): void
     {
         self::ensure(self::canViewContracts($user), 'Unauthorized to view contracts.');
     }
 
     /**
      * @throws AuthorizationException
      */
     public static function ensureCanManageBilling(?User $user): void
     {
         self::ensure(self::canManageBilling($user), 'Unauthorized to manage billing.');
     }
 
     /**
      * @throws AuthorizationException
      */
     public static function ensureCanViewBilling(?User $user): void
     {
         self::ensure(self::canViewBilling($user), 'Unauthorized to view billing.');
     }
 
     /**
      * @throws AuthorizationException
      */
     public static function ensureCanManagePayments(?User $user): void
     {
         self::ensure(self::canManagePayments($user), 'Unauthorized to manage payments.');
     }
 
     /**
      * @throws AuthorizationException
      */
     public static function ensureCanViewPayments(?User $user): void
     {
         self::ensure(self::canViewPayments($user), 'Unauthorized to view payments.');
     }
 
     /**
      * @throws AuthorizationException
      */
     public static function ensureCanViewMetrology(?User $user): void
     {
         self::ensure(self::canViewMetrology($user), 'Unauthorized to view metrology data.');
     }
 
     /**
      * @throws AuthorizationException
      */
     public static function ensureCanViewMeters(?User $user): void
     {
         self::ensureCanViewMetrology($user);
     }
 
     /**
      * @throws AuthorizationException
      */
     public static function ensureCanManageMetrology(?User $user): void
     {
         self::ensure(self::canManageMetrology($user), 'Unauthorized to manage metrology assets or readings.');
     }
 
     /**
      * @throws AuthorizationException
      */
     public static function ensureCanManageMeters(?User $user): void
     {
         self::ensureCanManageMetrology($user);
     }
 
     /**
      * @throws AuthorizationException
      */
     public static function ensureCanViewReports(?User $user): void
     {
         self::ensure(self::canViewReports($user), 'Unauthorized to view reports.');
     }
 }
