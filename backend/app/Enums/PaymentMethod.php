<?php

namespace App\Enums;

/**
 * PaymentMethod Enum
 *
 * Defines the supported payment channels in the Bhms.
 */
enum PaymentMethod: string
{
    case CASH = 'cash';
    case GCASH = 'gcash';
    case BANK_TRANSFER = 'bank_transfer';
    case OTHER = 'other';
}
