<?php
 
 namespace App\Support;
 
 use App\Models\MeterReading;
 use App\Models\Meter;
 use App\Models\UtilityRate;
 use App\Models\Payment;
 use App\Enums\BillingStatus;
 use Illuminate\Support\Facades\DB;
 
 /**
  * Financials
  * 
  * Centralizes complex financial calculations, currency formatting, 
  * and balance reconciliation across the system.
  * Optimized for HavenStay Forensic v5.0.
  */
 class Financials
 {
     /**
      * Compute utility cost based on sub-meter reading.
      * 
      * Forensic Rule BR-MET-007: Utility rate lookups must use the billing period's 
      * starting date, never the current date, to ensure temporal consistency.
      * 
      * @param int $meterId
      * @param float $currentReading
      * @param string|null $lookupDate The date for rate resolution (mandated per v5.0 blueprint).
      * @return float total_cost
      */
     public static function computeUtilityCost(int $meterId, float $currentReading, ?string $lookupDate = null): float
     {
         $meter = Meter::with('utility')->findOrFail($meterId);
         
         // Forensic Guard: Defaulting to now() is a risk, but maintained for API compatibility
         // with a warning comment.
         $lookupDate = $lookupDate ?: now()->toDateString();
 
         // Find previous reading for this meter
         $lastReading = MeterReading::where('meter_id', $meterId)
             ->orderBy('reading_date', 'desc')
             ->orderBy('reading_id', 'desc')
             ->first();
 
         // Find active rate for the utility (BR-MET-007)
         $rate = UtilityRate::where('utility_id', $meter->utility_id)
             ->where('effective_from', '<=', $lookupDate)
             ->orderBy('effective_from', 'desc')
             ->first();
 
         $unitRate = $rate ? (float) $rate->base_rate : 0;
         $prevValue = $lastReading ? (float) $lastReading->reading_value : 0;
 
         $consumption = $currentReading - $prevValue;
 
         // Implement BR-MET-005: Rollover Handling
         // If consumption is negative, assume a rollover event.
         // Default dial capacity is 9,999.9999 as per BR-MET-005.
         if ($consumption < 0) {
             $dialCapacity = 10000.0; // Rollover threshold (max display + 1 segment)
             $consumption = ($dialCapacity - $prevValue) + $currentReading;
         }
 
         return self::roundToCent($consumption * $unitRate);
     }
 
     /**
      * Reconcile Billing Status based on authoritative balance logic.
      * 
      * @param float $amountDue
      * @param float $amountPaid
      * @param string $dueDate
      * @return BillingStatus
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
      * Authoritative check for outstanding billing balance on a contract.
      * 
      * @param int $contractId
      * @return float
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
      * 
      * @param int $contractId
      * @return float
      */
     public static function getTotalPaid(int $contractId): float
     {
         return (float) Payment::where('contract_id', $contractId)
             ->whereNull('voided_at')
             ->sum('amount_paid');
     }
 
     /**
      * Standardize currency formatting.
      * 
      * @param float $amount
      * @return string
      */
     public static function formatCurrency(float $amount): string
     {
         return '₱' . number_format($amount, 2);
     }
 
     /**
      * Round to two decimals consistently.
      * 
      * @param float $amount
      * @return float
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
      * @param float $totalCharge The aggregate room-level charge.
      * @param array<int> $contractIds Array of active contract IDs in the room.
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
