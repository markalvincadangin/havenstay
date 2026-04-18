<?php

namespace App\Services\Operations;

use App\Services\Concerns\ManagesWorkflows;
use App\Models\Billing;
use App\Models\Contract;
use App\Models\Payment;
use App\Models\User;
use App\Support\Financials;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Validation\ValidationException;

/**
 * PaymentService
 * 
 * Handles the posting, validation, and voiding of financial transactions.
 * Orchestrates atomic billing status reconciliation following every payment event.
 */
class PaymentService
{
    use ManagesWorkflows;

    /**
     * Get a specific payment record with full forensic context.
     * 
     * @param int $paymentId
     * @return Payment|null
     */
    public static function getById(int $paymentId): ?Payment
    {
        return Payment::query()
            ->with([
                'billing.contract.tenant',
                'billing.contract.bedSpace.room',
                'billing.contract.room',
                'processor',
            ])
            ->find($paymentId);
    }

    /**
     * Record a new payment with atomic balance update and transaction logging.
     * 
     * Forensic Rules:
     * - Rule: Payments are immutable; only voiding is permitted for correction.
     * - Trigger: Automates contract activation if initial (Rent+Deposit) is settled.
     * - Logic: Multi-entity reconciliation (Billing -> Contract -> BedSpace).
     * 
     * @param User $actor The staff member performing the action.
     * @param array $data Input including billing_id, amount_paid, and method.
     * @return Billing The updated billing header after posting.
     * @throws ValidationException
     */
    public static function record(User $actor, array $data): Billing
    {
        return self::runWriteWorkflow(
            actorId: $actor->user_id,
            action: 'POST_PAYMENT',
            txnReference: self::buildTxnReference('PAY'),
            payload: ['billing_id' => $data['billing_id']],
            operation: function () use ($actor, $data): Billing {
                $billing = Billing::where('billing_id', (int) $data['billing_id'])
                    ->lockForUpdate()
                    ->first();

                if (! $billing) {
                    throw ValidationException::withMessages([
                        'billing_id' => ['Billing record not found.'],
                    ]);
                }

                if ((float) $data['amount_paid'] <= 0) {
                    throw ValidationException::withMessages([
                        'amount_paid' => ['Payment amount must be greater than zero.'],
                    ]);
                }

                Payment::create([
                    'billing_id' => $billing->billing_id,
                    'processed_by' => $actor->user_id,
                    'amount_paid' => (float) $data['amount_paid'],
                    'payment_date' => $data['payment_date'],
                    'payment_method' => $data['payment_method'] ?? 'cash',
                    'reference_number' => $data['reference_number'] ?? null,
                    'remarks' => $data['remarks'] ?? null,
                ]);

                // Authority: Reconcile billing status
                BillingService::syncBillingStatus($billing);

                // Forensic Hook: Auto-activate contract if pending_payment and settled
                $contract = $billing->contract;
                if ($contract && (string) $contract->status === Contract::STATUS_PENDING_PAYMENT) {
                    try {
                        $totalPaid = Financials::getTotalPaid((int) $contract->contract_id);
                        $initialTotal = ($contract->monthly_rate_override ?: ($contract->room->monthly_rate ?? 0)) + $contract->deposit_amount;
                        
                        if ($totalPaid >= ($initialTotal - 0.01)) {
                            ContractService::activate($actor, $contract);
                        }
                    } catch (\Exception $e) {
                        \Illuminate\Support\Facades\Log::warning("Auto-activation deferred: " . $e->getMessage());
                    }
                }

                return BillingService::getById((int) $billing->billing_id);
            },
            resultDetails: fn (Billing $billing): array => [
                'billing_id' => (int) $data['billing_id'],
                'amount_paid' => (float) $data['amount_paid'],
            ]
        );
    }

    /**
     * Void a payment and reverse billing status effects.
     * 
     * Forensic Rules:
     * - Constraint: Payments cannot be deleted, only marked as voided.
     * - Reconciliation: Reverse the balance impact on the associated bill.
     * 
     * @param User $actor The staff member performing the action.
     * @param Payment $payment Target payment entity.
     * @param string|null $reason Audit reason for voiding.
     * @return Billing
     * @throws ValidationException
     */
    public static function void(User $actor, Payment $payment, ?string $reason = null): Billing
    {
        return self::runWriteWorkflow(
            actorId: $actor->user_id,
            action: 'VOID_PAYMENT',
            txnReference: self::buildTxnReference('VOID'),
            payload: ['payment_id' => $payment->payment_id],
            operation: function () use ($actor, $payment, $reason): Billing {
                $billing = Billing::where('billing_id', $payment->billing_id)
                    ->lockForUpdate()
                    ->firstOrFail();

                if ($payment->voided_at !== null) {
                    throw ValidationException::withMessages([
                        'payment_id' => ['Payment is already voided.'],
                    ]);
                }

                $payment->update([
                    'voided_at' => now(),
                    'voided_by' => $actor->user_id,
                    'void_reason' => $reason ?: 'User requested void (Standard Protocol)',
                ]);

                BillingService::syncBillingStatus($billing);

                return BillingService::getById((int) $billing->billing_id);
            },
            resultDetails: fn (Billing $billing) => [
                'payment_id' => $payment->payment_id,
                'amount_voided' => $payment->amount_paid,
            ]
        );
    }

    /**
     * List payment history with forensic filters.
     * 
     * @param array $filters (billing_id, contract_id, tenant_id, q, dates).
     * @return Builder<Payment>
     */
    public static function listHistoryQuery(array $filters = []): Builder
    {
        $query = Payment::query()
            ->select('payments.*')
            ->join('billing', 'billing.billing_id', '=', 'payments.billing_id')
            ->join('contracts', 'contracts.contract_id', '=', 'billing.contract_id')
            ->with(['billing.contract.tenant', 'billing.contract.bedSpace.room', 'processor'])
            ->orderByDesc('payments.payment_date');

        if (! empty($filters['billing_id'])) {
            $query->where('payments.billing_id', (int) $filters['billing_id']);
        }

        if (! empty($filters['contract_id'])) {
            $query->where('billing.contract_id', (int) $filters['contract_id']);
        }

        if (! empty($filters['tenant_id'])) {
            $query->where('contracts.tenant_id', (int) $filters['tenant_id']);
        }

        if (! empty($filters['posting_status'])) {
            if ($filters['posting_status'] === 'posted') {
                $query->whereNull('voided_at');
            } elseif ($filters['posting_status'] === 'voided') {
                $query->whereNotNull('voided_at');
            }
        }

        if (! empty($filters['q'])) {
            $needle = trim($filters['q']);
            $query->where(function ($w) use ($needle): void {
                $w->where('payments.payment_id', 'like', "%{$needle}%")
                    ->orWhere('payments.reference_number', 'like', "%{$needle}%")
                    ->orWhereHas('billing.contract.tenant', function ($t) use ($needle): void {
                        $t->where('first_name', 'like', "%{$needle}%")
                            ->orWhere('last_name', 'like', "%{$needle}%");
                    });
            });
        }

        return $query;
    }
}
