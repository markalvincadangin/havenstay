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
  * UtilityApportionmentService
  *
  * Implements the financial math for utility consumption parsing
  * and implements the Orphan Cent Rounding Differential (BR-MET-011).
  * Optimized for HavenStay Forensic v5.0.
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
         
         $activeContracts = Contract::whereHas('bedSpace', function($q) use ($roomId) {
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
 
             if (!$prev || !$curr) continue;
 
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
 
         // Centralized BR-MET-011: Orphan Cent Differential
         $apportionmentMap = Financials::apportionUtilityCharge($totalCharge, $contractIds);
 
         $apportionments = [];
         foreach ($activeContracts as $contract) {
             $baseRent = (float) ($contract->monthly_rate_override ?? $contract->monthly_rate);
             $utilityShare = $apportionmentMap[$contract->contract_id] ?? 0;
             
             $apportionments[] = [
                 'contract_id' => $contract->contract_id,
                 'tenant_name' => $contract->tenant->first_name . ' ' . $contract->tenant->last_name,
                 'base_rent' => $baseRent,
                 'utility_share' => $utilityShare,
                 'total_estimated' => Financials::roundToCent($baseRent + $utilityShare),
                 'override_reason' => null
             ];
         }
 
         return [
             'total_charge' => Financials::roundToCent($totalCharge),
             'meters_breakdown' => $breakdown,
             'apportionments' => $apportionments,
         ];
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
                 $occupantCount = count($data['apportionments']);
 
                 foreach ($data['apportionments'] as $split) {
                     // Generates the billing record
                     $billing = BillingService::create($actor, [
                         'contract_id' => $split['contract_id'],
                         'billing_period_from' => $data['billing_period_start'],
                         'billing_period_to' => $data['billing_period_end'],
                         'due_date' => $data['due_date'],
                         'line_items' => $split['manual_items'] ?? [] 
                     ]);
 
                     // Distribute line items
                     // FORENSIC ITEMIZATION: To satisfy DB constraint chk_bli_utility_link,
                     // we must generate one line item per meter reading.
                     $readings = $data['readings'] ?? [];
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
                         
                         // Apportion this specific meter's cost to this tenant
                         // Simple split for items; the aggregate diff is handled by the adjustment item
                         $meterShare = floor(($meterTotalCharge / $occupantCount) * 100) / 100;
                         
                         BillingLineItem::create([
                             'billing_id' => $billing->billing_id,
                             'utility_id' => $prev->meter->utility_id,
                             'reading_id' => $curr->reading_id,
                             'item_type' => LineItemType::UTILITY,
                             'item_description' => $prev->meter->utility->name . " Share (Meter: " . $prev->meter->serial_number . ")",
                             'amount' => $meterShare,
                         ]);
                     }
 
                     // Resolve final balance to match the authoritative apportionment amount
                     $sumOfMeters = $billing->lineItems()->where('item_type', LineItemType::UTILITY)->sum('amount');
                     $diff = Financials::roundToCent($split['amount'] - $sumOfMeters);
                     
                     if (abs($diff) > 0.001) {
                         BillingLineItem::create([
                             'billing_id' => $billing->billing_id,
                             'item_type' => LineItemType::ADJUSTMENT,
                             'item_description' => 'Utility Cent-Rounding Adjustment',
                             'amount' => $diff,
                         ]);
                     }
                     
                     // Sync status (Fixed parameter order: actor, then billing)
                     $billing = BillingService::syncBillingStatus($actor, $billing);
                     
                     $results[] = clone $billing;
                 }
 
                 return $results;
             }
         );
     }
 }
