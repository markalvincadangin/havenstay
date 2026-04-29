<?php

namespace App\Services\Operations;

use App\Models\Billing;
use App\Models\BillingLineItem;
use App\Models\Contract;
use App\Models\MeterReading;
use App\Models\User;
use App\Models\UtilityRate;
use App\Enums\ContractStatus;
use App\Enums\LineItemType;
use App\Support\Financials;
use App\Services\Concerns\ManagesWorkflows;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

/**
 * Implements the financial logic for utility consumption proration 
 * and rounding differential handling (BR-MET-011).
 */
class UtilityApportionmentService
{
    use ManagesWorkflows;

    /**
     * Dry Run logic for predicting utility charges.
     * Returns an array of raw usage + the computed exact apportionments per contract.
     */
    public static function forecast(array $data): array
    {
        $roomId = (int) $data['room_id'];

        $activeContracts = Contract::whereHas('bedSpace', function ($q) use ($roomId) {
            $q->where('room_id', $roomId);
        })
            ->where('status', ContractStatus::ACTIVE)
            ->orderBy('move_in_date', 'asc') // Oldest contract first for BR-MET-011
            ->get();

        $contractIds = $activeContracts->pluck('contract_id')->all();
        if (empty($contractIds)) {
            return [
                'total_charge' => 0,
                'apportionments' => []
            ];
        }

        $totalCharge = 0.0;
        $breakdown = [];
        $readings = $data['readings'] ?? [];

        foreach ($readings as $reqReading) {
            $prev = MeterReading::with('meter')->find($reqReading['previous_reading_id']);
            $curr = MeterReading::find($reqReading['current_reading_id']);

            if (!$prev || !$curr)
                continue;

            $utilityId = $prev->meter->utility_id;

            // Delegate to authoritative Financials math for rollover and historical rate
            $charge = Financials::computeUtilityCost(
                $prev->meter_id,
                (float) $curr->reading_value,
                $data['billing_period_start'],
                (float) $prev->reading_value
            );

            // Back-calculate consumption for breakdown display
            $usage = (float) $curr->reading_value - (float) $prev->reading_value;
            if ($usage < 0) {
                $usage = 10000 - (float) $prev->reading_value + (float) $curr->reading_value;
            }

            // Find effective rate for display (using same logic as Financials)
            $activeRate = UtilityRate::where('utility_id', $utilityId)
                ->where('effective_from', '<=', $data['billing_period_start'])
                ->orderByDesc('effective_from')
                ->first();

            $rate = $activeRate ? (float) $activeRate->base_rate : 0.0;


            $totalCharge += $charge;
            $breakdown[] = [
                'meter' => $prev->meter->serial_number,
                'utility' => $prev->meter->utility->name ?? 'Utility',
                'usage' => $usage,
                'rate' => $rate,
                'charge' => $charge
            ];
        }

        // CCR-011: Time-Weighted Apportionment (Fair Proration)
        // Instead of equal split, we use occupancy days in the period.
        $weights = self::calculateOccupancyWeights(
            $activeContracts,
            $data['billing_period_start'],
            $data['billing_period_end']
        );

        $apportionments = [];
        $runningTotal = 0;
        $totalContracts = count($activeContracts);

        foreach ($activeContracts as $index => $contract) {
            $weight = $weights[$contract->contract_id] ?? 0;

            // CCR-013: Detect existing billing to prevent wizard collision
            $alreadyBilled = Billing::where('contract_id', $contract->contract_id)
                ->where(function ($q) use ($data) {
                    $q->whereDate('billing_period_from', '<=', $data['billing_period_end'])
                        ->whereDate('billing_period_to', '>=', $data['billing_period_start']);
                })
                ->exists();

            $baseRent = $alreadyBilled ? 0.0 : (float) ($contract->monthly_rate_override ?? $contract->monthly_rate);
            $utilityShare = Financials::roundToCent($totalCharge * $weight);

            $apportionments[] = [
                'contract_id' => $contract->contract_id,
                'tenant_name' => $contract->tenant->first_name . ' ' . $contract->tenant->last_name,
                'base_rent' => $baseRent,
                'utility_share' => $utilityShare,
                'total_estimated' => Financials::roundToCent($baseRent + $utilityShare),
                'occupancy_days' => round($weight * 100, 1) . '% share', // UI context
                'already_billed' => $alreadyBilled,
                'is_differential_target' => ($index === 0), // BR-MET-011 Target
                'override_reason' => $alreadyBilled ? "Note: Rent excluded (already billed for this period)." : null
            ];
            
            $runningTotal += $utilityShare;
        }

        // Final Adjustment check for index 0 to satisfy BR-MET-011 visibility
        $diff = Financials::roundToCent($totalCharge - $runningTotal);
        if (abs($diff) > 0 && isset($apportionments[0])) {
            $apportionments[0]['utility_share'] = Financials::roundToCent($apportionments[0]['utility_share'] + $diff);
            $apportionments[0]['total_estimated'] = Financials::roundToCent($apportionments[0]['base_rent'] + $apportionments[0]['utility_share']);
        }

        return [
            'total_charge' => Financials::roundToCent($totalCharge),
            'meters_breakdown' => $breakdown,
            'apportionments' => $apportionments,
        ];
    }

    /**
     * Internal: Calculate occupancy weights based on man-days in period.
     */
    private static function calculateOccupancyWeights($contracts, string $start, string $end): array
    {
        $periodStart = Carbon::parse($start);
        $periodEnd = Carbon::parse($end);

        $weights = [];
        $totalManDays = 0;

        foreach ($contracts as $contract) {
            $moveIn = Carbon::parse($contract->move_in_date);
            $moveOut = $contract->actual_move_out_date ? Carbon::parse($contract->actual_move_out_date) : null;

            $effStart = $moveIn->max($periodStart);
            $effEnd = $moveOut ? $moveOut->min($periodEnd) : $periodEnd;

            $days = $effStart->gt($effEnd) ? 0 : $effStart->diffInDays($effEnd) + 1;
            $weights[$contract->contract_id] = $days;
            $totalManDays += $days;
        }

        if ($totalManDays > 0) {
            foreach ($weights as $id => $days) {
                $weights[$id] = $days / $totalManDays;
            }
        }

        return $weights;
    }

    /**
     * Executes the final atomic commit for the utility wizard.
     */
    public static function commit(User $actor, array $data): array
    {
        return self::runWriteWorkflow(
            actorId: $actor->user_id,
            action: 'COMMIT_UTILITY_APPORTIONMENT',
            payload: [
                'room_id' => $data['room_id'] ?? 0,
                'period_start' => $data['billing_period_start'] ?? null,
                'occupant_count' => count($data['apportionments'] ?? [])
            ],
            operation: function () use ($data, $actor) {
                $results = [];

                // CCR-011: Pre-calculate weights for consistent commit logic
                // We fetch the contracts again to ensure fresh data
                $roomId = (int) ($data['room_id'] ?? 0);
                $activeContracts = Contract::whereHas('bedSpace', function ($q) use ($roomId) {
                    $q->where('room_id', $roomId);
                })
                    ->where('status', ContractStatus::ACTIVE)
                    ->orderBy('move_in_date', 'asc')
                    ->get();

                $weights = self::calculateOccupancyWeights(
                    $activeContracts,
                    $data['billing_period_start'],
                    $data['billing_period_end']
                );

                $runningTotalDistributed = 0;
                $totalToDistribute = (float) ($data['total_charge'] ?? 0);

                foreach ($data['apportionments'] as $index => $split) {
                    $weight = $weights[$split['contract_id']] ?? 0;
                    
                    // BR-MET-011: Calculate target amount with differential handling
                    $isEarliest = ($index === 0);
                    $targetUtilityAmount = Financials::roundToCent($totalToDistribute * $weight);
                    
                    // If it's the earliest, we'll reconcile at the end of the line item loop
                    // OR we pre-calculate the diff by checking what the OTHERS will get.
                    // To keep it simple and accurate, we distribute to all, then 
                    // the first one gets the remainder of the WHOLE room charge.
                    
                    try {
                        // Create billing record
                        $billing = BillingService::create($actor, [
                            'contract_id' => $split['contract_id'],
                            'billing_period_from' => $data['billing_period_start'],
                            'billing_period_to' => $data['billing_period_end'],
                            'due_date' => $data['due_date'],
                            'line_items' => $split['manual_items'] ?? []
                        ]);

                        // Distribute utility line items based on readings
                        // Itemized per meter to comply with database constraints.
                    } catch (\Illuminate\Validation\ValidationException $e) {
                        // CCR-014: Fail-Safe Loop
                        // If one tenant is already billed (e.g. new move-in), we skip them 
                        // but CONTINUE for other tenants in the same room.
                        \Illuminate\Support\Facades\Log::info("Utility commit skipped for contract #{$split['contract_id']} due to overlap: " . $e->getMessage());
                        // IMPORTANT: Even if skipped, we subtract their "would-be" share from the room total
                        // so the differential for others remains consistent.
                        $runningTotalDistributed += $targetUtilityAmount;
                        continue;
                    }

                    // Distribute line items
                    // Create one line item per meter reading.
                    $readings = $data['readings'] ?? [];
                    foreach ($readings as $reqReading) {
                        $prev = MeterReading::with('meter')->find($reqReading['previous_reading_id']);
                        $curr = MeterReading::find($reqReading['current_reading_id']);
                        if (!$prev || !$curr)
                            continue;

                        $meterTotalCharge = Financials::computeUtilityCost(
                            $prev->meter_id,
                            (float) $curr->reading_value,
                            $data['billing_period_start'],
                            (float) $prev->reading_value
                        );

                        // Apportion this specific meter's cost to this tenant using weights
                        $meterShare = Financials::roundToCent($meterTotalCharge * $weight);

                        BillingLineItem::create([
                            'billing_id' => $billing->billing_id,
                            'utility_id' => $prev->meter->utility_id,
                            'reading_id' => $curr->reading_id,
                            'item_type' => LineItemType::UTILITY,
                            'item_description' => $prev->meter->utility->name . " Share (Meter: " . $prev->meter->serial_number . ")",
                            'amount' => $meterShare,
                        ]);
                    }

                    // Adjust final balance to match calculated apportionment total.
                    $sumOfMeters = $billing->lineItems()->where('item_type', LineItemType::UTILITY)->sum('amount');
                    
                    // Final Share Calculation with BR-MET-011 Differential
                    if ($index === 0) {
                        // The earliest contract absorbs the room remainder
                        // We compute what the OTHER tenants' targets sum to
                        $othersTargetSum = 0;
                        foreach (array_slice($data['apportionments'], 1) as $other) {
                            $w = $weights[$other['contract_id']] ?? 0;
                            $othersTargetSum += Financials::roundToCent($totalToDistribute * $w);
                        }
                        $finalTargetForThisTenant = Financials::roundToCent($totalToDistribute - $othersTargetSum);
                    } else {
                        $finalTargetForThisTenant = $targetUtilityAmount;
                    }

                    $diff = Financials::roundToCent($finalTargetForThisTenant - $sumOfMeters);

                    if (abs($diff) > 0.001) {
                        BillingLineItem::create([
                            'billing_id' => $billing->billing_id,
                            'item_type' => LineItemType::ADJUSTMENT,
                            'item_description' => $index === 0 ? 'Utility Rounding Differential (BR-MET-011)' : 'Utility Cent-Rounding Adjustment',
                            'amount' => $diff,
                        ]);
                    }

                    // Sync status
                    $billing = BillingService::syncBillingStatus($actor, $billing);

                    $results[] = clone $billing;
                }

                return $results;
            }
        );
    }
}
