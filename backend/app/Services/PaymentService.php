<?php

namespace App\Services;

use App\Models\Billing;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
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
        $started = TransactionService::logStarted(
            'payment_posting',
            $actor->user_id,
            'billing',
            (string) $data['billing_id']
        );
        $txLogId = $started['tx_log_id'];

        // CCR-008: Set audit context so database triggers can capture the actor
        AuditService::setAuditUserContext($actor->user_id);
        AuditService::setCorrelationContext($started['correlation_id']);

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
        } finally {
            AuditService::clearCorrelationContext();
        }
    }

    /**
     * Void a payment and reverse the billing effects.
     *
     * FR-024..FR-026, CCR-006, CCR-007, CCR-008
     *
     * @throws ValidationException
     */
    public static function void(User $actor, Payment $payment, ?string $reason = null): Billing
    {
        // CCR-007: Transaction log entry
        $started = TransactionService::logStarted(
            'void_payment',
            $actor->user_id,
            'payments',
            (string) $payment->payment_id
        );
        $txLogId = $started['tx_log_id'];

        // CCR-008: Set audit context so trigger trg_billing_au captures acting user
        AuditService::setAuditUserContext($actor->user_id);
        AuditService::setCorrelationContext($started['correlation_id']);

        try {
            // CCR-006: Explicit transaction
            $result = DB::transaction(function () use ($actor, $payment, $reason): Billing {
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
                    'void_reason' => $reason ?: 'User requested void (Standard Protocol)',
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
        } finally {
            AuditService::clearCorrelationContext();
        }
    }

    /**
     * List payment history with filters (query builder for pagination).
     *
     * @param  array{billing_id?: int, contract_id?: int, tenant_id?: int, q?: string, payment_from?: string, payment_to?: string, posting_status?: string}  $filters
     * @return Builder<Payment>
     */
    public static function listHistoryQuery(array $filters = []): Builder
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

        if (! empty($filters['payment_from'])) {
            $query->where('payments.payment_date', '>=', $filters['payment_from'].' 00:00:00');
        }

        if (! empty($filters['payment_to'])) {
            $query->where('payments.payment_date', '<=', $filters['payment_to'].' 23:59:59');
        }

        if (! empty($filters['posting_status'])) {
            if ($filters['posting_status'] === 'posted') {
                $query->whereNull('payments.voided_at');
            } elseif ($filters['posting_status'] === 'voided') {
                $query->whereNotNull('payments.voided_at');
            }
        }

        if (! empty($filters['q'])) {
            $needle = trim($filters['q']);
            $query->where(function ($w) use ($needle): void {
                $w->where('payments.payment_id', 'like', "%{$needle}%")
                    ->orWhere('payments.reference_number', 'like', "%{$needle}%")
                    ->orWhereHas('billing.contract.tenant', function ($t) use ($needle): void {
                        $t->where('first_name', 'like', "%{$needle}%")
                            ->orWhere('last_name', 'like', "%{$needle}%")
                            ->orWhere('contact_number', 'like', "%{$needle}%");
                    });
                if (ctype_digit($needle)) {
                    $w->orWhere('payments.payment_id', (int) $needle);
                }
            });
        }

        return $query;
    }

    /**
     * List payment history with filters.
     *
     * @param  array{billing_id?: int, contract_id?: int, tenant_id?: int}  $filters
     * @return Collection<Payment>
     */
    public static function listHistory(array $filters = [])
    {
        return self::listHistoryQuery($filters)->get();
    }
}
