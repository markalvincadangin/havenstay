<?php

namespace App\Enums;

/**
 * MeterStatus Enum
 *
 * Defines the operational lifecycle of a utility meter asset.
 */
enum MeterStatus: string
{
    case ACTIVE = 'active';
    case MAINTENANCE = 'maintenance';
    case REPLACED = 'replaced';
}
