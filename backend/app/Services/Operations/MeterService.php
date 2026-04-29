<?php

namespace App\Services\Operations;

use App\Enums\MeterStatus;
use App\Models\Meter;
use App\Models\MeterAssignment;
use App\Models\MeterReading;
use App\Models\Room;
use App\Models\User;
use App\Services\Concerns\ManagesWorkflows;
use App\Support\Financials;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Validation\ValidationException;

/**
 * MeterService
 *
 * Orchestrates physical utility meter lifecycle and consumption tracking.
 */
class MeterService
{
    use ManagesWorkflows;

    /**
     * Store a new meter reading with monotonicity validation (BR-MET-005).
     */
    public static function recordReading(User $actor, int $meterId, array $data): MeterReading
    {
        $reading = self::runWriteWorkflow(
            actorId: $actor->user_id,
            action: 'RECORD_METER_READING',
            payload: [
                'meter_id' => $meterId,
                'value_fact' => $data['reading_value'],
                'is_rollover_fact' => $data['is_rollover'] ?? false,
            ],
            operation: function () use ($meterId, $data, $actor): MeterReading {
                $lastReading = MeterReading::where('meter_id', $meterId)
                    ->orderByDesc('reading_date')
                    ->orderByDesc('created_at')
                    ->first();

                // Validation 1: Exact Duplicate Prevention (Idempotency)
                $duplicate = MeterReading::where('meter_id', $meterId)
                    ->where('reading_date', $data['reading_date'])
                    ->where('reading_value', $data['reading_value'])
                    ->first();

                if ($duplicate) {
                    return $duplicate;
                }

                // Validation 2: Calendar Month Guard (Multiple readings in one month)
                $readingMonth = Carbon::parse($data['reading_date'])->format('Y-m');
                $existsInMonth = MeterReading::where('meter_id', $meterId)
                    ->whereRaw("DATE_FORMAT(reading_date, '%Y-%m') = ?", [$readingMonth])
                    ->exists();

                // BR-MET-005 Monotonicity Check
                if (! ($data['is_rollover'] ?? false) && $lastReading && $data['reading_value'] < $lastReading->reading_value) {
                    throw ValidationException::withMessages([
                        'reading_value' => [
                            sprintf(
                                'Validation Error: Reading (%s) cannot be lower than the previous reading (%s) unless flagged as a rollover.',
                                number_format($data['reading_value'], 2),
                                number_format($lastReading->reading_value, 2)
                            ),
                        ],
                    ]);
                }

                $reading = MeterReading::create([
                    'meter_id' => $meterId,
                    'reading_date' => $data['reading_date'],
                    'reading_value' => $data['reading_value'],
                    'is_rollover' => $data['is_rollover'] ?? false,
                    'recorded_by' => $actor->user_id,
                    'billing_id' => $data['billing_id'] ?? null,
                ]);

                if ($existsInMonth) {
                    $reading->setAttribute('warning', 'Multiple readings recorded for this calendar month.');
                }

                return $reading;
            }
        );

        $roomId = MeterAssignment::where('meter_id', $meterId)->whereNull('valid_to')->value('room_id');
        self::clearCache($roomId, $meterId);

        return $reading;
    }

    /**
     * Retrieve the last reading for a meter that was successfully billed.
     */
    public static function getLastBilledReading(int $meterId): ?MeterReading
    {
        return Cache::remember("meters:last_billed:{$meterId}", 300, function () use ($meterId) {
            return Financials::getLastBilledReading($meterId);
        });
    }

    /**
     * Map a physical meter to a room (Temporal Assignment).
     */
    public static function assignToRoom(User $actor, int $meterId, int $roomId, string $startDate): MeterAssignment
    {
        $assignment = self::runWriteWorkflow(
            actorId: $actor->user_id,
            action: 'ASSIGN_METER_TO_ROOM',
            payload: ['meter_id' => $meterId, 'room_id' => $roomId, 'start_date_fact' => $startDate],
            operation: function () use ($meterId, $roomId, $startDate): MeterAssignment {
                // Ensure no overlapping active assignment for this specific meter
                MeterAssignment::where('meter_id', $meterId)
                    ->whereNull('valid_to')
                    ->update(['valid_to' => $startDate]);

                return MeterAssignment::create([
                    'meter_id' => $meterId,
                    'room_id' => $roomId,
                    'valid_from' => $startDate,
                ]);
            }
        );

        self::clearCache($roomId, $meterId);

        return $assignment;
    }

    /**
     * List meters with pagination.
     */
    public static function listPaginated(array $filters = [], int $page = 1, int $perPage = 15)
    {
        return self::listHistoryQuery($filters)->paginate($perPage, ['*'], 'page', $page);
    }

    /**
     * Retrieve a single meter by ID.
     */
    public static function getById(int $id): ?Meter
    {
        return Meter::query()->with(['utility', 'assignments.room', 'readings.recorder', 'readings.billing'])->find($id);
    }

    /**
     * Assemble the latest consumption data for all active meters in a room.
     *
     * @return array<string, array{value: float, date: string, serial: string}>
     */
    public static function getLatestReadingsForRoom(Room $room): array
    {
        $assignments = MeterAssignment::with(['meter.utility', 'meter.readings' => function ($q) {
            $q->orderByDesc('reading_date')->orderByDesc('created_at');
        }])
            ->where('room_id', $room->room_id)
            ->where(function ($q) {
                $q->whereNull('valid_to')
                    ->orWhere('valid_to', '>', now()->toDateString());
            })
            ->get();

        $readings = [];
        foreach ($assignments as $assignment) {
            $meter = $assignment->meter;
            $lastReading = $meter->readings->first();

            if ($lastReading) {
                $readings[strtolower($meter->utility->name)] = [
                    'value' => (float) $lastReading->reading_value,
                    'date' => $lastReading->reading_date->toDateString(),
                    'serial' => $meter->serial_number,
                ];
            }
        }

        return $readings;
    }

    /**
     * List all meters with filtering.
     *
     * @return Builder<Meter>
     */
    public static function listHistoryQuery(array $filters): Builder
    {
        $query = Meter::query()->with(['utility', 'assignments.room']);

        if (! empty($filters['room_id'])) {
            $query->whereHas('assignments', fn ($q) => $q->where('room_id', $filters['room_id'])->whereNull('valid_to'));
        }

        if (! empty($filters['utility_id'])) {
            $query->where('utility_id', $filters['utility_id']);
        }

        if (! empty($filters['status'])) {
            $status = $filters['status'] instanceof MeterStatus ? $filters['status'] : MeterStatus::tryFrom($filters['status']);
            if ($status) {
                $query->where('status', $status);
            }
        }

        if (! empty($filters['q'])) {
            $needle = $filters['q'];
            $query->where(function ($q) use ($needle) {
                $q->where('serial_number', 'LIKE', "%{$needle}%")
                    ->orWhere('meter_id', 'LIKE', "%{$needle}%");
            });
        }

        /** @var Builder $query */
        return $query;
    }

    /**
     * Get active meters for a specific room.
     *
     * @return Collection<int, Meter>
     */
    public static function getMetersForRoom(int $roomId): Collection
    {
        return Cache::remember("meters:room:{$roomId}", 300, function () use ($roomId) {
            return Meter::query()->whereHas('assignments', function ($q) use ($roomId) {
                $q->where('room_id', $roomId)->whereNull('valid_to');
            })->with(['utility', 'readings' => function ($q) {
                $q->with(['recorder', 'billing'])->orderByDesc('reading_date')->orderByDesc('created_at');
            }])->get();
        });
    }

    /**
     * Clear cached meter data.
     */
    public static function clearCache(?int $roomId = null, ?int $meterId = null): void
    {
        if ($roomId) {
            Cache::forget("meters:room:{$roomId}");
        }
        if ($meterId) {
            Cache::forget("meters:last_billed:{$meterId}");
        }
    }
}
