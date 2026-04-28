<?php

namespace App\Observers;

use App\Models\Payment;
use App\Services\Operations\BillingService;

/**
 * PaymentObserver
 * 
 * Synchronizes Billing cycle status (Paid/Partial) based on Payment events.
 * Follows HavenStay Forensic v5.0 Nervous System pattern.
 */
class PaymentObserver
{
    /**
     * Handle the Payment "saved" event.
     * 
     * @param Payment $payment
     * @return void
     */
    public function saved(Payment $payment): void
    {
        if ($payment->billing) {
            BillingService::synchronizeStatus($payment->billing);
        }
    }

    /**
     * Handle the Payment "deleted" event.
     * 
     * @param Payment $payment
     * @return void
     */
    public function deleted(Payment $payment): void
    {
        if ($payment->billing) {
            BillingService::synchronizeStatus($payment->billing);
        }
    }
}
