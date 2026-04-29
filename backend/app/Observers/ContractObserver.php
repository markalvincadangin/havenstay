<?php

namespace App\Observers;

use App\Models\Contract;
use App\Services\Operations\TenantService;

/**
 * ContractObserver
 *
 * Synchronizes Tenant lifecycle status based on Contract events.
 * Follows HavenStay Forensic v5.0 Nervous System pattern.
 */
class ContractObserver
{
    /**
     * Handle the Contract "saved" event.
     */
    public function saved(Contract $contract): void
    {
        TenantService::syncStatus((int) $contract->tenant_id);
    }

    /**
     * Handle the Contract "deleted" event.
     */
    public function deleted(Contract $contract): void
    {
        TenantService::syncStatus((int) $contract->tenant_id);
    }

    /**
     * Handle the Contract "restored" event.
     */
    public function restored(Contract $contract): void
    {
        TenantService::syncStatus((int) $contract->tenant_id);
    }
}
