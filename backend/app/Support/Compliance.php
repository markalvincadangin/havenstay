<?php

namespace App\Support;

use App\Models\BedSpace;
use App\Models\Contract;
use Illuminate\Validation\ValidationException;

/**
 * Compliance
 * 
 * Centralizes Philippine-specific rental laws and business logic constraints
 * to keep services thin and DRY.
 */
class Compliance
{
    /**
     * Enforce R.A. 9653 (Rent Control Act of 2009) - 2026 Rules.
     * Prevents > 1% annual increase for units <= 10,000 PHP.
     * 
     * @throws ValidationException
     */
    public static function validateRentControlCap(int $tenantId, int $bedSpaceId, float $newRate, ?int $excludeContractId = null): void
    {
        if ($newRate > 10000) return; // Cap only applies to affordable housing tier

        $bed = BedSpace::find($bedSpaceId);
        $roomId = $bed ? $bed->room_id : null;
        if (!$roomId) return;

        // Find most recent contract for SAME tenant and SAME room in the last 12 months
        $lastContract = Contract::where('tenant_id', $tenantId)
            ->whereHas('bedSpace', function($q) use ($roomId) {
                $q->where('room_id', $roomId);
            })
            ->where('created_at', '>=', now()->subMonths(12))
            ->when($excludeContractId, fn($q) => $q->where('contract_id', '<>', $excludeContractId))
            ->orderBy('created_at', 'desc')
            ->first();

        if ($lastContract) {
            $prevRate = $lastContract->monthly_rate_override ?? ($lastContract->room->monthly_rate ?? 0);
            $maxAllowed = round($prevRate * 1.01, 2);

            if ($newRate > $maxAllowed) {
                throw ValidationException::withMessages([
                    'monthly_rate_override' => [
                        sprintf("Rent Control Act Violation: Maximum allowed increase is 1%% (₱%s).", number_format($maxAllowed, 2))
                    ]
                ]);
            }
        }
    }

    /**
     * Enforce Security Deposit limit per R.A. 9653.
     * Security deposit cannot exceed two months' rent.
     * 
     * @throws ValidationException
     */
    public static function validateDepositCap(float $monthlyRate, float $depositAmount): void
    {
        if ($monthlyRate > 0 && $depositAmount > ($monthlyRate * 2)) {
            throw ValidationException::withMessages([
                'deposit_amount' => [
                    sprintf('R.A. 9653 Violation: Security deposit cannot exceed two months\' rent (₱%s).', number_format($monthlyRate * 2, 2))
                ],
            ]);
        }
    }
}
