<?php

namespace App\Services\Operations;

use App\Models\AddOn;
use App\Models\Contract;
use App\Models\Room;
use App\Models\RoomMeterReading;
use App\Models\User;
use App\Services\Concerns\ManagesWorkflows;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Safety and Utility engine. Handles utility meter readings,
 * appliance registry management, and forensic compliance tracking.
 */
class ComplianceService
{
    use ManagesWorkflows;

    /**
     * Store a new meter reading with non-regressive validation.
     */
    public static function storeMeterReading(User $actor, Room $room, array $data): RoomMeterReading
    {
        return self::runWriteWorkflow(
            actorId: $actor->user_id,
            action: 'RECORD_UTILITY_READING',
            txnReference: self::buildTxnReference('MTR'),
            payload: ['room_id' => $room->room_id, 'type' => $data['utility_type']],
            operation: function () use ($room, $data, $actor): RoomMeterReading {
                $lastReading = RoomMeterReading::where('room_id', $room->room_id)
                    ->where('utility_type', $data['utility_type'])
                    ->orderByDesc('reading_date')
                    ->orderByDesc('created_at')
                    ->first();

                if ($lastReading && $data['reading_value'] < $lastReading->reading_value) {
                    throw ValidationException::withMessages([
                        'reading_value' => [
                            sprintf(
                                'Forensic Logic Error: Current reading (%s) cannot be lower than previous recorded reading (%s).',
                                $data['reading_value'],
                                $lastReading->reading_value
                            )
                        ],
                    ]);
                }

                return RoomMeterReading::create([
                    'room_id' => $room->room_id,
                    'utility_type' => $data['utility_type'],
                    'reading_date' => $data['reading_date'],
                    'reading_value' => $data['reading_value'],
                    'recorded_by' => $actor->user_id,
                ]);
            }
        );
    }

    /**
     * Attach an appliance to a contract and capture the forensic snapshot.
     */
    public static function attachAddOn(User $actor, int $contractId, array $data): void
    {
        self::runWriteWorkflow(
            actorId: $actor->user_id,
            action: 'ATTACH_APPLIANCE',
            txnReference: self::buildTxnReference('APP-ADD'),
            payload: ['contract_id' => $contractId, 'add_on_id' => $data['add_on_id']],
            operation: function () use ($contractId, $data): void {
                DB::table('contract_add_ons')->insert([
                    'contract_id' => $contractId,
                    'add_on_id' => $data['add_on_id'],
                    'actual_rate' => $data['actual_rate'],
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        );
    }

    /**
     * Remove an appliance assignment.
     */
    public static function detachAddOn(User $actor, int $contractId, int $addOnId): void
    {
        self::runWriteWorkflow(
            actorId: $actor->user_id,
            action: 'DETACH_APPLIANCE',
            txnReference: self::buildTxnReference('APP-DEL'),
            payload: ['contract_id' => $contractId, 'add_on_id' => $addOnId],
            operation: function () use ($contractId, $addOnId): void {
                $deleted = DB::table('contract_add_ons')
                    ->where('contract_id', $contractId)
                    ->where('add_on_id', $addOnId)
                    ->delete();

                if (!$deleted) {
                    throw new \Exception("Forensic Desync: Appliance assignment not found for reversal.");
                }
            }
        );
    }

    /**
     * Manage the Add-On Registry.
     */
    public static function storeRegistryItem(User $actor, array $data): AddOn
    {
        return self::runWriteWorkflow(
            actorId: $actor->user_id,
            action: 'CREATE_REGISTRY_ITEM',
            txnReference: self::buildTxnReference('REG-ADD'),
            payload: ['item_name' => $data['item_name']],
            operation: fn() => AddOn::create($data)
        );
    }
}
