<?php

namespace App\Services\Identity;

use App\Models\Role;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;

/**
 * Centralized authorization authority. Enforces role-based access control (RBAC)
 * and provides 'ensure' methods for global forensic auditing.
 */
class AuthorizationService
{
    /**
     * Resolve the authenticated user's role as a lowercase string.
     * Returns '' when the user has no assigned role (safe default: denies all access).
     *
     * Precondition: $user is non-null — all public methods guard for null before calling this.
     */
    private static function resolveRoleName(User $user): string
    {
        $user->loadMissing('role');

        return strtolower($user->role?->role_name ?? '');
    }

    /**
     * Ensure the user has permission, otherwise throw an AuthorizationException.
     * This is caught by the global handler in bootstrap/app.php for forensic logging.
     *
     * @throws AuthorizationException
     */
    private static function ensure(bool $condition, string $message = 'Forbidden.'): void
    {
        if (! $condition) {
            throw new AuthorizationException($message);
        }
    }

    public static function canManageRooms(?User $user): bool
    {
        if (! $user) return false;

        return in_array(self::resolveRoleName($user), [Role::ADMIN, Role::STAFF], true);
    }

    public static function canManageUsers(?User $user): bool
    {
        if (! $user) return false;

        return self::resolveRoleName($user) === Role::ADMIN;
    }

    public static function canManageTenants(?User $user): bool
    {
        if (! $user) return false;

        return in_array(self::resolveRoleName($user), [Role::ADMIN, Role::STAFF], true);
    }

    public static function canViewTenants(?User $user): bool
    {
        if (! $user) return false;

        return in_array(self::resolveRoleName($user), [Role::ADMIN, Role::STAFF, Role::VIEWER], true);
    }

    public static function canManageContracts(?User $user): bool
    {
        if (! $user) return false;

        return in_array(self::resolveRoleName($user), [Role::ADMIN, Role::STAFF], true);
    }

    public static function canViewContracts(?User $user): bool
    {
        if (! $user) return false;

        return in_array(self::resolveRoleName($user), [Role::ADMIN, Role::STAFF, Role::VIEWER], true);
    }

    public static function canManageBilling(?User $user): bool
    {
        if (! $user) return false;

        return in_array(self::resolveRoleName($user), [Role::ADMIN, Role::STAFF], true);
    }

    public static function canViewBilling(?User $user): bool
    {
        if (! $user) return false;

        return in_array(self::resolveRoleName($user), [Role::ADMIN, Role::STAFF, Role::VIEWER], true);
    }

    public static function canManagePayments(?User $user): bool
    {
        if (! $user) return false;

        return in_array(self::resolveRoleName($user), [Role::ADMIN, Role::STAFF], true);
    }

    public static function canViewCompliance(?User $user): bool
    {
        if (! $user) return false;

        return in_array(self::resolveRoleName($user), [Role::ADMIN, Role::STAFF, Role::VIEWER], true);
    }

    public static function canManageCompliance(?User $user): bool
    {
        if (! $user) return false;

        return in_array(self::resolveRoleName($user), [Role::ADMIN, Role::STAFF], true);
    }

    public static function canViewReports(?User $user): bool
    {
        if (! $user) return false;

        return in_array(self::resolveRoleName($user), [Role::ADMIN, Role::STAFF, Role::VIEWER], true);
    }

    public static function ensureCanManageRooms(?User $user): void
    {
        self::ensure(self::canManageRooms($user), 'Unauthorized to manage rooms.');
    }

    public static function ensureCanManageUsers(?User $user): void
    {
        self::ensure(self::canManageUsers($user), 'Unauthorized to manage users.');
    }

    public static function ensureCanManageTenants(?User $user): void
    {
        self::ensure(self::canManageTenants($user), 'Unauthorized to manage tenants.');
    }

    public static function ensureCanViewTenants(?User $user): void
    {
        self::ensure(self::canViewTenants($user), 'Unauthorized to view tenants.');
    }

    public static function ensureCanManageContracts(?User $user): void
    {
        self::ensure(self::canManageContracts($user), 'Unauthorized to manage contracts.');
    }

    public static function ensureCanViewContracts(?User $user): void
    {
        self::ensure(self::canViewContracts($user), 'Unauthorized to view contracts.');
    }

    public static function ensureCanManageBilling(?User $user): void
    {
        self::ensure(self::canManageBilling($user), 'Unauthorized to manage billing.');
    }

    public static function ensureCanViewBilling(?User $user): void
    {
        self::ensure(self::canViewBilling($user), 'Unauthorized to view billing.');
    }

    public static function ensureCanManagePayments(?User $user): void
    {
        self::ensure(self::canManagePayments($user), 'Unauthorized to manage payments.');
    }

    public static function ensureCanViewCompliance(?User $user): void
    {
        self::ensure(self::canViewCompliance($user), 'Unauthorized to view compliance registry.');
    }

    public static function ensureCanManageCompliance(?User $user): void
    {
        self::ensure(self::canManageCompliance($user), 'Unauthorized to manage compliance registry.');
    }

    public static function ensureCanViewReports(?User $user): void
    {
        self::ensure(self::canViewReports($user), 'Unauthorized to view reports.');
    }
}
