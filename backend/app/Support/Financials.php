<?php

namespace App\Support;

use App\Models\Billing;
use App\Models\RoomMeterReading;
use Illuminate\Support\Facades\DB;

/**
 * Financials
 * 
 * Centralizes complex financial calculations, currency formatting, 
 * and balance reconciliation across the system.
 */
class Financials
{
    /**
     * Compute utility cost based on sub-meter reading.
     * 
     * @return array{previous_reading: float, current_reading: float, consumption: float, total_cost: float}
     */
    public static function computeUtilityCost(int $roomId, string $type, float $currentReading, float $unitRate): array
    {
        $lastReading = RoomMeterReading::where('room_id', $roomId)
            ->where('utility_type', $type)
            ->whereNotNull('billing_id') 
            ->orderBy('reading_date', 'desc')
            ->first();

        $prevValue = $lastReading ? $lastReading->reading_value : 0;
        $consumption = max(0, $currentReading - $prevValue);
        $totalCost = $consumption * $unitRate;

        return [
            'previous_reading' => (float)$prevValue,
            'current_reading' => (float)$currentReading,
            'consumption' => (float)$consumption,
            'total_cost' => (float)$totalCost,
        ];
    }

    /**
     * Reconcile Billing Status based on authoritative balance logic.
     * Aligned with SRS priority: paid > overdue > partial > unpaid.
     * 
     * @return string The derived Billing status constant.
     */
    public static function deriveBillingStatus(float $amountDue, float $amountPaid, string $dueDate): string
    {
        $today = now()->toDateString();
        $isOverdue = $dueDate < $today;

        if ($amountPaid >= ($amountDue - 0.01)) {
            return Billing::STATUS_PAID;
        } elseif ($isOverdue && $amountPaid < $amountDue) {
            return Billing::STATUS_OVERDUE;
        } elseif ($amountPaid > 0) {
            return Billing::STATUS_PARTIAL;
        }

        return Billing::STATUS_UNPAID;
    }

    /**
     * Authoritative check for outstanding balance on a contract.
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
     * Get total non-voided payments for a contract.
     */
    public static function getTotalPaid(int $contractId): float
    {
        $summary = DB::table('vw_billing_summary')
            ->where('contract_id', $contractId)
            ->select('total_paid')
            ->first();

        return (float) ($summary?->total_paid ?? 0);
    }

    /**
     * Standardize currency formatting with Philippine Peso symbol.
     */
    public static function formatCurrency(float $amount): string
    {
        return '₱' . number_format($amount, 2);
    }

    /**
     * Round to two decimals consistently for financial transactions.
     */
    public static function roundToCent(float $amount): float
    {
        return round($amount, 2);
    }
}
