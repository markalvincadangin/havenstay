<?php

namespace App\Services;

use App\Models\User;

class AuthorizationService
{
    private static function roleName(User $user): ?string
    {
        $user->loadMissing('role');

        return $user->role?->role_name;
    }

    public static function canManageRooms(User $user): bool
    {
        $role = strtolower(self::roleName($user));

        return in_array($role, ['admin', 'staff'], true);
    }

    public static function canManageUsers(User $user): bool
    {
        return strtolower(self::roleName($user)) === 'admin';
    }

    public static function canManageTenants(User $user): bool
    {
        $role = strtolower(self::roleName($user));

        return in_array($role, ['admin', 'staff'], true);
    }

    public static function canViewTenants(User $user): bool
    {
        $role = strtolower(self::roleName($user));

        return in_array($role, ['admin', 'staff', 'viewer'], true);
    }

    public static function canEditTenants(User $user): bool
    {
        return self::canManageTenants($user);
    }


    public static function canManageContracts(User $user): bool
    {
        $role = strtolower(self::roleName($user));

        return in_array($role, ['admin', 'staff'], true);
    }

    public static function canViewContracts(User $user): bool
    {
        $role = strtolower(self::roleName($user));

        return in_array($role, ['admin', 'staff', 'viewer'], true);
    }

    public static function canManageBilling(User $user): bool
    {
        $role = strtolower(self::roleName($user));

        return in_array($role, ['admin', 'staff'], true);
    }

    public static function canViewBilling(User $user): bool
    {
        $role = strtolower(self::roleName($user));

        return in_array($role, ['admin', 'staff', 'viewer'], true);
    }

    public static function canViewReports(User $user): bool
    {
        $role = strtolower(self::roleName($user));

        return in_array($role, ['admin', 'staff', 'viewer'], true);
    }
}
