<?php

namespace App\Enums;

/**
 * RoomStatus Enum
 *
 * Defines the operational and maintenance states of a room.
 * Synchronized with v4.6 Forensic Schema.
 */
enum RoomStatus: string
{
    case AVAILABLE = 'available';
    case UNAVAILABLE = 'unavailable';
    case MAINTENANCE = 'maintenance';
}
