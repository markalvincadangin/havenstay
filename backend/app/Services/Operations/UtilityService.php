<?php

namespace App\Services\Operations;

use App\Enums\MeterStatus;
use App\Models\User;
use App\Models\Utility;
use App\Models\UtilityRate;
use App\Services\Concerns\ManagesWorkflows;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * UtilityService
 *
 * Manages the utility catalog and rate schedules.
 * Aligned with BR-MET-001 and BR-MET-007.
 */
class UtilityService
{
    use ManagesWorkflows;

    /**
     * List all operational utilities with caching.
     */
    public static function listAll()
    {
        return Cache::remember('utilities:all', 600, function () {
            return Utility::with('rates')->orderBy('name')->get();
        });
    }

    /**
     * Create a new Utility category with a mandatory initial rate.
     *
     * @param  User  $actor  The admin performing the setup.
     * @param  array  $data  Includes name, unit_of_measurement, initial_base_rate, and effective_from.
     */
    public static function create(User $actor, array $data): Utility
    {
        return self::runWriteWorkflow(
            actorId: $actor->user_id,
            action: 'CREATE_UTILITY',
            payload: [
                'name' => $data['name'] ?? 'UNKNOWN',
                'initial_rate' => $data['initial_base_rate'] ?? 0,
            ],
            operation: function () use ($data) {
                // 1. Create the Utility
                $utility = Utility::create([
                    'name' => $data['name'],
                    'unit_of_measurement' => $data['unit_of_measurement'],
                ]);

                // 2. Create the Mandatory Initial Rate
                UtilityRate::create([
                    'utility_id' => $utility->utility_id,
                    'base_rate' => $data['initial_base_rate'],
                    'effective_from' => $data['effective_from'],
                ]);

                self::clearCache();

                return $utility->fresh(['rates']);
            },
            resultDetails: fn (Utility $u) => ['utility_id' => $u->utility_id]
        );
    }

    /**
     * Update Utility metadata.
     */
    public static function update(User $actor, Utility $utility, array $data): Utility
    {
        return self::runWriteWorkflow(
            actorId: $actor->user_id,
            action: 'UPDATE_UTILITY',
            payload: ['utility_id' => $utility->utility_id, 'old_name' => $utility->name],
            operation: function () use ($utility, $data) {
                $utility->update([
                    'name' => $data['name'],
                    'unit_of_measurement' => $data['unit_of_measurement'],
                ]);

                self::clearCache();

                return $utility;
            }
        );
    }

    /**
     * Create a new historical rate for a utility.
     */
    public static function createRate(User $actor, array $data): UtilityRate
    {
        return self::runWriteWorkflow(
            actorId: $actor->user_id,
            action: 'CREATE_UTILITY_RATE',
            payload: ['utility_id' => $data['utility_id'], 'new_rate' => $data['base_rate']],
            operation: function () use ($data) {
                return UtilityRate::create([
                    'utility_id' => $data['utility_id'],
                    'base_rate' => $data['base_rate'],
                    'effective_from' => $data['effective_from'],
                ]);
            }
        );
    }

    /**
     * Archive a utility (Soft delete).
     * Prevents archiving if active meters are assigned.
     */
    public static function archive(User $actor, Utility $utility): void
    {
        // Safety: Check for active meters
        $activeMeters = DB::table('meters')
            ->where('utility_id', $utility->utility_id)
            ->where('status', MeterStatus::ACTIVE)
            ->count();

        if ($activeMeters > 0) {
            throw ValidationException::withMessages([
                'utility' => ["Utility cannot be archived: {$activeMeters} active meter(s) are currently measuring this service."],
            ]);
        }

        self::runWriteWorkflow(
            actorId: $actor->user_id,
            action: 'ARCHIVE_UTILITY',
            payload: ['utility_id' => $utility->utility_id, 'final_meter_count' => $activeMeters],
            operation: function () use ($utility) {
                $utility->delete();
            }
        );

        self::clearCache();
    }

    /**
     * Clear cached utility data.
     */
    public static function clearCache(): void
    {
        Cache::forget('utilities:all');
    }
}
