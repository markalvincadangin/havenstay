<?php

namespace App\Policies;

use App\Models\Payment;
use App\Models\User;

class PaymentPolicy
{
    /**
     * Determine whether the user can view any payments.
     */
    public function viewAny(User $user): bool
    {
        return $user->canView(); // canView includes admin, staff, and viewer
    }

    /**
     * Determine whether the user can create payments.
     */
    public function create(User $user): bool
    {
        return $user->canStaff();
    }

    /**
     * Determine whether the user can update/void payments.
     */
    public function void(User $user, Payment $payment): bool
    {
        return $user->canManageBilling(); // Use the model-level permission check
    }
}
