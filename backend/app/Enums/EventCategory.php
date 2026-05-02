<?php

namespace App\Enums;

/**
 * EventCategory Enum
 * 
 * Classifies forensic events into high-level security and operational domains.
 * Matches production standards (SOC 2, ISO 27001).
 */
enum EventCategory: string
{
    case AUTH = 'AUTH';
    case DATA = 'DATA';
    case FINANCIAL = 'FINANCIAL';
    case SYSTEM = 'SYSTEM';
    case SECURITY = 'SECURITY';
}
