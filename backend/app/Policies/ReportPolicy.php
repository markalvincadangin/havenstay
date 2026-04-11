<?php

namespace App\Policies;

use App\Models\User;

class ReportPolicy
{
    /**
     * Determine whether the user can view reports.
     */
    public function view(User $user): bool
    {
        return $user->canView(); // canView includes admin, staff, and viewer
    }

    /**
     * Determine whether the user can export reports.
     */
    public function export(User $user): bool
    {
        return $user->canAdmin();
    }
}
