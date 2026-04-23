<?php

namespace App\Enums;

/**
 * ContractStatus Enum
 *
 * Defines the forensic lifecycle of a lease agreement.
 */
enum ContractStatus: string
{
    case PENDING_PAYMENT = 'pending_payment';
    case ACTIVE = 'active';
    case COMPLETED = 'completed';
    case TERMINATED = 'terminated';
    case VOIDED = 'voided';
}
