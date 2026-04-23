<?php

namespace App\Enums;

/**
 * BillingStatus Enum
 *
 * Defines the financial and collections status of a billing ledger.
 */
enum BillingStatus: string
{
    case UNPAID = 'unpaid';
    case PARTIAL = 'partial';
    case PAID = 'paid';
    case OVERDUE = 'overdue';
}
