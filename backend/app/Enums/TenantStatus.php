<?php

namespace App\Enums;

/**
 * TenantStatus Enum
 *
 * Defines the operational status of a tenant profile.
 */
enum TenantStatus: string
{
    case ONBOARDED = 'onboarded';
    case ACTIVE = 'active';
    case MOVED_OUT = 'moved_out';
    case ARCHIVED = 'archived';
}
