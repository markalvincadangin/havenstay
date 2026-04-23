<?php

namespace App\Enums;

/**
 * LineItemType Enum
 *
 * Defines the classification of individual line items within a billing cycle.
 */
enum LineItemType: string
{
    case BASE_RENT = 'base_rent';
    case UTILITY = 'utility';
    case PENALTY = 'penalty';
    case ADJUSTMENT = 'adjustment';
}
