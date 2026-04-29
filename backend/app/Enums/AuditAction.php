<?php

namespace App\Enums;

/**
 * AuditAction Enum
 *
 * Defines the classification of system and database events captured in the forensic ledger.
 */
enum AuditAction: string
{
    case INSERT = 'INSERT';
    case UPDATE = 'UPDATE';
    case DELETE = 'DELETE';
    case LOGIN = 'login';
    case LOGOUT = 'logout';
    case ACCESS_DENIED = 'access_denied';
    case STATUS_CHANGE = 'status_change';
    case ARCHIVE = 'archive';
    case RESTORE = 'restore';
}
