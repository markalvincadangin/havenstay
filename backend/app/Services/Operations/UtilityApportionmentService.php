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
                $weights = self::calculateOccupancyWeights(
                    Contract::whereIn('contract_id', collect($data['apportionments'])->pluck('contract_id'))->get(),
                    $data['billing_period_start'],
                    $data['billing_period_end']
                );

                $results = [];

                foreach ($data['apportionments'] as $index => $split) {
                    $billing = self::processOccupantBilling($actor, $data, $split, $weights, $index === 0);
                    
                    if ($billing) {
                        $results[] = clone $billing;
                    }
                }

                return $results;
            }
        );
    }

    /**
     * Process billing for a single occupant, handling existing bills or creating new ones.
     */
    private static function processOccupantBilling(User $actor, array $data, array $split, array $weights, bool $isFirst): ?Billing
    {
        $contract = Contract::findOrFail($split['contract_id']);
        $targetUtilityAmount = (float) $split['amount'];
        $billing = null;

        try {
            // Create new billing record
            $billing = BillingService::create($actor, [
                'contract_id' => $split['contract_id'],
                'billing_period_from' => $data['billing_period_start'],
                'billing_period_to' => $data['billing_period_end'],
                'due_date' => $data['due_date'],
                'line_items' => $split['manual_items'] ?? []
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            // Append to existing bill if overlap occurs (BR-BIL-010)
            $billing = Billing::where('contract_id', $split['contract_id'])
                ->where(function ($q) use ($data) {
                    $q->whereDate('billing_period_from', '<=', $data['billing_period_end'])
                        ->whereDate('billing_period_to', '>=', $data['billing_period_start']);
                })
                ->first();

            if (!$billing) {
                \Illuminate\Support\Facades\Log::info("Utility commit skipped for contract #{$split['contract_id']} due to validation failure.");
                return null;
            }

            // Manually add additional items for existing bills
            if (!empty($split['manual_items'])) {
                foreach ($split['manual_items'] as $item) {
                    BillingLineItem::create([
                        'billing_id' => $billing->billing_id,
                        'item_type' => $item['item_type'] ?? LineItemType::ADJUSTMENT,
                        'item_description' => $item['description'],
                        'amount' => (float) $item['amount'],
                    ]);
                }
            }
        }

        // Distribute utility charges per meter reading
        $readings = $data['readings'] ?? [];
        $sumOfMeters = 0;
        $weight = $weights[$contract->contract_id] ?? 0;

        foreach ($readings as $reqReading) {
            $prev = MeterReading::with('meter')->find($reqReading['previous_reading_id']);
            $curr = MeterReading::find($reqReading['current_reading_id']);
            if (!$prev || !$curr) continue;

            $meterTotalCharge = Financials::computeUtilityCost(
                $prev->meter_id,
                (float) $curr->reading_value,
                $data['billing_period_start'],
                (float) $prev->reading_value
            );

            $meterShare = Financials::roundToCent($meterTotalCharge * $weight);
            $sumOfMeters += $meterShare;

            BillingLineItem::create([
                'billing_id' => $billing->billing_id,
                'utility_id' => $prev->meter->utility_id,
                'reading_id' => $curr->reading_id,
                'item_type' => LineItemType::UTILITY,
                'item_description' => "Utility: {$prev->meter->utility->name} (SN: {$prev->meter->serial_number})",
                'amount' => $meterShare,
            ]);
        }

        // Bridge the gap between individual meter shares and the target total share (BR-MET-011)
        $diff = Financials::roundToCent($targetUtilityAmount - $sumOfMeters);

        if (abs($diff) > 0.001) {
            BillingLineItem::create([
                'billing_id' => $billing->billing_id,
                'item_type' => LineItemType::ADJUSTMENT,
                'item_description' => $isFirst ? 'Utility Rounding Differential (BR-MET-011)' : 'Utility Cent-Rounding Adjustment',
                'amount' => $diff,
            ]);
        }

        return BillingService::syncBillingStatus($actor, $billing);
    }
}
