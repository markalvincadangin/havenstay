<?php

namespace App\Enums;

/**
 * AuditAction Enum
 *
 * Defines the strict classification of system and database events captured in the forensic ledger.
 * Matches production standards for event type standardization.
 */
enum AuditAction: string
{
    case CREATE = 'CREATE';
    case UPDATE = 'UPDATE';
    case DELETE = 'DELETE';
    case SOFT_DELETE = 'SOFT_DELETE';
    case RESTORE = 'RESTORE';
    case LOGIN = 'LOGIN';
    case LOGOUT = 'LOGOUT';
    case FAILED_LOGIN = 'FAILED_LOGIN';
    case VOID = 'VOID';
    case SYSTEM = 'SYSTEM';
    case SECURITY = 'SECURITY';
    case EXPORT = 'EXPORT';
    case ACCESS_DENIED = 'ACCESS_DENIED';
}
