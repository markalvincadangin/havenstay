<?php

namespace App\Enums;

/**
 * ContractType
 *
 * Defines the classification of rental agreements (BR-CON-004).
 * Optimized for HavenStay Forensic v5.0.
 */
enum ContractType: string
{
    case FIXED_TERM = 'fixed_term';
    case MONTH_TO_MONTH = 'month_to_month';
}
