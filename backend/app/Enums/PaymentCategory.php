<?php

namespace App\Enums;

/**
 * PaymentCategory Enum
 *
 * Defines the forensic target of a payment (Billing Cycle vs Deposit).
 * Synchronized with v4.6 Forensic Schema.
 */
enum PaymentCategory: string
{
    case BILLING = 'billing';
    case DEPOSIT = 'deposit';
    case REFUND = 'refund';
    case ROLLOVER = 'rollover';
}
