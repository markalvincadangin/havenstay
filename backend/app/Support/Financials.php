<?php

namespace App\Support;

use App\Enums\BillingStatus;
use App\Models\Meter;
use App\Models\MeterReading;
use App\Models\Payment;
use App\Models\UtilityRate;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Provides centralized logic for financial calculations, currency formatting,
 * and balance reconciliation.
 */
class Financials
{
    /**
     * Compute utility cost based on meter reading.
     *
     * Implementation details:
     * - Rate lookups use the billing period's starting date to ensure consistency.
     * - Handles dial rollover (BR-MET-005).
     *
     * @param  string|null  $lookupDate  The date for rate resolution.
     * @param  float|null  $baseValue  Explicit starting value. If null, uses last billed reading.
     * @return float total_cost
     */
    public static function computeUtilityCost(int $meterId, float $currentReading, ?string $lookupDate = null, ?float $baseValue = null): float
    {
        $meter = Meter::with('utility')->findOrFail($meterId);

        $lookupDate = $lookupDate ?: now()->toDateString();

        // 1. Resolve starting reference value
        if ($baseValue !== null) {
            $prevValue = $baseValue;
        } else {
            // Fallback to the value from the last billed reading
            $lastBilled = self::getLastBilledReading($meterId);
            $prevValue = $lastBilled ? (float) $lastBilled->reading_value : 0;
        }

        // 2. Resolve active rate
        $rate = UtilityRate::where('utility_id', $meter->utility_id)
            ->where('effective_from', '<=', $lookupDate)
            ->orderBy('effective_from', 'desc')
            ->first();

        if (! $rate) {
            throw ValidationException::withMessages([
                'utility_rate' => ["No effective utility rate found for {$meter->utility->name} on or before {$lookupDate}."],
            ]);
        }

        $unitRate = (float) $rate->base_rate;
        $consumption = $currentReading - $prevValue;

        // Implement BR-MET-005: Rollover Handling
        if ($consumption < 0) {
            $dialCapacity = 10000.0;
            $consumption = ($dialCapacity - $prevValue) + $currentReading;
        }

        return self::roundToCent($consumption * $unitRate);
    }

    /**
     * Retrieve the most recent reading for a meter that has been committed to a bill.
     */
    public static function getLastBilledReading(int $meterId): ?MeterReading
    {
        return MeterReading::where('meter_id', $meterId)
            ->whereIn('reading_id', function ($query) {
                $query->select('reading_id')
                    ->from('billing_line_items')
                    ->whereNotNull('reading_id');
            })
            ->orderBy('reading_date', 'desc')
            ->orderBy('reading_id', 'desc')
            ->first();
    }

    /**
     * Derive the status of a billing record based on the amount paid and due date.
     */
    public static function deriveBillingStatus(float $amountDue, float $amountPaid, string $dueDate): BillingStatus
    {
        $today = now()->toDateString();
        $isOverdue = $dueDate < $today;

        if ($amountPaid >= ($amountDue - 0.01)) {
            return BillingStatus::PAID;
        } elseif ($isOverdue && $amountPaid < $amountDue) {
            return BillingStatus::OVERDUE;
        } elseif ($amountPaid > 0) {
            return BillingStatus::PARTIAL;
        }

        return BillingStatus::UNPAID;
    }

    /**
     * Get the outstanding balance for a specific contract.
     */
    public static function getOutstandingBalance(int $contractId): float
    {
        $summary = DB::table('vw_billing_summary')
            ->where('contract_id', $contractId)
            ->select(DB::raw('SUM(total_amount - total_paid) as balance'))
            ->first();

        return (float) ($summary?->balance ?? 0);
    }

    /**
     * Get total non-voided payments for a contract (Billing + Deposits).
     */
    public static function getTotalPaid(int $contractId): float
    {
        // Total paid includes both direct contract payments (Deposits)
        // and payments made against related billings.
        return (float) Payment::where(function ($q) use ($contractId) {
            $q->where('contract_id', $contractId)
                ->orWhereHas('billing', function ($sub) use ($contractId) {
                    $sub->where('contract_id', $contractId);
                });
        })
            ->whereNull('voided_at')
            ->sum('amount_paid');
    }

    /**
     * Standardize currency formatting.
     */
    public static function formatCurrency(float $amount): string
    {
        return '₱'.number_format($amount, 2);
    }

    /**
     * Round to two decimals consistently.
     */
    public static function roundToCent(float $amount): float
    {
        return round($amount, 2);
    }

    /**
     * Apportion a total room utility charge among multiple occupants.
     *
     * Implements BR-MET-011: Rounding differentials (Orphan Cents) are
     * applied to the earliest contract to prevent ledger drift.
     *
     * @param  float  $totalCharge  The aggregate room-level charge.
     * @param  array<int>  $contractIds  Array of active contract IDs in the room.
     * @return array<int, float> Map of contract_id => apportioned_amount.
     */
    public static function apportionUtilityCharge(float $totalCharge, array $contractIds): array
    {
        $count = count($contractIds);
        if ($count === 0) {
            return [];
        }

        // Standard division (truncate to cent)
        $baseSplit = floor(($totalCharge / $count) * 100) / 100;

        // Map of id => amount
        $apportionments = [];
        foreach ($contractIds as $id) {
            $apportionments[$id] = $baseSplit;
        }

        // Apply Rounding Differential to the EARLIEST contract
        // Assumption: $contractIds is sorted by creation or move-in date
        $roundingGap = $totalCharge - ($baseSplit * $count);
        if (abs($roundingGap) > 0.001) {
            $firstId = $contractIds[0];
            $apportionments[$firstId] = self::roundToCent($apportionments[$firstId] + $roundingGap);
        }

        return $apportionments;
    }
}
