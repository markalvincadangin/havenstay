<?php

namespace App\Services;

use App\Models\Billing;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PaymentService
{
    /**
     * Record a new payment with atomic balance update and transaction logging.
     *
     * FR-024..FR-027, CCR-006, CCR-007
     *
     * @param  array{billing_id: int, amount_paid: float, payment_date: string, payment_method?: string, reference_number?: string, remarks?: string}  $data
     *
     * @throws ValidationException
     */
    public static function record(User $actor, array $data): Billing
    {
        // CCR-007: Transaction log entry
        $txLogId = TransactionService::logStarted(
            'payment_posting',
            $actor->user_id,
            'billing',
            (string) $data['billing_id']
        );

        // CCR-008: Set audit context so database triggers can capture the actor
        AuditService::setAuditUserContext($actor->user_id);

        try {
            // CCR-006: Explicit transaction — START TRANSACTION / COMMIT / ROLLBACK
            $result = DB::transaction(function () use ($actor, $data): Billing {
                // CCR-003: INSERT payment record
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

                $payment = Payment::create([
                    'billing_id' => $billing->billing_id,
                    'processed_by' => $actor->user_id,
                    'amount_paid' => (float) $data['amount_paid'],
                    'payment_date' => $data['payment_date'],
                    'payment_method' => $data['payment_method'] ?? 'cash',
                    'reference_number' => $data['reference_number'] ?? null,
                    'remarks' => $data['remarks'] ?? null,
                ]);

                BillingService::autoUpdateStatus($billing);

                return BillingService::getById((int) $billing->billing_id);
            });

            TransactionService::logCommitted($txLogId, [
                'billing_id' => (int) $data['billing_id'],
                'amount_paid' => (float) $data['amount_paid'],
            ]);

            return $result;
        } catch (\Throwable $e) {
            TransactionService::logRolledBack($txLogId, $e->getMessage());

            throw $e;
        }
    }

    /**
     * Void a payment and reverse the billing effects.
     *
     * FR-024..FR-027, CCR-006, CCR-007, CCR-008
     *
     * @throws ValidationException
     */
    public static function void(User $actor, Payment $payment): Billing
    {
        // CCR-007: Transaction log entry
        $txLogId = TransactionService::logStarted(
            'void_payment',
            $actor->user_id,
            'payments',
            (string) $payment->payment_id
        );

        // CCR-008: Set audit context so trigger trg_billing_au captures acting user
        AuditService::setAuditUserContext($actor->user_id);

        try {
            // CCR-006: Explicit transaction
            $result = DB::transaction(function () use ($actor, $payment): Billing {
                $billing = Billing::where('billing_id', $payment->billing_id)
                    ->lockForUpdate()
                    ->firstOrFail();

                if ($payment->voided_at !== null) {
                    throw ValidationException::withMessages([
                        'payment_id' => ['Payment is already voided.'],
                    ]);
                }

                // Mark payment as voided
                $payment->update([
                    'voided_at' => now(),
                    'voided_by' => $actor->user_id,
                    'void_reason' => 'User requested void',
                ]);

                // CCR-003: UPDATE — billing status recalculation
                // CCR-008: Trigger fires on billing UPDATE — see havenstay_schema.sql (trg_billing_au)
                BillingService::autoUpdateStatus($billing);

                return BillingService::getById((int) $billing->billing_id);
            });

            // CCR-007: Transaction log entry - committed
            TransactionService::logCommitted($txLogId, [
                'payment_id' => $payment->payment_id,
                'billing_id' => $payment->billing_id,
                'amount_voided' => $payment->amount_paid,
            ]);

            return $result;
        } catch (\Throwable $e) {
            TransactionService::logRolledBack($txLogId, $e->getMessage());

            throw $e;
        }
    }

    /**
     * List payment history with filters.
     *
     * @param  array{billing_id?: int, contract_id?: int, tenant_id?: int}  $filters
     * @return Collection<Payment>
     */
    public static function listHistory(array $filters = [])
    {
        $query = Payment::query()
            ->select('payments.*')
            ->join('billing', 'billing.billing_id', '=', 'payments.billing_id')
            ->join('contracts', 'contracts.contract_id', '=', 'billing.contract_id')
            ->with(['billing.contract.tenant', 'billing.contract.bedSpace.room', 'processor'])
            ->orderByDesc('payments.payment_date')
            ->orderByDesc('payments.payment_id');

        if (! empty($filters['billing_id'])) {
            $query->where('payments.billing_id', (int) $filters['billing_id']);
        }

        if (! empty($filters['contract_id'])) {
            $query->where('billing.contract_id', (int) $filters['contract_id']);
        }

        if (! empty($filters['tenant_id'])) {
            $query->where('contracts.tenant_id', (int) $filters['tenant_id']);
        }

        return $query->get();
    }
}
