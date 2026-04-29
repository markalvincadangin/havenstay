<?php

namespace App\Enums;

/**
 * RoleEnum
 *
 * Defines authoritative system access levels for operators.
 */
enum RoleEnum: string
{
    case ADMIN = 'admin';
    case STAFF = 'staff';
    case VIEWER = 'viewer';
}
