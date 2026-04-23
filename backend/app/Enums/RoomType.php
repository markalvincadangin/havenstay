<?php

namespace App\Enums;

/**
 * RoomType Enum
 *
 * Defines the physical configuration of a room asset.
 * Synchronized with v4.6 Forensic Schema.
 */
enum RoomType: string
{
    case PRIVATE = 'private';
    case SHARED = 'shared';
}
