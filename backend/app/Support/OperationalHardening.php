<?php

namespace App\Support;

use Illuminate\Validation\ValidationException;

/**
 * OperationalHardening
 *
 * Centralized repository for Level 5 Forensic business rules and
 * operational constraints to ensure Layer Purity across Services.
 */
class OperationalHardening
{
    /**
     * Enforce Security Deposit cap (BR-CON-006 / R.A. 9653).
     * Prevents excessive bond collection by limiting deposit to 2x monthly rate.
     *
     * @throws ValidationException
     */
    public static function validateDepositCap(float $monthlyRate, float $depositAmount): void
    {
        if ($monthlyRate > 0 && $depositAmount > ($monthlyRate * 2)) {
            throw ValidationException::withMessages([
                'deposit_amount' => [
                    sprintf('Business Rule Violation (BR-CON-006) / R.A. 9653 Violation: Security deposit cannot exceed two months\' rent (₱%s).', number_format($monthlyRate * 2, 2)),
                ],
            ]);
        }
    }

    /**
     * Enforce Residential Rent Control Act (R.A. 9653).
     * Limits annual rent increases for residential units.
     *
     * @throws ValidationException
     */
    public static function validateRentControlCap(float $oldRate, float $newRate): void
    {
        // Standard RA 9653 cap is 7% for residential units.
        if ($oldRate > 0 && $newRate > ($oldRate * 1.07)) {
            throw ValidationException::withMessages([
                'monthly_rate_override' => [
                    sprintf('Rent Control Act Violation: Price increase of %s%% exceeds the 7%% legal cap.', number_format((($newRate / $oldRate) - 1) * 100, 1)),
                ],
            ]);
        }
    }
}
