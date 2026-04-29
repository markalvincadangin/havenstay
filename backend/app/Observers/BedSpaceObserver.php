<?php

namespace App\Observers;

use App\Models\BedSpace;
use App\Services\Operations\RoomService;

/**
 * BedSpaceObserver
 *
 * Synchronizes Room status and capacity based on BedSpace events.
 * Follows HavenStay Forensic v5.0 Nervous System pattern.
 */
class BedSpaceObserver
{
    /**
     * Handle the BedSpace "saved" event.
     */
    public function saved(BedSpace $bedSpace): void
    {
        if ($bedSpace->room) {
            RoomService::syncStatusAndCapacity($bedSpace->room);
        }
    }

    /**
     * Handle the BedSpace "deleted" event.
     */
    public function deleted(BedSpace $bedSpace): void
    {
        if ($bedSpace->room) {
            RoomService::syncStatusAndCapacity($bedSpace->room);
        }
    }
}
