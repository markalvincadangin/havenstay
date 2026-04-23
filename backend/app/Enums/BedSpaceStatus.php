<?php

namespace App\Enums;

/**
 * BedSpaceStatus Enum
 *
 * Defines the availability and maintenance status of an individual bed space asset.
 */
enum BedSpaceStatus: string
{
    case VACANT = 'vacant';
    case OCCUPIED = 'occupied';
    case MAINTENANCE = 'maintenance';
}
